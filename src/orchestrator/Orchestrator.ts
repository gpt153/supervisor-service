import { ProjectManager } from '../managers/ProjectManager';
import { SessionStore } from '../storage/SessionStore';

export interface OrchestratorOptions {
  sessionStore: SessionStore;
}

/**
 * Orchestrator - Coordinates multiple ProjectManager instances
 * 
 * Responsibilities:
 * - Maintain registry of active projects
 * - Route commands to correct ProjectManager
 * - Initialize/resume sessions from database
 * - Coordinate session lifecycle
 */
export class Orchestrator {
  private sessionStore: SessionStore;
  private projects: Map<string, ProjectManager>;
  
  constructor(options: OrchestratorOptions) {
    this.sessionStore = options.sessionStore;
    this.projects = new Map();
  }
  
  /**
   * Initialize orchestrator and load existing sessions
   */
  async initialize(): Promise<void> {
    // Load all existing sessions from database
    const sessions = await this.sessionStore.getAllSessions();
    
    for (const session of sessions) {
      // Create ProjectManager with existing session ID
      const manager = new ProjectManager({
        projectName: session.project_name,
        sessionId: session.claude_session_id || undefined,
      });
      
      this.projects.set(session.project_name, manager);
    }
  }
  
  /**
   * Get or create ProjectManager for a project
   */
  async getProjectManager(projectName: string): Promise<ProjectManager> {
    // Check if already loaded
    let manager = this.projects.get(projectName);
    
    if (!manager) {
      // Try to load from database
      const session = await this.sessionStore.getSession(projectName);
      
      manager = new ProjectManager({
        projectName,
        sessionId: session?.claude_session_id || undefined,
      });
      
      this.projects.set(projectName, manager);
      
      // Create session record if doesn't exist
      if (!session) {
        await this.sessionStore.createSession({
          projectName,
          claudeSessionId: undefined,
          metadata: {},
        });
      }
    }
    
    return manager;
  }
  
  /**
   * Send command to a specific project
   */
  async sendCommand(
    projectName: string,
    command: string,
    callbacks?: {
      onStreamChunk?: (chunk: string) => void;
      onComplete?: (response: string) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<string> {
    const manager = await this.getProjectManager(projectName);
    
    const response = await manager.sendCommand({
      command,
      ...callbacks,
    });
    
    // Update session in database
    const sessionId = manager.getSessionId();
    if (sessionId) {
      await this.sessionStore.updateSession(projectName, {
        claudeSessionId: sessionId,
        lastActive: new Date(),
      });
    }
    
    return response;
  }
  
  /**
   * Get list of all active projects
   */
  getActiveProjects(): string[] {
    return Array.from(this.projects.keys());
  }
  
  /**
   * Get project manager (if loaded)
   */
  getLoadedProjectManager(projectName: string): ProjectManager | undefined {
    return this.projects.get(projectName);
  }
  
  /**
   * Shutdown orchestrator and cleanup
   */
  async shutdown(): Promise<void> {
    // Save all active sessions
    for (const [projectName, manager] of this.projects.entries()) {
      const sessionId = manager.getSessionId();
      if (sessionId) {
        await this.sessionStore.updateSession(projectName, {
          claudeSessionId: sessionId,
          lastActive: new Date(),
        });
      }
    }
    
    this.projects.clear();
  }
}
