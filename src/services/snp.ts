// src/services/snp.ts
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebaseService';

export interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  createdAt: number;
  updatedAt: number;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  url?: string;
  error?: string;
}

class ServicesAndProductsService {
  /**
   * Get the next available product ID for a user
   */
  async getNextProductId(userId: string): Promise<number> {
    try {
      const productsRef = collection(db, 'agents', userId, 'products');
      const q = query(productsRef, orderBy('id', 'desc'), limit(1));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return 1;
      }
      
      const lastProduct = snapshot.docs[0].data();
      return (lastProduct.id || 0) + 1;
    } catch (error) {
      console.error('Error getting next product ID:', error);
      return 1;
    }
  }

  /**
   * Upload a single image to Firebase Storage
   */
  async uploadImage(
    userId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `products/${userId}/${timestamp}_${safeName}`;
        const storageRef = ref(storage, storagePath);
        
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress?.(progress);
          },
          (error) => {
            console.error('Upload error:', error);
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (error) {
              reject(error);
            }
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Upload multiple images
   */
  async uploadImages(
    userId: string,
    files: File[],
    onProgress?: (progresses: UploadProgress[]) => void
  ): Promise<string[]> {
    const urls: string[] = [];
    const progresses: UploadProgress[] = files.map(f => ({
      fileName: f.name,
      progress: 0
    }));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const url = await this.uploadImage(userId, file, (progress) => {
          progresses[i].progress = progress;
          onProgress?.([...progresses]);
        });
        
        progresses[i].url = url;
        urls.push(url);
      } catch (error: any) {
        progresses[i].error = error.message;
        console.error(`Error uploading ${file.name}:`, error);
      }
      
      onProgress?.([...progresses]);
    }
    
    return urls;
  }

  /**
   * Create products from uploaded images
   */
  async createProducts(
    userId: string,
    name: string,
    price: number,
    imageUrls: string[]
  ): Promise<Product[]> {
    const products: Product[] = [];
    let nextId = await this.getNextProductId(userId);
    const timestamp = Date.now();

    for (const imageUrl of imageUrls) {
      const product: Product = {
        id: nextId,
        name,
        price,
        imageUrl,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      try {
        const productRef = doc(db, 'agents', userId, 'products', nextId.toString());
        await setDoc(productRef, product);
        products.push(product);
        nextId++;
      } catch (error) {
        console.error(`Error creating product ${nextId}:`, error);
        throw error;
      }
    }

    return products;
  }

  /**
   * Get all products for a user
   */
  async getProducts(userId: string): Promise<Product[]> {
    try {
      const productsRef = collection(db, 'agents', userId, 'products');
      const q = query(productsRef, orderBy('id', 'asc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => doc.data() as Product);
    } catch (error) {
      console.error('Error getting products:', error);
      return [];
    }
  }

  /**
   * Get a single product
   */
  async getProduct(userId: string, productId: number): Promise<Product | null> {
    try {
      const productRef = doc(db, 'agents', userId, 'products', productId.toString());
      const productDoc = await getDoc(productRef);
      
      if (productDoc.exists()) {
        return productDoc.data() as Product;
      }
      return null;
    } catch (error) {
      console.error('Error getting product:', error);
      return null;
    }
  }

  /**
   * Update a product
   */
  async updateProduct(
    userId: string,
    productId: number,
    updates: Partial<Pick<Product, 'name' | 'price' | 'imageUrl'>>
  ): Promise<void> {
    try {
      const productRef = doc(db, 'agents', userId, 'products', productId.toString());
      const productDoc = await getDoc(productRef);
      
      if (!productDoc.exists()) {
        throw new Error('Product not found');
      }

      const updatedProduct = {
        ...productDoc.data(),
        ...updates,
        updatedAt: Date.now()
      };

      await setDoc(productRef, updatedProduct);
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  /**
   * Delete a product and its image
   */
  async deleteProduct(userId: string, productId: number): Promise<void> {
    try {
      // Get product to get image URL
      const product = await this.getProduct(userId, productId);
      
      if (!product) {
        throw new Error('Product not found');
      }

      // Delete image from storage
      try {
        const imageRef = ref(storage, product.imageUrl);
        await deleteObject(imageRef);
      } catch (error) {
        console.warn('Error deleting image from storage:', error);
      }

      // Delete product document
      const productRef = doc(db, 'agents', userId, 'products', productId.toString());
      await deleteDoc(productRef);
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  /**
   * Delete multiple products
   */
  async deleteProducts(userId: string, productIds: number[]): Promise<void> {
    for (const productId of productIds) {
      await this.deleteProduct(userId, productId);
    }
  }

  /**
   * Validate image file
   */
  validateImage(file: File): string | null {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      return `${file.name}: Only JPEG, PNG, and WebP images are allowed`;
    }

    if (file.size > maxSize) {
      return `${file.name}: Image must be less than 5MB`;
    }

    return null;
  }

  /**
   * Validate multiple images
   */
  validateImages(files: File[]): string[] {
    const errors: string[] = [];
    
    files.forEach(file => {
      const error = this.validateImage(file);
      if (error) {
        errors.push(error);
      }
    });

    return errors;
  }

  /**
   * Get products from multiple users (for marketplace/carousel)
   */
  async getProductsFromMultipleUsers(userIds: string[]): Promise<Product[]> {
    const allProducts: Product[] = [];

    for (const userId of userIds) {
      const products = await this.getProducts(userId);
      allProducts.push(...products);
    }

    // Shuffle products for random display
    return this.shuffleArray(allProducts);
  }

  /**
   * Shuffle array (Fisher-Yates algorithm)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export const snpService = new ServicesAndProductsService();