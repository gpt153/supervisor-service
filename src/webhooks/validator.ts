import { Request } from 'express';
import crypto from 'crypto';

/**
 * WebhookValidator - GitHub webhook signature validation
 * 
 * Validates GitHub webhook signatures using HMAC SHA-256
 * to ensure webhooks are authentic and haven't been tampered with.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export class WebhookValidator {
  private secret: string;
  
  constructor(secret: string) {
    if (!secret) {
      throw new Error('Webhook secret is required');
    }
    this.secret = secret;
  }
  
  /**
   * Validate GitHub webhook signature
   * 
   * @param req Express request object
   * @param payload Raw request body (must be string or Buffer)
   * @returns ValidationResult indicating if signature is valid
   */
  validate(req: Request, payload: string | Buffer): ValidationResult {
    try {
      // Get signature from header
      const signature = req.headers['x-hub-signature-256'] as string;
      
      if (!signature) {
        return {
          valid: false,
          error: 'Missing X-Hub-Signature-256 header',
        };
      }
      
      // Calculate expected signature
      const hmac = crypto.createHmac('sha256', this.secret);
      const body = typeof payload === 'string' ? payload : payload.toString('utf8');
      hmac.update(body);
      const expectedSignature = 'sha256=' + hmac.digest('hex');
      
      // Compare signatures (constant-time comparison to prevent timing attacks)
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
      
      if (!isValid) {
        return {
          valid: false,
          error: 'Invalid signature',
        };
      }
      
      return { valid: true };
      
    } catch (error) {
      return {
        valid: false,
        error: 'Signature validation error: ' + (error instanceof Error ? error.message : String(error)),
      };
    }
  }
  
  /**
   * Extract event type from GitHub webhook headers
   */
  getEventType(req: Request): string | null {
    return (req.headers['x-github-event'] as string) || null;
  }
  
  /**
   * Get delivery ID from GitHub webhook headers
   */
  getDeliveryId(req: Request): string | null {
    return (req.headers['x-github-delivery'] as string) || null;
  }
}
