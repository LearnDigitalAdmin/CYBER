import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where,
  Timestamp,
  updateDoc,
  orderBy,
  limit,
  writeBatch,
  deleteDoc,
  runTransaction} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functionsAfrica as functions } from './firebaseService';
import { checkSafaricomPhone } from '../utils/safaricom';
import {
  MAX_UNITS_PER_PROPERTY, unitSizeCode, validateUnitSpecs,
  normalizeUnitType, normalizeUnitSize, normalizeUnitCondition, normalizeUnitStatus,
  type UnitType, type UnitSize, type UnitCondition, type UnitStatus, type UnitSpec
} from './Units';
export type { UnitType, UnitSize, UnitCondition, UnitStatus, UnitSpec } from './Units';

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
  paymentInfo: any;
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

export interface Property {
  id: number;
  localId: number;
  userId: string; // Asset ID
  companyId?: number;
  name: string;
  address?: string;
  description?: string;
  image?: string;
  agentCommissionRate: number;
  maxUnits: number;
  /** 'rent_only': invoices are rent-only (no water/power metering) and can be bulk-generated. 'full': itemised billing. Matches Plot Yangu. */
  billingMode?: BillingMode;
  /** PYP-NNNN, allocated by the server (allocatePropertyOwnerId) when the property is created. */
  ownerId?: string;
  /** The owner's Safaricom number, stored as +2547XXXXXXXX. */
  ownerPhone?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type BillingMode = 'rent_only' | 'full';

/** users/{userId}/properties/{propertyId}/units/{unitId} - PUBLIC to read, so it holds unit facts only (never tenant data). */
export interface Unit {
  id: number; // propertyId * 1000 + n
  localId: number;
  propertyId: number;
  userId: string;
  ownerId?: string;
  unitNumber: string; // BS-01, 1B-03 ... passed to tenants as their unit number
  unitType: UnitType;
  unitSize: UnitSize;
  condition: UnitCondition;
  status: UnitStatus;
  isOccupied: boolean;
  rentAmount: number;
  depositAmount: number;
}

export const normalizeBillingMode = (v: unknown): BillingMode => (v === 'rent_only' ? 'rent_only' : 'full');

/**
 * Fields Plot Yangu's sync layer needs on every document Desk writes:
 *  - lastSyncTime: the app's download query orders by it, so documents without it are never returned
 *  - lastModified: the app's "is the cloud copy newer?" check reads it
 *  - origin: 'desk' marks the document as Desk-created, so the app never silently overwrites it with an unrelated local record that reused its ID
 */
const syncStamp = () => ({
  lastSyncTime: Timestamp.now(),
  lastModified: new Date().toISOString(),
});
export const deskOriginStamp = () => ({ origin: 'desk' as const, ...syncStamp() });
export const deskUpdateStamp = () => syncStamp();


export interface PropertyInput {
  userId: string; // Asset ID
  companyId?: number;
  name: string;
  address?: string;
  description?: string;
  image?: string;
  agentCommissionRate?: number;
  maxUnits?: number;
  billingMode?: BillingMode;
  /** REQUIRED when creating a property. Must be a Safaricom number. */
  ownerPhone?: string;
  /** REQUIRED when creating a property: the units to create. maxUnits becomes their total. */
  units?: UnitSpec[];
}

export interface Tenant {
  id: number; // National ID
  localId: number;
  propertyId: number;
  userId: string; // Asset ID
  name: string;
  phone?: string;
  email?: string;
  unitNumber?: string;
  unitId?: number;
  rentAmount: number;
  standingFees: number;
  depositAmount: number;
  leaseStart?: string;
  leaseEnd?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TenantInput {
  id: number; // National ID
  propertyId: number;
  userId: string; // Asset ID
  name: string;
  phone?: string;
  email?: string;
  unitNumber?: string;
  /** The vacant unit to lease. Rent, unit number and default deposit are taken from it. */
  unitId?: number;
  rentAmount: number;
  standingFees?: number;
  depositAmount?: number;
  leaseStart?: string;
  leaseEnd?: string;
}

class AssetsService {
  private usersCollection = collection(db, 'users');

  /**
   * Hash password using argon2
   */

//   private async hashPassword(password: string): Promise<string> {
//   const salt = crypto.getRandomValues(new Uint8Array(16));
//   const result = await argon2id({
//     password: password,
//     salt: salt,
//     hashLength: 32,
//     iterations: 3,
//     memorySize: 65536, // 64 MB in KB
//     parallelism: 1,
//     outputType: 'encoded'
//   });
//   return result;
// }

  /**
   * Create a new landlord or agent
   */
  // In Assets.tsx - Agent creating user with CUSTOM UID
async createAsset(formData: AssetFormData, currentUserPId: string): Promise<void> {
  try {
    const createUserWithFirebaseAuth = httpsCallable(functions, 'createUserWithFirebaseAuth');
    
    const userData = {
      email: formData.email,
      password: formData.password,
      userData: {
        localId: formData.id, // ✅ Custom UID = National ID
        name: formData.name,
        phone: formData.phone,
        tier: formData.type === 'landlord' ? 'solo' : 'pro',
        type: 'paid',
        storage: true,
        isPremium: true,
        assetType: formData.type,
        cyberId: currentUserPId, // ✅ Track who created this
        company: formData.type === 'agent' && formData.companyName ? {
          name: formData.companyName,
          address: formData.companyAddress || '',
          phone: formData.companyPhone || '',
          email: formData.companyEmail || ''
        } : null
      },
      creationType: 'agent' // ✅ Identifies agent creation
    };

    const result = await createUserWithFirebaseAuth(userData);
    console.log('Asset created with custom UID:', result.data);
    
  } catch (error) {
    console.error('Error creating asset:', error);
    throw new Error('Failed to create asset. Please try again.');
  }
}
  // async createAsset(formData: AssetFormData, currentUserPId: string): Promise<void> {
  //   try {
  //     // Hash the password
  //     const passwordHash = await this.hashPassword(formData.password);

  //     // Prepare Firebase Auth data
  //     const createUserWithFirebaseAuth = httpsCallable(functions, 'createUserWithFirebaseAuth');
      
  //     const firebaseAuthData = {
  //       email: formData.email,
  //       password: formData.password,
  //       userData: {
  //         localId: formData.id,
  //         name: formData.name,
  //         phone: formData.phone,
  //         tier: formData.type === 'landlord' ? 'solo' : 'pro',
  //         type: 'paid',
  //         storage: true,
  //         isPremium: true,
  //         company: formData.type === 'agent' && formData.companyName ? {
  //           name: formData.companyName,
  //           address: formData.companyAddress || '',
  //           phone: formData.companyPhone || '',
  //           email: formData.companyEmail || ''
  //         } : null
  //       }
  //     };

  //     // Create user in Firebase Auth via Cloud Function
  //     await createUserWithFirebaseAuth(firebaseAuthData);

  //     // Create user document in Firestore
  //     const userDocRef = doc(this.usersCollection, formData.id);
  //     const userData: any = {
  //       id: formData.id,
  //       name: formData.name,
  //       email: formData.email,
  //       phone: formData.phone,
  //       passwordHash,
  //       tier: formData.type === 'landlord' ? 'solo' : 'pro',
  //       type: 'paid',
  //       storage: true,
  //       isPremium: true,
  //       cyberId: currentUserPId,
  //       assetType: formData.type,
  //       createdAt: Timestamp.now(),
  //       updatedAt: Timestamp.now(),
  //       status: 'active'
  //     };

  //     if (formData.type === 'agent' && formData.companyName) {
  //       userData.company = {
  //         name: formData.companyName,
  //         address: formData.companyAddress || '',
  //         phone: formData.companyPhone || '',
  //         email: formData.companyEmail || ''
  //       };
  //     }

  //     await setDoc(userDocRef, userData);

  //   } catch (error) {
  //     console.error('Error creating asset:', error);
  //     throw new Error('Failed to create asset. Please try again.');
  //   }
  // }

    /**
   * Get next property ID using Firestore counter
   */

private async getNextPropertyId(userId: string): Promise<number> {
  const propertiesRef = collection(db, "users", userId, "properties");
  
  // Query the last document by ID (assuming ID is numeric)
  const q = query(propertiesRef, orderBy("id", "desc"), limit(1));
  const querySnapshot = await getDocs(q);

  let nextId = 111; // Starting ID if none exist

  if (!querySnapshot.empty) {
    const lastDoc = querySnapshot.docs[0];
    const lastId = lastDoc.data().id;
    nextId = (typeof lastId === "number" ? lastId : parseInt(lastId, 10)) + 1;
  }

  return nextId;
}

public async getNextInvoiceId(userId: string): Promise<number> {
  const propertiesRef = collection(db, "users", userId, "invoices");
  
  // Query the last document by ID (assuming ID is numeric)
  const q = query(propertiesRef, orderBy("id", "desc"), limit(1));
  const querySnapshot = await getDocs(q);

  let nextId = 1111111; // Starting ID if none exist

  if (!querySnapshot.empty) {
    const lastDoc = querySnapshot.docs[0];
    const lastId = lastDoc.data().id;
    nextId = (typeof lastId === "number" ? lastId : parseInt(lastId, 10)) + 1;
  }

  return nextId;
}


  /**
   * Create a new property for an asset
   */
  async createProperty(propertyData: PropertyInput, pId: string): Promise<Property> {
    try {
      const ownerCheck = checkSafaricomPhone(propertyData.ownerPhone);
      if (!ownerCheck.ok) {
        throw new Error(`Owner phone: ${ownerCheck.message}`);
      }

      const unitSpecs = propertyData.units || [];
      const unitProblem = validateUnitSpecs(unitSpecs);
      if (unitProblem) {
        throw new Error(`Units: ${unitProblem}`);
      }
      const totalUnits = unitSpecs.reduce((sum, u) => sum + u.count, 0);

      const propertyId = await this.getNextPropertyId(propertyData.userId);
      
      const propertyRef = doc(db, 'users', propertyData.userId, 'properties', propertyId.toString());

      // Every property carries a unique PYP-NNNN owner id from the moment it exists in Firestore.
      const ownerId = await this.allocateOwnerId(propertyData.userId, propertyId);
      
      const property = {
        id: propertyId,
        localId: propertyId,
        userId: propertyData.userId,
        agentId: pId,
        companyId: propertyData.companyId || null,
        name: propertyData.name,
        address: propertyData.address || '',
        description: propertyData.description || '',
        image: propertyData.image || '',
        agentCommissionRate: propertyData.agentCommissionRate || 0,
        maxUnits: totalUnits,
        billingMode: normalizeBillingMode(propertyData.billingMode),
        ownerId,
        ownerPhone: ownerCheck.e164,
        isRestricted: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ...deskOriginStamp()
      };
      
      await setDoc(propertyRef, property);

      // No property without its units: if they cannot be written, take the property back out.
      try {
        await this.writeUnits(propertyData.userId, propertyId, ownerId, unitSpecs);
      } catch (unitError) {
        await deleteDoc(propertyRef).catch(() => {});
        throw unitError;
      }
      
      console.log('Property created successfully:', property);
      
      return property as Property;
    } catch (error: any) {
      console.error('Error creating property:', error);
      if (typeof error?.message === 'string' && (error.message.startsWith('Owner phone:') || error.message.startsWith('Units:'))) throw error;
      throw new Error('Failed to create property. Please try again.');
    }
  }

  /** Asks the server for the next PYP-NNNN id. Idempotent per property, so a retry returns the same id. */
  private async allocateOwnerId(userId: string, propertyId: number): Promise<string> {
    const allocate = httpsCallable<{ userId: string; propertyId: number }, { ownerId: string }>(functions, 'allocatePropertyOwnerId');
    const res = await allocate({ userId, propertyId });
    const ownerId = res.data?.ownerId;
    if (typeof ownerId !== 'string' || !/^PYP-\d{4,}$/.test(ownerId)) {
      throw new Error('Could not allocate an owner ID. Please try again.');
    }
    return ownerId;
  }

  /**
   * The PYP-NNNN owner id of a property. Properties created before owner ids existed get one the first time a tenant or
   * invoice is added to them, so nothing created from now on is ever without it.
   */
  public async ensurePropertyOwnerId(userId: string, propertyId: number): Promise<string> {
    const propertyRef = doc(db, 'users', userId, 'properties', propertyId.toString());
    const snap = await getDoc(propertyRef);
    const existing = snap.data()?.ownerId;
    if (typeof existing === 'string' && /^PYP-\d{4,}$/.test(existing)) return existing;

    const ownerId = await this.allocateOwnerId(userId, propertyId);
    if (snap.exists()) await updateDoc(propertyRef, { ownerId });
    return ownerId;
  }

  /**
   * Update an existing property
   */
  async updateProperty(userId: string, propertyId: number, updates: Partial<PropertyInput>): Promise<void> {
    try {
      const propertyRef = doc(db, 'users', userId, 'properties', propertyId.toString());

      const { ownerPhone, ...rest } = updates;
      let ownerPhoneUpdate: { ownerPhone: string } | Record<string, never> = {};
      if (ownerPhone !== undefined) {
        const ownerCheck = checkSafaricomPhone(ownerPhone);
        if (!ownerCheck.ok) throw new Error(`Owner phone: ${ownerCheck.message}`);
        ownerPhoneUpdate = { ownerPhone: ownerCheck.e164 };
      }
      
      await updateDoc(propertyRef, {
        ...rest,
        ...ownerPhoneUpdate,
        ...(updates.billingMode !== undefined ? { billingMode: normalizeBillingMode(updates.billingMode) } : {}),
        updatedAt: Timestamp.now(),
        ...deskUpdateStamp()
      });
    } catch (error: any) {
      console.error('Error updating property:', error);
      if (typeof error?.message === 'string' && error.message.startsWith('Owner phone:')) throw error;
      throw new Error('Failed to update property. Please try again.');
    }
  }

  /** Writes the units of a new property. Ids are propertyId * 1000 + n; numbers are BS-01, BS-02 ... per size. */
  private async writeUnits(userId: string, propertyId: number, ownerId: string, specs: UnitSpec[]): Promise<void> {
    const perSize: Record<string, number> = {};
    const docs: { id: number; data: Record<string, unknown> }[] = [];
    let seq = 0;
    for (const spec of specs) {
      for (let i = 0; i < spec.count; i++) {
        seq++;
        if (seq > MAX_UNITS_PER_PROPERTY) throw new Error(`Units: A property can have at most ${MAX_UNITS_PER_PROPERTY} units`);
        const size = normalizeUnitSize(spec.unitSize);
        perSize[size] = (perSize[size] || 0) + 1;
        const id = propertyId * 1000 + seq;
        docs.push({
          id,
          data: {
            id,
            localId: id,
            userId,
            propertyId,
            ownerId,
            unitNumber: `${unitSizeCode(size)}-${String(perSize[size]).padStart(2, '0')}`,
            unitType: normalizeUnitType(spec.unitType),
            unitSize: size,
            condition: normalizeUnitCondition(spec.condition),
            status: 'vacant',
            isOccupied: false,
            rentAmount: spec.rentAmount,
            depositAmount: spec.depositAmount || 0,
            ...deskOriginStamp()
          }
        });
      }
    }
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      for (const u of docs.slice(i, i + 400)) {
        batch.set(doc(db, 'users', userId, 'properties', propertyId.toString(), 'units', u.id.toString()), u.data);
      }
      await batch.commit();
    }
  }

  /** All units of a property, by unit number. */
  async getUnitsByProperty(userId: string, propertyId: number): Promise<Unit[]> {
    const snap = await getDocs(collection(db, 'users', userId, 'properties', propertyId.toString(), 'units'));
    return snap.docs
      .map(d => {
        const u = d.data();
        return {
          ...u,
          status: normalizeUnitStatus(u.status),
          unitType: normalizeUnitType(u.unitType),
          unitSize: normalizeUnitSize(u.unitSize),
          condition: normalizeUnitCondition(u.condition)
        } as Unit;
      })
      .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }));
  }

  /** Units a tenant can be given: vacant only. */
  async getAvailableUnits(userId: string, propertyId: number): Promise<Unit[]> {
    return (await this.getUnitsByProperty(userId, propertyId)).filter(u => u.status === 'vacant');
  }

  /**
   * Create a new tenant. The tenant leases one vacant unit: the unit is checked and marked occupied in the same
   * transaction that writes the tenant, so two tenants can never lease the same unit.
   */
  async createTenant(tenantData: TenantInput): Promise<Tenant> {
    try {
      if (tenantData.unitId == null) {
        throw new Error('Select a vacant unit for this tenant.');
      }
      const tenantRef = doc(db, 'users', tenantData.userId, 'tenants', tenantData.id.toString());
      const unitRef = doc(db, 'users', tenantData.userId, 'properties', tenantData.propertyId.toString(), 'units', tenantData.unitId.toString());
      
      // The property's owner id travels with every tenant of that property.
      const ownerId = await this.ensurePropertyOwnerId(tenantData.userId, tenantData.propertyId);

      const tenant = await runTransaction(db, async (tx) => {
        // The tenant ID is the National ID. Never silently overwrite an existing tenant document that reuses it.
        if ((await tx.get(tenantRef)).exists()) {
          throw new Error(`A tenant with ID ${tenantData.id} already exists for this asset.`);
        }

        const unitSnap = await tx.get(unitRef);
        const unit = unitSnap.data();
        if (!unitSnap.exists() || !unit || unit.propertyId !== tenantData.propertyId) {
          throw new Error('Unit does not belong to this property.');
        }
        if (unit.status === 'maintenance') {
          throw new Error(`Unit ${unit.unitNumber} is under maintenance.`);
        }
        if (unit.status !== 'vacant') {
          throw new Error(`Unit ${unit.unitNumber} is already occupied.`);
        }

        const newTenant = {
          id: tenantData.id,
          localId: tenantData.id,
          propertyId: tenantData.propertyId,
          ownerId,
          userId: tenantData.userId,
          name: tenantData.name,
          phone: tenantData.phone || '',
          email: tenantData.email || '',
          unitId: tenantData.unitId,
          unitNumber: unit.unitNumber,
          rentAmount: unit.rentAmount,
          standingFees: tenantData.standingFees || 0,
          depositAmount: tenantData.depositAmount ?? unit.depositAmount ?? 0,
          leaseStart: tenantData.leaseStart || null,
          leaseEnd: tenantData.leaseEnd || null,
          isActive: true,
          isRestricted: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          ...deskOriginStamp()
        };

        tx.set(tenantRef, newTenant);
        tx.update(unitRef, { status: 'occupied', isOccupied: true, ...deskUpdateStamp() });
        return newTenant;
      });
      
      return tenant as Tenant;
    } catch (error: any) {
      console.error('Error creating tenant:', error);
      if (typeof error?.message === 'string' && /already exists|^Unit |^Select a vacant|already occupied/.test(error.message)) throw error;
      throw new Error('Failed to create tenant. Please try again.');
    }
  }

  /** Deletes a tenant and sets the unit they leased back to vacant (a unit under maintenance is left alone). */
  async deleteTenant(userId: string, tenant: { id: number; propertyId: number; unitId?: number | null }): Promise<void> {
    try {
      const tenantRef = doc(db, 'users', userId, 'tenants', tenant.id.toString());
      const unitRef = tenant.unitId != null
        ? doc(db, 'users', userId, 'properties', tenant.propertyId.toString(), 'units', tenant.unitId.toString())
        : null;

      await runTransaction(db, async (tx) => {
        const unitSnap = unitRef ? await tx.get(unitRef) : null;
        tx.delete(tenantRef);
        if (unitRef && unitSnap?.exists() && unitSnap.data()?.status === 'occupied') {
          tx.update(unitRef, { status: 'vacant', isOccupied: false, ...deskUpdateStamp() });
        }
      });
    } catch (error) {
      console.error('Error deleting tenant:', error);
      throw new Error('Failed to delete tenant. Please try again.');
    }
  }

  /**
   * Update an existing tenant
   */
  async updateTenant(userId: string, tenantId: string, updates: Partial<TenantInput>): Promise<void> {
    try {
      const tenantRef = doc(db, 'users', userId, 'tenants', tenantId);
      
      await updateDoc(tenantRef, {
        ...updates,
        updatedAt: Timestamp.now(),
        ...deskUpdateStamp()
      });
    } catch (error) {
      console.error('Error updating tenant:', error);
      throw new Error('Failed to update tenant. Please try again.');
    }
  }

  /**
   * Get all properties for an asset
   */
  async getPropertiesByAsset(userId: string): Promise<Property[]> {
    try {
      const propertiesRef = collection(db, 'users', userId, 'properties');
      const snapshot = await getDocs(propertiesRef);
      
      return snapshot.docs.map(doc => doc.data() as Property);
    } catch (error) {
      console.error('Error fetching properties:', error);
      return [];
    }
  }

  /**
   * Tenant IDs that already have an invoice for the given billing month (single-field query, no composite index).
   */
  async getInvoicedTenantIdsForMonth(userId: string, billingMonth: string): Promise<Set<number>> {
    const snap = await getDocs(query(collection(db, 'users', userId, 'invoices'), where('billingMonth', '==', billingMonth)));
    return new Set(snap.docs.map(d => Number(d.data().tenantId)));
  }

  /**
   * Get all tenants for a property
   */
  async getTenantsByProperty(userId: string, propertyId: number): Promise<Tenant[]> {
    try {
      const tenantsRef = collection(db, 'users', userId, 'tenants');
      const q = query(tenantsRef, where('propertyId', '==', propertyId));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => doc.data() as Tenant);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      return [];
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
          paymentInfo: data.paymentInfo,
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
        paymentInfo: data.paymentInfo,
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