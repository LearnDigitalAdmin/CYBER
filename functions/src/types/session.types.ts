/**
 * Session Types
 * Defines interfaces for WhatsApp conversation sessions
 */

export interface Session {
  phone: string;
  language: 'en' | 'sw';
  currentState: string;
  context: Record<string, any>;
  lastActive: number; // timestamp
  createdAt: number; // timestamp
}

export interface SessionContext {
  nationalId?: string;
  tenantId?: string;
  rentAmount?: number;
  propertyDetails?: Record<string, any>;
  [key: string]: any;
}
