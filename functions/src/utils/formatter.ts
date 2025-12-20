/**
 * Formatting Utilities
 * Format data for display to users
 */

/**
 * Format amount as Kenyan Shillings
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format timestamp to readable date/time
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format timestamp to date only
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format timestamp to time only
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format transaction type (income/expense)
 */
export function formatTransactionType(type: string, language: 'en' | 'sw'): string {
  if (type === 'income') {
    return language === 'en' ? 'Income' : 'Mapato';
  }
  return language === 'en' ? 'Expense' : 'Matumizi';
}

/**
 * Format business type
 */
export function formatBusinessType(type: string, language: 'en' | 'sw'): string {
  const types: Record<string, Record<string, string>> = {
    '1': { en: 'Retail Shop', sw: 'Duka la Retail' },
    '2': { en: 'Restaurant/Cafe', sw: 'Mgahawa/Kahawa' },
    '3': { en: 'Service Provider', sw: 'Mtoa Huduma' },
    '4': { en: 'Salon/Spa', sw: 'Saloni/Spa' },
    '5': { en: 'Electronics', sw: 'Elektroniki' },
    '6': { en: 'Clothing', sw: 'Nguo' },
    '7': { en: 'Groceries', sw: 'Mboga' },
    '8': { en: 'Other', sw: 'Nyingine' },
  };

  return types[type]?.[language] || type;
}

/**
 * Format expense category
 */
export function formatCategory(category: string, language: 'en' | 'sw'): string {
  const categories: Record<string, Record<string, string>> = {
    '1': { en: 'Stock', sw: 'Hisa' },
    '2': { en: 'Rent', sw: 'Kodi' },
    '3': { en: 'Utilities', sw: 'Umeme/Maji' },
    '4': { en: 'Salaries', sw: 'Mshahara' },
    '5': { en: 'Other', sw: 'Nyingine' },
  };

  return categories[category]?.[language] || category;
}

/**
 * Format payment method
 */
export function formatPaymentMethod(method: string, language: 'en' | 'sw'): string {
  const methods: Record<string, Record<string, string>> = {
    '1': { en: 'Cash', sw: 'Pesa Taslimu' },
    '2': { en: 'M-Pesa', sw: 'M-Pesa' },
    '3': { en: 'Bank Transfer', sw: 'Hundi ya Benki' },
    '4': { en: 'Credit Card', sw: 'Kadi ya Mikopo' },
  };

  return methods[method]?.[language] || method;
}

/**
 * Generate random password
 */
export function generatePassword(length = 12): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/**
 * Format shop summary for display
 */
export function formatShopSummary(
  shop: {
    shopName: string;
    ownerName: string;
    businessType: string;
  },
  language: 'en' | 'sw'
): string {
  const label = language === 'en' ? 'Shop' : 'Duka';
  const owner = language === 'en' ? 'Owner' : 'Mwenye';
  const type = language === 'en' ? 'Type' : 'Aina';

  return `${label}: ${shop.shopName}\n${owner}: ${shop.ownerName}\n${type}: ${shop.businessType}`;
}
