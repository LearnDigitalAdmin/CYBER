/**
 * WhatsApp Webhook Verification
 * Handles GET request from Meta for webhook verification
 */

import { Request, Response } from 'express';
import { WHATSAPP_VERIFY_TOKEN } from '../config/whatsapp.config';
import { logger } from '../utils/logger';

/**
 * Handle webhook verification from Meta
 * Meta sends: GET /webhook?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=XXX
 * We need to return the hub.challenge to confirm ownership
 */
export function handleWebhookVerification(req: Request, res: Response): void {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Validate parameters
    if (mode !== 'subscribe') {
      logger.warn('Invalid webhook mode', { mode });
      res.status(400).send('Invalid mode');
      return;
    }

    if (token !== WHATSAPP_VERIFY_TOKEN.value()) {
      logger.warn('Invalid webhook verification token');
      res.status(403).send('Invalid verify token');
      return;
    }

    if (!challenge) {
      logger.warn('Missing webhook challenge');
      res.status(400).send('Missing challenge');
      return;
    }

    logger.info('Webhook verification successful');
    res.status(200).send(challenge);
  } catch (error) {
    logger.error('Webhook verification error', error);
    res.status(500).send('Internal server error');
  }
}
