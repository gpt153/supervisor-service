import express, { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { SessionStore } from './storage/SessionStore';
import { Orchestrator } from './orchestrator/Orchestrator';

/**
 * Supervisor Service - Entry Point
 * 
 * Responsibilities:
 * - Initialize database and session store
 * - Create orchestrator for project management
 * - Start HTTP server for health checks and webhooks
 * - Handle graceful shutdown
 */

let sessionStore: SessionStore | null = null;
let orchestrator: Orchestrator | null = null;
let server: any = null;

async function startServer(): Promise<void> {
  try {
    console.log('Starting Supervisor Service...');
    
    // Initialize session store
    console.log('Connecting to database...');
    sessionStore = new SessionStore();
    await sessionStore.initialize();
    console.log('Database connected successfully');
    
    // Initialize orchestrator
    console.log('Initializing orchestrator...');
    orchestrator = new Orchestrator({ sessionStore });
    await orchestrator.initialize();
    const activeCount = orchestrator.getActiveProjects().length;
    console.log('Orchestrator initialized with ' + activeCount + ' projects');
    
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
        },
      });
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
    
    // Close database connection
    if (sessionStore) {
      await sessionStore.close();
      console.log('Database connection closed');
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
