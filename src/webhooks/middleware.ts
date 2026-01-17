import { Request, Response, NextFunction } from 'express';
import { WebhookValidator } from './validator';
import { config } from '../config';

/**
 * Webhook signature validation middleware
 * 
 * Validates GitHub webhook signatures before processing
 */

let validator: WebhookValidator | null = null;

export function webhookValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Initialize validator if not already done
    if (!validator) {
      if (!config.github.webhookSecret) {
        console.error('GITHUB_WEBHOOK_SECRET not configured');
        res.status(500).json({ error: 'Webhook secret not configured' });
        return;
      }
      validator = new WebhookValidator(config.github.webhookSecret);
    }
    
    // Get raw body (should be available from express.json())
    const rawBody = JSON.stringify(req.body);
    
    // Validate signature
    const validationResult = validator.validate(req, rawBody);
    
    if (!validationResult.valid) {
      console.warn('Webhook signature validation failed:', validationResult.error);
      res.status(401).json({
        error: 'Signature validation failed',
        message: validationResult.error,
      });
      return;
    }
    
    // Extract event type and delivery ID
    const eventType = validator.getEventType(req);
    const deliveryId = validator.getDeliveryId(req);
    
    // Attach to request for downstream handlers
    (req as any).githubEvent = eventType;
    (req as any).githubDeliveryId = deliveryId;
    
    console.log(`Webhook received: ${eventType} (${deliveryId})`);
    next();
    
  } catch (error) {
    console.error('Webhook validation error:', error);
    res.status(500).json({
      error: 'Validation error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Skip validation middleware (for development/testing)
 */
export function webhookSkipValidationMiddleware(req: Request, _res: Response, next: NextFunction): void {
  console.warn('WARNING: Webhook signature validation SKIPPED');
  
  const eventType = req.headers['x-github-event'] as string;
  const deliveryId = req.headers['x-github-delivery'] as string;
  
  (req as any).githubEvent = eventType;
  (req as any).githubDeliveryId = deliveryId;
  
  next();
}
