/**
 * Form Service
 * Handles form generation, storage, and caching
 */

import { db, storage } from './firebaseService';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface ShopInfo {
  shopName: string;
  ownerName: string;
  shopId: string;
}

export interface CyberInfo {
  cyberName: string;
  cyberPId: string;
  cyberEmail?: string;
  cyberPhone: string;
}

type FormType = 'sales' | 'expenses' | 'stock';

interface StoredForm {
  formType: FormType;
  url: string;
  generatedAt: number;
  fileName: string;
}

/**
 * Check if form already exists in Firestore
 */
async function getStoredForm(
  shopId: string,
  formType: FormType
): Promise<string | null> {
  try {
    const formsRef = collection(db, 'shops', shopId, 'forms');
    const formDoc = await getDoc(doc(formsRef, formType));

    if (formDoc.exists()) {
      const data = formDoc.data() as StoredForm;
      return data.url;
    }
    return null;
  } catch (error) {
    console.error('Error getting stored form:', error);
    return null;
  }
}

/**
 * Store form URL in Firestore
 */
async function storeFormUrl(
  shopId: string,
  formType: FormType,
  url: string,
  fileName: string
): Promise<void> {
  try {
    const formsRef = collection(db, 'shops', shopId, 'forms');
    await setDoc(doc(formsRef, formType), {
      formType,
      url,
      fileName,
      generatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error storing form URL:', error);
    throw error;
  }
}

/**
 * Generate form via cloud function and upload to storage
 */
async function generateFormPDF(
  shopId: string,
  formType: FormType,
  shopInfo: ShopInfo,
  cyberInfo: CyberInfo
): Promise<string> {
  try {
    // Call cloud function to generate PDF
    // Construct the proper Cloud Function URL
    const projectId = 'plot-9fd6e'; // Firebase project ID
    const region = 'us-central1'; // Cloud Functions region
    const functionUrl = import.meta.env.MODE === 'production'
      ? `https://${region}-${projectId}.cloudfunctions.net/shopFormGenerator`
      : `http://localhost:5001/${projectId}/${region}/shopFormGenerator`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shopId,
        formType,
        shopInfo,
        cyberInfo,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate form: ${response.statusText} - ${errorText}`);
    }

    const blob = await response.blob();
    const fileName = `${shopInfo.shopName.replace(/\s+/g, '_')}_${formType}_form_${Date.now()}.pdf`;
    const storageRef = ref(storage, `forms/${shopId}/${formType}/${fileName}`);

    // Upload to Firebase Storage
    await uploadBytes(storageRef, blob);

    // Get download URL
    const downloadUrl = await getDownloadURL(storageRef);

    // Store in Firestore for caching
    await storeFormUrl(shopId, formType, downloadUrl, fileName);

    return downloadUrl;
  } catch (error) {
    console.error('Error generating form:', error);
    throw error;
  }
}

/**
 * Get or generate form (checks cache first)
 */
export async function generateAndStoreForm(
  shopId: string,
  formType: FormType,
  shopInfo: ShopInfo,
  cyberInfo: CyberInfo
): Promise<string> {
  try {
    // Check if form already exists
    const cachedUrl = await getStoredForm(shopId, formType);
    if (cachedUrl) {
      console.log(`Using cached ${formType} form for shop ${shopId}`);
      return cachedUrl;
    }

    // Generate new form
    console.log(`Generating new ${formType} form for shop ${shopId}`);
    const url = await generateFormPDF(shopId, formType, shopInfo, cyberInfo);

    return url;
  } catch (error) {
    console.error('Error in generateAndStoreForm:', error);
    throw error;
  }
}

/**
 * Get all forms for a shop
 */
export async function getShopForms(
  shopId: string
): Promise<Map<FormType, string>> {
  try {
    const formTypes: FormType[] = ['sales', 'expenses', 'stock'];
    const forms = new Map<FormType, string>();

    for (const formType of formTypes) {
      const cachedUrl = await getStoredForm(shopId, formType);
      if (cachedUrl) {
        forms.set(formType, cachedUrl);
      }
    }

    return forms;
  } catch (error) {
    console.error('Error getting shop forms:', error);
    return new Map();
  }
}

/**
 * Delete a form from cache (to regenerate)
 */
export async function deleteFormCache(
  shopId: string,
  formType: FormType
): Promise<void> {
  try {
    const formsRef = collection(db, 'shops', shopId, 'forms');
    await deleteDoc(doc(formsRef, formType));
  } catch (error) {
    console.error('Error deleting form cache:', error);
    throw error;
  }
}
