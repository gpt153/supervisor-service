import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { Orchestrator } from '../orchestrator/Orchestrator';
import { SessionStore } from '../storage/SessionStore';
import { VerificationRunner } from '../verification/VerificationRunner';
import { GitHubAdapter } from '../adapters/GitHubAdapter';
import { createAuthMiddleware, AuthenticatedRequest } from './auth';

export interface ApiRoutesOptions {
  orchestrator: Orchestrator;
  sessionStore: SessionStore;
  verificationRunner: VerificationRunner;
  githubAdapter: GitHubAdapter;
  jwtSecret: string;
  apiKeys?: string[];
}

export function createApiRoutes(options: ApiRoutesOptions): Router {
  const router = Router();
  const { orchestrator, sessionStore, githubAdapter, jwtSecret, apiKeys } = options;

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later' }
  });

  router.use(limiter);

  const authMiddleware = createAuthMiddleware({ jwtSecret, apiKeys });
  router.use(authMiddleware);

  router.get('/projects', async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const sessions = await sessionStore.getAllSessions();
      
      const projects = sessions.map(session => ({
        name: session.project_name,
        sessionId: session.claude_session_id,
        sessionActive: !!session.claude_session_id,
        lastActive: session.last_active,
        createdAt: session.created_at,
      }));

      res.json({ projects, count: projects.length });
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  router.get('/projects/:name/status', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const name = String(req.params.name);
      const session = await sessionStore.getSession(name);
      
      if (!session) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      res.json({
        project: {
          name: session.project_name,
          sessionId: session.claude_session_id,
          sessionActive: !!session.claude_session_id,
          lastActive: session.last_active,
          createdAt: session.created_at,
          metadata: session.metadata,
        }
      });
    } catch (error) {
      console.error('Error fetching project status:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  router.post('/projects/:name/command', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const name = String(req.params.name);
      const { command } = req.body;

      if (!command) {
        res.status(400).json({ error: 'Command is required' });
        return;
      }

      let responseText = '';

      await orchestrator.sendCommand(
        name,
        command,
        {
          onStreamChunk: (chunk) => {
            responseText += chunk;
          },
          onComplete: () => {
            res.json({ 
              success: true, 
              response: responseText 
            });
          },
          onError: (error) => {
            res.status(500).json({ 
              error: error.message 
            });
          }
        }
      );
    } catch (error) {
      console.error('Error executing command:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  router.get('/projects/:name/issues', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const name = String(req.params.name);
      
      const issue = await githubAdapter.getIssue('gpt153', name, 1);

      res.json({ 
        project: name,
        issues: [issue],
        count: 1,
        note: 'Limited implementation - full issue listing coming soon'
      });
    } catch (error) {
      console.error('Error fetching issues:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  router.post('/projects/:name/verify/:issueNumber', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const name = String(req.params.name);
      const issueNumber = String(req.params.issueNumber);

      await orchestrator.sendCommand(
        name,
        'Verify issue #' + issueNumber,
        {}
      );

      res.json({ 
        success: true,
        message: 'Verification scheduled'
      });
    } catch (error) {
      console.error('Error scheduling verification:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  router.get('/verification/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = String(req.params.id);

      res.json({ 
        verification: {
          id,
          status: 'pending',
          note: 'Verification tracking coming soon'
        }
      });
    } catch (error) {
      console.error('Error fetching verification:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  router.get('/health', (_req: AuthenticatedRequest, res: Response) => {
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  return router;
}
