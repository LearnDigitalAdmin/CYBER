/**
 * Shop Service
 * CRUD operations for shop management
 */

import { db, auth } from '../config/firebase.config';
import { Shop, ShopCreateInput } from '../types/shop.types';
import { logger } from '../utils/logger';
import { generateNextShopId } from '../utils/shop-id.generator';

const SHOPS_COLLECTION = 'shops';

/**
 * Create a new shop with Firebase Auth account
 * @param input - Shop creation data
 * @param password - Password for Firebase Auth (typically national ID)
 */
export async function createShop(input: ShopCreateInput, password: string): Promise<Shop> {
  let shopRef = null;
  let createdAuthUser = false;
  let firebaseUid = '';

  try {
    // Generate unique numeric shop ID
    const shopId = await generateNextShopId();
    shopRef = db.collection(SHOPS_COLLECTION).doc(shopId);
    const now = Math.floor(Date.now() / 1000);

    const email = input.email || `${input.ownerName.toLowerCase().replace(/\s+/g, '')}${input.nationalId}@shopmanager.co.ke`;

    // Step 1: Create Firebase Auth account
    logger.info('Creating Firebase Auth account', { email, ownerName: input.ownerName });

    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: input.ownerName,
    });

    firebaseUid = userRecord.uid;
    createdAuthUser = true;

    logger.info('Firebase Auth account created', { firebaseUid, email });

    // Step 2: Create shop document with auth metadata
    const shop: Shop = {
      id: shopRef.id,
      ownerName: input.ownerName,
      shopName: input.shopName,
      location: input.location,
      totalEmployees: input.totalEmployees,
      nationalId: input.nationalId,
      phone: input.phone,
      email: email,
      businessType: input.businessType,
      firebaseUid: firebaseUid,
      authEmail: email,
      authCreatedAt: now,
      createdAt: now,
      createdVia: 'whatsapp',
      status: 'active',
      isAuthSetup: true,
      loginCount: 0,
    };

    // Step 3: Save shop to Firestore
    await shopRef.set(shop);

    logger.info('Shop created successfully', {
      shopId: shop.id,
      ownerName: shop.ownerName,
      firebaseUid: firebaseUid,
      email: email,
    });

    return shop;
  } catch (error) {
    logger.error('Failed to create shop', error);

    // Cleanup: Delete Firebase Auth user if shop creation failed
    if (createdAuthUser && firebaseUid) {
      try {
        await auth.deleteUser(firebaseUid);
        logger.info('Cleaned up Firebase Auth user after shop creation failure', { firebaseUid });
      } catch (cleanupError) {
        logger.error('Failed to cleanup Firebase Auth user', cleanupError);
      }
    }

    throw error;
  }
}

/**
 * Get shop by ID
 */
export async function getShopById(shopId: string): Promise<Shop | null> {
  try {
    const doc = await db.collection(SHOPS_COLLECTION).doc(shopId).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as Shop;
  } catch (error) {
    logger.error('Failed to get shop', error);
    throw error;
  }
}

/**
 * Get shop by National ID
 */
export async function getShopByNationalId(nationalId: string): Promise<Shop | null> {
  try {
    const snapshot = await db
      .collection(SHOPS_COLLECTION)
      .where('nationalId', '==', nationalId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as Shop;
  } catch (error) {
    logger.error('Failed to get shop by national ID', error);
    throw error;
  }
}

/**
 * Get shop by phone number
 */
export async function getShopByPhone(phone: string): Promise<Shop | null> {
  try {
    const snapshot = await db
      .collection(SHOPS_COLLECTION)
      .where('phone', '==', phone)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as Shop;
  } catch (error) {
    logger.error('Failed to get shop by phone', error);
    throw error;
  }
}

/**
 * Update shop
 */
export async function updateShop(shopId: string, updates: Partial<Shop>): Promise<Shop> {
  try {
    const docRef = db.collection(SHOPS_COLLECTION).doc(shopId);

    await docRef.update(updates);

    const updatedDoc = await docRef.get();
    return updatedDoc.data() as Shop;
  } catch (error) {
    logger.error('Failed to update shop', error);
    throw error;
  }
}

/**
 * Suspend shop
 */
export async function suspendShop(shopId: string): Promise<void> {
  try {
    await db.collection(SHOPS_COLLECTION).doc(shopId).update({
      status: 'suspended',
    });

    logger.info('Shop suspended', { shopId });
  } catch (error) {
    logger.error('Failed to suspend shop', error);
    throw error;
  }
}

/**
 * Delete shop (rarely used)
 */
export async function deleteShop(shopId: string): Promise<void> {
  try {
    await db.collection(SHOPS_COLLECTION).doc(shopId).delete();

    logger.info('Shop deleted', { shopId });
  } catch (error) {
    logger.error('Failed to delete shop', error);
    throw error;
  }
}

/**
 * Get all shops (admin only)
 */
export async function getAllShops(): Promise<Shop[]> {
  try {
    const snapshot = await db.collection(SHOPS_COLLECTION).get();
    const shops: Shop[] = [];

    snapshot.forEach((doc) => {
      shops.push(doc.data() as Shop);
    });

    return shops;
  } catch (error) {
    logger.error('Failed to get all shops', error);
    throw error;
  }
}

/**
 * Get total shop count
 */
export async function getShopCount(): Promise<number> {
  try {
    const snapshot = await db.collection(SHOPS_COLLECTION).count().get();
    return snapshot.data().count;
  } catch (error) {
    logger.error('Failed to get shop count', error);
    throw error;
  }
}
