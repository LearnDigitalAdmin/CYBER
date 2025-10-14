import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where,
  Timestamp} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebaseService';
import { argon2id } from 'hash-wasm';

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface AssetFormData {
  id: string; // National ID
  name: string;
  email: string;
  phone: string;
  password: string;
  type: 'landlord' | 'agent';
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}

export interface Asset {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: 'landlord' | 'agent';
  tier: 'solo' | 'pro';
  cyberId: string;
  company?: CompanyInfo;
  createdAt: Timestamp;
  properties: number;
  tenants: number;
  revenue: number;
  status: 'active' | 'pending' | 'inactive';
}

class AssetsService {
  private usersCollection = collection(db, 'users');

  /**
   * Hash password using argon2
   */

  private async hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const result = await argon2id({
    password: password,
    salt: salt,
    hashLength: 32,
    iterations: 3,
    memorySize: 65536, // 64 MB in KB
    parallelism: 1,
    outputType: 'encoded'
  });
  return result;
}

  /**
   * Create a new landlord or agent
   */
  async createAsset(formData: AssetFormData, currentUserPId: string): Promise<void> {
    try {
      // Hash the password
      const passwordHash = await this.hashPassword(formData.password);

      // Prepare Firebase Auth data
      const createUserWithFirebaseAuth = httpsCallable(functions, 'createUserWithFirebaseAuth');
      
      const firebaseAuthData = {
        email: formData.email,
        password: formData.password,
        userData: {
          localId: formData.id,
          name: formData.name,
          phone: formData.phone,
          tier: formData.type === 'landlord' ? 'solo' : 'pro',
          type: 'paid',
          storage: true,
          isPremium: true,
          company: formData.type === 'agent' && formData.companyName ? {
            name: formData.companyName,
            address: formData.companyAddress || '',
            phone: formData.companyPhone || '',
            email: formData.companyEmail || ''
          } : null
        }
      };

      // Create user in Firebase Auth via Cloud Function
      await createUserWithFirebaseAuth(firebaseAuthData);

      // Create user document in Firestore
      const userDocRef = doc(this.usersCollection, formData.id);
      const userData: any = {
        id: formData.id,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        passwordHash,
        tier: formData.type === 'landlord' ? 'solo' : 'pro',
        type: 'paid',
        storage: true,
        isPremium: true,
        cyberId: currentUserPId,
        assetType: formData.type,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        status: 'active'
      };

      if (formData.type === 'agent' && formData.companyName) {
        userData.company = {
          name: formData.companyName,
          address: formData.companyAddress || '',
          phone: formData.companyPhone || '',
          email: formData.companyEmail || ''
        };
      }

      await setDoc(userDocRef, userData);

    } catch (error) {
      console.error('Error creating asset:', error);
      throw new Error('Failed to create asset. Please try again.');
    }
  }

  /**
   * Get all assets managed by current cyber operator
   */
  async getAssetsByCyberId(cyberId: string): Promise<Asset[]> {
    try {
      const q = query(
        this.usersCollection,
        where('cyberId', '==', cyberId),
        where('type', '==', 'paid')
      );

      const querySnapshot = await getDocs(q);
      const assets: Asset[] = [];

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        
        // Get properties count
        const propertiesRef = collection(db, 'users', docSnap.id, 'properties');
        const propertiesSnap = await getDocs(propertiesRef);
        const propertiesCount = propertiesSnap.size;

        // Get tenants count
        const tenantsRef = collection(db, 'users', docSnap.id, 'tenants');
        const tenantsSnap = await getDocs(tenantsRef);
        const tenantsCount = tenantsSnap.size;

        // Calculate revenue from invoices
        const invoicesRef = collection(db, 'users', docSnap.id, 'invoices');
        const invoicesSnap = await getDocs(invoicesRef);
        let revenue = 0;
        invoicesSnap.forEach((invoice) => {
          const invoiceData = invoice.data();
          if (invoiceData.status === 'paid') {
            revenue += invoiceData.totalAmount || 0;
          }
        });

        assets.push({
          id: docSnap.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          type: data.assetType,
          tier: data.tier,
          cyberId: data.cyberId,
          company: data.company,
          createdAt: data.createdAt,
          properties: propertiesCount,
          tenants: tenantsCount,
          revenue,
          status: data.status || 'active'
        });
      }

      return assets;
    } catch (error) {
      console.error('Error fetching assets:', error);
      throw new Error('Failed to fetch assets.');
    }
  }

  /**
   * Get pending renewals (free tier users under this cyber)
   */
  async getPendingRenewals(cyberId: string): Promise<number> {
    try {
      const q = query(
        this.usersCollection,
        where('cyberId', '==', cyberId),
        where('type', '==', 'free')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error fetching pending renewals:', error);
      return 0;
    }
  }

  /**
   * Get asset by ID
   */
  async getAssetById(assetId: string): Promise<Asset | null> {
    try {
      const docRef = doc(this.usersCollection, assetId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();

      // Get properties count
      const propertiesRef = collection(db, 'users', assetId, 'properties');
      const propertiesSnap = await getDocs(propertiesRef);
      const propertiesCount = propertiesSnap.size;

      // Get tenants count
      const tenantsRef = collection(db, 'users', assetId, 'tenants');
      const tenantsSnap = await getDocs(tenantsRef);
      const tenantsCount = tenantsSnap.size;

      // Calculate revenue
      const invoicesRef = collection(db, 'users', assetId, 'invoices');
      const invoicesSnap = await getDocs(invoicesRef);
      let revenue = 0;
      invoicesSnap.forEach((invoice) => {
        const invoiceData = invoice.data();
        if (invoiceData.status === 'paid') {
          revenue += invoiceData.amount || 0;
        }
      });

      return {
        id: docSnap.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        type: data.assetType,
        tier: data.tier,
        cyberId: data.cyberId,
        company: data.company,
        createdAt: data.createdAt,
        properties: propertiesCount,
        tenants: tenantsCount,
        revenue,
        status: data.status || 'active'
      };
    } catch (error) {
      console.error('Error fetching asset:', error);
      return null;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(cyberId: string) {
    try {
      const assets = await this.getAssetsByCyberId(cyberId);
      const pendingRenewals = await this.getPendingRenewals(cyberId);

      const totalAssets = assets.length;
      const totalTenants = assets.reduce((sum, asset) => sum + asset.tenants, 0);
      const monthlyRevenue = assets.reduce((sum, asset) => sum + asset.revenue, 0);

      return {
        totalAssets,
        totalTenants,
        monthlyRevenue,
        pendingRenewals
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        totalAssets: 0,
        totalTenants: 0,
        monthlyRevenue: 0,
        pendingRenewals: 0
      };
    }
  }

  /**
   * Get monthly trends for charts
   */
  async getMonthlyTrends(cyberId: string, months: number = 6) {
    try {
      // This is a simplified version - you may want to store historical data
      const assets = await this.getAssetsByCyberId(cyberId);
      
      // For now, return mock data structure
      // In production, you'd query historical records
      const trends = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = new Date().getMonth();

      for (let i = months - 1; i >= 0; i--) {
        const monthIndex = (currentMonth - i + 12) % 12;
        trends.push({
          month: monthNames[monthIndex],
          income: 0, // Would calculate from historical invoices
          assets: assets.length // Would get from historical records
        });
      }

      return trends;
    } catch (error) {
      console.error('Error fetching monthly trends:', error);
      return [];
    }
  }
}

export const assetsService = new AssetsService();