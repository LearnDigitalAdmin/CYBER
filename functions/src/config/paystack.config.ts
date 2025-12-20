/**
 * Paystack Configuration
 * Stores Paystack API credentials and settings
 */

import { defineSecret } from 'firebase-functions/params';

export const PAYSTACK_SECRET_KEY = defineSecret('PAYSTACK_SECRET_KEY');

export const PAYSTACK_CONFIG = {
  BASE_URL: 'https://api.paystack.co',
};

export const getPaystackHeaders = () => {
  return {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY.value()}`,
    'Content-Type': 'application/json',
  };
};

// Currency configuration
export const CURRENCY = {
  CODE: 'KES',
  SYMBOL: 'Ksh',
  KOBO_MULTIPLIER: 100, // 1 KES = 100 kobo for Paystack
};
