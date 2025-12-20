/**
 * Parser Utilities
 * Parse special command formats
 */

/**
 * Parse pay bill command format: pay{amount}frm{phone}
 * Example: pay500frm0712345678
 *
 * Returns: { valid: boolean; amount?: number; phone?: string; formatted?: string }
 */
export function parsePayBillCommand(input: string): {
  valid: boolean;
  amount?: number;
  phone?: string;
  formatted?: string;
  error?: string;
} {
  const cleaned = input.trim().toLowerCase();

  // Check format: pay{amount}frm{phone}
  const regex = /^pay(\d+)frm(07|01\d{8})$/;
  const match = cleaned.match(regex);

  if (!match) {
    return {
      valid: false,
      error: 'Invalid format. Use: pay{amount}frm{phone} (e.g., pay500frm0712345678)',
    };
  }

  const amount = parseInt(match[1], 10);
  const phone = match[2];

  // Validate amount (10 - 1,000,000 KES)
  if (amount < 10 || amount > 1000000) {
    return {
      valid: false,
      error: 'Amount must be between 10 and 1,000,000 KES',
    };
  }

  // Format phone to international
  const formattedPhone = '+254' + phone.substring(1);

  return {
    valid: true,
    amount,
    phone,
    formatted: formattedPhone,
  };
}

/**
 * Extract phone number from string
 * Handles: 0712345678, 07 12345678, 254712345678, +254712345678
 */
export function extractPhoneNumber(input: string): string | null {
  const cleaned = input.trim().replace(/\s+/g, '');

  // Try various formats
  let match = cleaned.match(/(\d{10})$/); // Last 10 digits
  if (match) {
    return match[1];
  }

  match = cleaned.match(/254(\d{9})$/); // International without +
  if (match) {
    return '0' + match[1];
  }

  match = cleaned.match(/\+254(\d{9})$/); // International with +
  if (match) {
    return '0' + match[1];
  }

  return null;
}

/**
 * Extract amount from string
 * Handles: "500", "Ksh 500", "500 KES", etc.
 */
export function extractAmount(input: string): number | null {
  const cleaned = input.trim().toUpperCase();

  // Remove currency symbols and text
  const match = cleaned.match(/(\d+)/);
  if (!match) {
    return null;
  }

  const amount = parseInt(match[1], 10);
  return isNaN(amount) ? null : amount;
}

/**
 * Extract menu option from input
 * Handles: "1", " 1 ", etc.
 */
export function extractMenuOption(input: string): number | null {
  const cleaned = input.trim();
  const option = parseInt(cleaned, 10);

  if (isNaN(option) || option.toString() !== cleaned) {
    return null;
  }

  return option;
}

/**
 * Parse time range for reports
 * Handles: "weekly", "weekly report", "7 days", etc.
 */
export function parseTimeRange(input: string): 'daily' | 'weekly' | 'monthly' | null {
  const cleaned = input.trim().toLowerCase();

  if (cleaned.includes('daily') || cleaned === 'today') {
    return 'daily';
  }
  if (cleaned.includes('weekly') || cleaned === '7' || cleaned.includes('week')) {
    return 'weekly';
  }
  if (cleaned.includes('monthly') || cleaned === '30' || cleaned.includes('month')) {
    return 'monthly';
  }

  return null;
}

/**
 * Check if user is trying to navigate back
 */
export function isBackCommand(input: string): boolean {
  const cleaned = input.trim().toLowerCase();
  return ['back', '0', 'exit', 'menu', 'home'].includes(cleaned);
}
