import express, { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { SessionStore } from './storage/SessionStore';
import { Orchestrator } from './orchestrator/Orchestrator';
import { WebhookHandler } from './webhooks/handler';
import { WebhookProcessor } from './webhooks/processor';
import { webhookValidationMiddleware } from './webhooks/middleware';
import { Pool } from 'pg';

/**
 * Supervisor Service - Entry Point
 * 
 * Responsibilities:
 * - Initialize database and session store
 * - Create orchestrator for project management
 * - Start HTTP server for health checks and webhooks
 * - Process GitHub webhooks
 * - Handle graceful shutdown
 */

let sessionStore: SessionStore | null = null;
let orchestrator: Orchestrator | null = null;
let webhookHandler: WebhookHandler | null = null;
let webhookProcessor: WebhookProcessor | null = null;
let dbPool: Pool | null = null;
let server: any = null;

async function startServer(): Promise<void> {
  try {
    console.log('Starting Supervisor Service...');
    
    // Initialize session store
    console.log('Connecting to database...');
    sessionStore = new SessionStore();
    await sessionStore.initialize();
    console.log('Database connected successfully');
    
    // Create database pool for webhooks
    dbPool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Initialize orchestrator
    console.log('Initializing orchestrator...');
    orchestrator = new Orchestrator({ sessionStore });
    await orchestrator.initialize();
    const activeCount = orchestrator.getActiveProjects().length;
    console.log('Orchestrator initialized with ' + activeCount + ' projects');
    
    // Initialize webhook components
    console.log('Initializing webhook processor...');
    webhookHandler = new WebhookHandler(dbPool);
    webhookProcessor = new WebhookProcessor(dbPool, orchestrator);
    
    // Start webhook event processing queue
    webhookProcessor.startProcessingQueue(30000); // Check every 30 seconds
    console.log('Webhook processor started');
    
    // Create Express app
    const app = express();
    
    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Request logging middleware
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(req.method + ' ' + req.path + ' ' + res.statusCode + ' - ' + duration + 'ms');
      });
      next();
    });
    
    // Health check endpoint
    app.get('/health', async (_req: Request, res: Response) => {
      try {
        // Check database connection
        if (!sessionStore) {
          throw new Error('Session store not initialized');
        }
        await sessionStore.getAllSessions();
        
        if (!orchestrator) {
          throw new Error('Orchestrator not initialized');
        }
        const activeProjects = orchestrator.getActiveProjects();
        
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'supervisor-service',
          version: '1.0.0',
          database: 'connected',
          activeProjects: activeProjects.length,
          projects: activeProjects,
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
    
    // Root endpoint
    app.get('/', (_req: Request, res: Response) => {
      res.json({
        service: 'supervisor-service',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/health',
          webhooks: '/webhooks/github',
        },
      });
    });
    
    // GitHub webhook endpoint
    app.post('/webhooks/github', webhookValidationMiddleware, async (req: Request, res: Response) => {
      try {
        const eventType = (req as any).githubEvent;
        const deliveryId = (req as any).githubDeliveryId;
        
        console.log(`Received GitHub webhook: ${eventType} (${deliveryId})`);
        
        // Quickly acknowledge receipt
        res.status(202).json({
          message: 'Webhook received',
          deliveryId,
          eventType,
        });
        
        // Process event asynchronously
        if (!webhookHandler) {
          console.error('Webhook handler not initialized');
          return;
        }
        
        const result = await webhookHandler.processEvent(eventType, req.body);
        
        console.log(`Webhook stored: ${result.eventId}, trigger verification: ${result.shouldTriggerVerification}`);
        
        // If this should trigger verification, it will be picked up by the background processor
        if (result.shouldTriggerVerification) {
          console.log(`Verification will be triggered for ${result.projectName} #${result.issueNumber}`);
        }
        
      } catch (error) {
        console.error('Error processing webhook:', error);
        // Don't send error response - we already sent 202
      }
    });
    
    // Error handling middleware
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    });
    
    // 404 handler
    app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path,
      });
    });
    
    // Start server
    server = app.listen(config.port, () => {
      console.log('Supervisor Service listening on port ' + config.port);
      console.log('Health check: http://localhost:' + config.port + '/health');
      console.log('Webhook endpoint: http://localhost:' + config.port + '/webhooks/github');
      console.log('Service started successfully');
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('Shutting down gracefully...');
  
  try {
    // Stop webhook processor
    if (webhookProcessor) {
      webhookProcessor.stopProcessingQueue();
      console.log('Webhook processor stopped');
    }
    
    // Close HTTP server
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => {
          console.log('HTTP server closed');
          resolve();
        });
      });
    }
    
    // Shutdown orchestrator
    if (orchestrator) {
      await orchestrator.shutdown();
      console.log('Orchestrator shut down');
    }
    
    // Close database connections
    if (sessionStore) {
      await sessionStore.close();
      console.log('Session store closed');
    }
    
    if (dbPool) {
      await dbPool.end();
      console.log('Database pool closed');
    }
    
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  shutdown();
});

// Start the server
startServer();
