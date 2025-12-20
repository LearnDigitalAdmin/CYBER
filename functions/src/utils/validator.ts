/**
 * Validation Utilities
 * All validation functions for user inputs
 */

/**
 * Validate National ID
 * - 7-10 digits
 * - Numeric only
 * - Not all zeros or sequential patterns
 */
export function validateNationalId(id: string): boolean {
  const cleaned = id.trim();

  // Check format
  if (!/^\d{7,10}$/.test(cleaned)) {
    return false;
  }

  // Check if all zeros
  if (/^0+$/.test(cleaned)) {
    return false;
  }

  // Check if sequential (12345678, 87654321)
  const digits = cleaned.split('').map(Number);
  let isSequential = true;
  for (let i = 1; i < digits.length; i++) {
    if (Math.abs(digits[i] - digits[i - 1]) !== 1) {
      isSequential = false;
      break;
    }
  }
  if (isSequential) {
    return false;
  }

  return true;
}

/**
 * Validate Kenyan phone number
 * - 07XX or 01XX format (10 digits)
 * - Converts to international format (+254XXX)
 */
export function validatePhoneNumber(phone: string): { valid: boolean; formatted?: string } {
  const cleaned = phone.trim();

  // Check format (07XXXXXXXX or 01XXXXXXXX)
  if (!/^(07|01)\d{8}$/.test(cleaned)) {
    return { valid: false };
  }

  // Convert to international format
  const formatted = '+254' + cleaned.substring(1);

  return { valid: true, formatted };
}

/**
 * Validate amount
 * - Minimum: 10 KES
 * - Maximum: 1,000,000 KES
 * - Must be integer
 */
export function validateAmount(amount: string): { valid: boolean; amount?: number } {
  const cleaned = amount.trim();

  // Check if number
  const num = parseInt(cleaned, 10);
  if (isNaN(num) || num.toString() !== cleaned) {
    return { valid: false };
  }

  // Check range
  if (num < 10 || num > 1000000) {
    return { valid: false };
  }

  return { valid: true, amount: num };
}

/**
 * Validate email address
 * - Standard email format
 */
export function validateEmail(email: string): boolean {
  const cleaned = email.trim().toLowerCase();

  // Standard email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailRegex.test(cleaned) && cleaned.length <= 254;
}

/**
 * Validate number of employees
 * - 0 to 1000 employees
 */
export function validateEmployees(employees: string): { valid: boolean; count?: number } {
  const cleaned = employees.trim();

  // Check if number
  const num = parseInt(cleaned, 10);
  if (isNaN(num) || num.toString() !== cleaned) {
    return { valid: false };
  }

  // Check range
  if (num < 0 || num > 1000) {
    return { valid: false };
  }

  return { valid: true, count: num };
}

/**
 * Validate text input
 * - Min length: 2
 * - Max length: 100
 * - Alphanumeric and spaces only
 */
export function validateTextInput(text: string, minLength = 2, maxLength = 100): boolean {
  const cleaned = text.trim();

  // Length check
  if (cleaned.length < minLength || cleaned.length > maxLength) {
    return false;
  }

  // Allow letters, numbers, spaces, and basic punctuation
  if (!/^[a-zA-Z0-9\s\-'.&]+$/.test(cleaned)) {
    return false;
  }

  return true;
}

/**
 * Validate menu selection
 * - Must be a number
 * - Within valid range
 */
export function validateMenuSelection(input: string, minOption: number, maxOption: number): { valid: boolean; option?: number } {
  const cleaned = input.trim();
  const num = parseInt(cleaned, 10);

  if (isNaN(num) || num.toString() !== cleaned) {
    return { valid: false };
  }

  if (num < minOption || num > maxOption) {
    return { valid: false };
  }

  return { valid: true, option: num };
}

/**
 * Check if input is a confirmation (PAY, YES, OK, etc.)
 */
export function isConfirmation(input: string): boolean {
  const confirmed = input.trim().toUpperCase();
  return ['PAY', 'LAI', 'YES', 'Y', 'OK', 'CONFIRM', 'NDIYO'].includes(confirmed);
}

/**
 * Sanitize user input
 * - Trim whitespace
 * - Remove suspicious characters
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>\"'`;]/g, '');
}

/**
 * Check if input is a navigation command
 * - 0: Back to previous step
 * - 00: Start over from beginning
 * - 000: Exit to language selection
 */
export interface NavigationCommand {
  type: 'back' | 'restart' | 'exit' | null;
}

export function checkNavigationCommand(input: string): NavigationCommand {
  const cleaned = input.trim().toLowerCase();

  // Numeric shortcuts
  if (cleaned === '000') {
    return { type: 'exit' };
  }
  if (cleaned === '00') {
    return { type: 'restart' };
  }
  if (cleaned === '0') {
    return { type: 'back' };
  }

  // Text commands
  if (cleaned === 'back' || cleaned === 'nyuma') {
    return { type: 'back' };
  }
  if (cleaned === 'exit' || cleaned === 'quit' || cleaned === 'exit' || cleaned === 'ext') {
    return { type: 'exit' };
  }
  if (cleaned === 'restart' || cleaned === 'start' || cleaned === 'fresh') {
    return { type: 'restart' };
  }

  return { type: null };
}
