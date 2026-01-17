import { Router, Request, Response } from 'express';
import { Orchestrator } from '../orchestrator/Orchestrator';
import { SessionStore } from '../storage/SessionStore';

export interface WebRoutesOptions {
  orchestrator: Orchestrator;
  sessionStore: SessionStore;
}

export function createWebRoutes(options: WebRoutesOptions): Router {
  const router = Router();
  const { orchestrator, sessionStore } = options;

  const sseClients: Response[] = [];

  function broadcastSSE(event: string, data: any): void {
    const message = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
    sseClients.forEach((client, index) => {
      try {
        client.write(message);
      } catch (error) {
        sseClients.splice(index, 1);
      }
    });
  }

  router.get('/projects', async (_req: Request, res: Response) => {
    try {
      const sessions = await sessionStore.getAllSessions();
      
      const projects = sessions.map(session => ({
        name: session.project_name,
        sessionId: session.claude_session_id,
        sessionActive: !!session.claude_session_id,
        lastActive: session.last_active,
        issueCount: 0,
      }));

      res.json(projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  router.get('/projects/:name/status', async (req: Request, res: Response) => {
    try {
      const name = String(req.params.name);
      const session = await sessionStore.getSession(name);
      
      if (!session) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      res.json({
        name: session.project_name,
        sessionId: session.claude_session_id,
        sessionActive: !!session.claude_session_id,
        lastActive: session.last_active,
        createdAt: session.created_at,
        metadata: session.metadata,
      });
    } catch (error) {
      console.error('Error fetching project status:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  router.post('/projects/:name/verify', async (req: Request, res: Response) => {
    try {
      const name = String(req.params.name);
      
      await orchestrator.sendCommand(
        name,
        'Verify all SCAR work',
        {
          onComplete: async () => {
            broadcastSSE('activity', {
              timestamp: new Date().toISOString(),
              message: 'Verification completed for ' + name,
            });
          }
        }
      );

      broadcastSSE('activity', {
        timestamp: new Date().toISOString(),
        message: 'Verification started for ' + name,
      });

      res.json({ message: 'Verification started' });
    } catch (error) {
      console.error('Error triggering verification:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  router.get('/activity', async (_req: Request, res: Response) => {
    try {
      const activities = [
        {
          timestamp: new Date().toISOString(),
          message: 'System started',
        }
      ];

      res.json(activities);
    } catch (error) {
      console.error('Error fetching activity:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  router.get('/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    sseClients.push(res);

    res.write('event: connected\ndata: ' + JSON.stringify({ message: 'Connected' }) + '\n\n');

    req.on('close', () => {
      const index = sseClients.indexOf(res);
      if (index !== -1) {
        sseClients.splice(index, 1);
      }
    });
  });

  return router;
}
