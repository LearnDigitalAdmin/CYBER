// src/pages/AddServices.tsx
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, Image as ImageIcon, CheckCircle, AlertCircle,
  Loader2, ArrowLeft, Plus, Edit2, Trash2, Save, Package
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/authContext';
import { useNavigate } from 'react-router-dom';
import { snpService, type Product, type UploadProgress } from '../services/snp';

interface UploadingFile {
  file: File;
  id: string;
  preview: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const AddServices = () => {
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      toast.error('Please sign in to add products');
      navigate('/signin');
    }
  }, [currentUser, authLoading, navigate]);

  useEffect(() => {
    if (currentUser) {
      loadProducts();
    }
  }, [currentUser]);

  const loadProducts = async () => {
    if (!currentUser) return;
    
    setLoadingProducts(true);
    try {
      const userProducts = await snpService.getProducts(currentUser.uid);
      setProducts(userProducts);
    } catch (error: any) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: UploadingFile[] = [];
    const errors = snpService.validateImages(Array.from(selectedFiles));

    if (errors.length > 0) {
      toast.error(errors.join('\n'));
      return;
    }

    Array.from(selectedFiles).forEach(file => {
      const uploadingFile: UploadingFile = {
        file,
        id: `${Date.now()}-${Math.random()}`,
        preview: '',
        progress: 0,
        status: 'pending'
      };

      const reader = new FileReader();
      reader.onload = (e) => {
        uploadingFile.preview = e.target?.result as string;
        setFiles(prev => prev.map(f => f.id === uploadingFile.id ? uploadingFile : f));
      };
      reader.readAsDataURL(file);

      newFiles.push(uploadingFile);
    });

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async () => {
    if (!currentUser) {
      toast.error('Please sign in first');
      return;
    }

    if (!productName.trim()) {
      toast.error('Please enter a product name');
      return;
    }

    const price = parseFloat(productPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    if (files.length === 0) {
      toast.error('Please select at least one image');
      return;
    }

    setUploading(true);

    try {
      // Upload images
      const fileArray = files.map(f => f.file);
      const imageUrls = await snpService.uploadImages(
        currentUser.uid,
        fileArray,
        (progresses: UploadProgress[]) => {
          setFiles(prev => prev.map((f, idx) => ({
            ...f,
            progress: progresses[idx]?.progress || 0,
            status: progresses[idx]?.url ? 'success' : progresses[idx]?.error ? 'error' : 'uploading',
            error: progresses[idx]?.error
          })));
        }
      );

      if (imageUrls.length === 0) {
        throw new Error('No images were uploaded successfully');
      }

      // Create products
      const createdProducts = await snpService.createProducts(
        currentUser.uid,
        productName.trim(),
        price,
        imageUrls
      );

      toast.success(`${createdProducts.length} product(s) added successfully!`);
      
      // Reset form
      setProductName('');
      setProductPrice('');
      setFiles([]);
      
      // Reload products
      await loadProducts();
    } catch (error: any) {
      console.error('Error adding products:', error);
      toast.error(`Failed to add products: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setEditName(product.name);
    setEditPrice(product.price.toString());
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setEditName('');
    setEditPrice('');
  };

  const saveEdit = async () => {
    if (!currentUser || !editingProduct) return;

    if (!editName.trim()) {
      toast.error('Please enter a product name');
      return;
    }

    const price = parseFloat(editPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    try {
      await snpService.updateProduct(currentUser.uid, editingProduct.id, {
        name: editName.trim(),
        price
      });

      toast.success('Product updated successfully!');
      cancelEdit();
      await loadProducts();
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast.error(`Failed to update product: ${error.message}`);
    }
  };

  const handleDelete = async (productId: number) => {
    if (!currentUser) return;

    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await snpService.deleteProduct(currentUser.uid, productId);
      toast.success('Product deleted successfully!');
      await loadProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error(`Failed to delete product: ${error.message}`);
    }
  };

  const formatPrice = (price: number): string => {
    return `KSh ${price.toLocaleString()}`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
      {/* Background Animation */}
      <motion.div
        className="fixed inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ duration: 2 }}
      >
        <motion.div
          className="absolute w-full h-full"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          style={{ backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 70%)' }}
        />
      </motion.div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Add Products & Services</h1>
              <p className="text-gray-400 mt-1">Upload product images and set pricing</p>
            </div>
          </div>

          {/* Upload Section */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center">
                <Plus className="w-6 h-6 text-black" />
              </div>
              <h2 className="text-2xl font-bold">New Product</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g., Earphones"
                  disabled={uploading}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Price (KSh) *
                </label>
                <input
                  type="number"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  placeholder="e.g., 200"
                  min="0"
                  step="1"
                  disabled={uploading}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white disabled:opacity-50"
                />
              </div>
            </div>

            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="bg-gray-900/50 border-2 border-dashed border-gray-700 hover:border-cyan-500 rounded-xl p-8 text-center cursor-pointer transition-all"
            >
              <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-lg font-medium text-white mb-2">Click to upload images</p>
              <p className="text-sm text-gray-400 mb-2">
                You can upload multiple photos - each will be a separate product
              </p>
              <p className="text-xs text-gray-500">
                e.g., "Earphones" + 5 photos = 5 products at same price
              </p>
              <p className="text-xs text-gray-500 mt-2">
                JPEG, PNG, WebP • Max 5MB per image
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
                disabled={uploading}
              />
            </div>

            {/* Selected Images */}
            {files.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-4">
                  Selected Images ({files.length}) - Each will be a separate product
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {files.map((fileItem) => (
                    <div
                      key={fileItem.id}
                      className="relative bg-gray-900/50 rounded-lg overflow-hidden border border-gray-700"
                    >
                      <div className="aspect-square">
                        {fileItem.preview ? (
                          <img
                            src={fileItem.preview}
                            alt={fileItem.file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-800">
                            <ImageIcon className="w-12 h-12 text-gray-600" />
                          </div>
                        )}
                      </div>

                      {fileItem.status === 'uploading' && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                          <span className="text-sm text-white">{Math.round(fileItem.progress)}%</span>
                        </div>
                      )}

                      {fileItem.status === 'success' && (
                        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                      )}

                      {fileItem.status === 'error' && (
                        <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                          <AlertCircle className="w-8 h-8 text-red-400" />
                        </div>
                      )}

                      {fileItem.status === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(fileItem.id);
                          }}
                          disabled={uploading}
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 rounded-full p-1 transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      )}

                      <div className="p-2">
                        <p className="text-xs text-gray-400 truncate">{fileItem.file.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            {files.length > 0 && (
              <button
                onClick={handleSubmit}
                disabled={uploading || !productName.trim() || !productPrice}
                className="w-full py-4 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all font-semibold text-lg shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Products...
                  </>
                ) : (
                  <>
                    <Package className="w-5 h-5" />
                    Create {files.length} Product{files.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Products Table */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
            <h2 className="text-2xl font-bold mb-6">Your Products ({products.length})</h2>

            {loadingProducts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No products yet. Add your first product above!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">ID</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Image</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Price</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {products.map((product) => (
                        <motion.tr
                          key={product.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                        >
                          <td className="py-4 px-4 text-gray-300">{product.id}</td>
                          <td className="py-4 px-4">
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-16 h-16 object-cover rounded-lg"
                            />
                          </td>
                          <td className="py-4 px-4">
                            {editingProduct?.id === product.id ? (
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white w-full max-w-xs"
                              />
                            ) : (
                              <span className="text-white font-medium">{product.name}</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {editingProduct?.id === product.id ? (
                              <input
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                min="0"
                                step="1"
                                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white w-32"
                              />
                            ) : (
                              <span className="text-cyan-400 font-semibold">
                                {formatPrice(product.price)}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-end gap-2">
                              {editingProduct?.id === product.id ? (
                                <>
                                  <button
                                    onClick={saveEdit}
                                    className="p-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                                    title="Save"
                                  >
                                    <Save className="w-4 h-4 text-white" />
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="p-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
                                    title="Cancel"
                                  >
                                    <X className="w-4 h-4 text-white" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEdit(product)}
                                    className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4 text-white" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(product.id)}
                                    className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4 text-white" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddServices;