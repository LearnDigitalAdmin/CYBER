/**
 * WhatsApp Types
 * Defines interfaces for WhatsApp message handling
 */

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text: {
    body: string;
  };
  type: 'text';
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
    }>;
  }>;
}

export interface WhatsAppSendPayload {
  messaging_product: string;
  to: string;
  type: string;
  text?: {
    body: string;
  };
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}
