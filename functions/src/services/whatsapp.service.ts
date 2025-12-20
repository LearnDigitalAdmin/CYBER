/**
 * WhatsApp Service
 * Handles sending messages via WhatsApp API
 */

import axios from 'axios';
import { getWhatsAppApiUrl, getWhatsAppHeaders } from '../config/whatsapp.config';
import { logger } from '../utils/logger';

/**
 * Send text message via WhatsApp API
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    logger.debug('Sending WhatsApp message', { phone, messageLength: message.length });

    const url = getWhatsAppApiUrl();
    const headers = getWhatsAppHeaders();

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone.replace(/\D/g, ''), // Ensure only digits
      type: 'text',
      text: {
        body: message,
      },
    };

    const response = await axios.post(url, payload, {
      headers,
      timeout: 10000, // 10 seconds timeout
    });

    const messageId = response.data?.messages?.[0]?.id;

    logger.info('WhatsApp message sent successfully', { phone, messageId });

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    logger.error('Failed to send WhatsApp message', error);

    const errorMessage = error instanceof axios.AxiosError ? error.response?.data?.message || error.message : String(error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send multiple messages with delay (to avoid rate limiting)
 */
export async function sendWhatsAppMessages(
  phone: string,
  messages: string[],
  delayMs = 1000
): Promise<{ success: boolean; messageIds: string[]; error?: string }> {
  try {
    const messageIds: string[] = [];

    for (const message of messages) {
      const result = await sendWhatsAppMessage(phone, message);

      if (!result.success) {
        return {
          success: false,
          messageIds,
          error: result.error,
        };
      }

      if (result.messageId) {
        messageIds.push(result.messageId);
      }

      // Add delay between messages
      if (messages.indexOf(message) < messages.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return {
      success: true,
      messageIds,
    };
  } catch (error) {
    logger.error('Failed to send multiple WhatsApp messages', error);

    return {
      success: false,
      messageIds: [],
      error: String(error),
    };
  }
}

/**
 * Format phone number for WhatsApp API
 * Expects: +254XXXXXXXXX format
 */
export function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\D/g, ''); // Remove non-digits

  // Handle Kenyan numbers
  if (cleaned.startsWith('254')) {
    return cleaned; // Already in international format
  }

  if (cleaned.startsWith('07') || cleaned.startsWith('01')) {
    return '254' + cleaned.substring(1); // Convert local to international
  }

  // Return as-is if already formatted
  return cleaned;
}

/**
 * Validate WhatsApp phone number
 */
export function isValidWhatsAppPhone(phone: string): boolean {
  const cleaned = formatPhoneForWhatsApp(phone);

  // Should be 12-13 digits (country code + number)
  return /^254[17]\d{8}$/.test(cleaned);
}
