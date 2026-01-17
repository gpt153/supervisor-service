import { Pool } from 'pg';
import { config } from '../config';

export interface Session {
  id: string;
  project_name: string;
  claude_session_id: string | null;
  created_at: Date;
  last_active: Date;
  metadata: Record<string, any>;
}

export interface CreateSessionData {
  projectName: string;
  claudeSessionId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateSessionData {
  claudeSessionId?: string;
  lastActive?: Date;
  metadata?: Record<string, any>;
}

/**
 * SessionStore - PostgreSQL-backed session persistence
 * 
 * Manages storage and retrieval of Claude Code session data
 */
export class SessionStore {
  private pool: Pool;
  
  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  
  /**
   * Initialize database connection and verify schema
   */
  async initialize(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
    } catch (error) {
      throw new Error('Failed to connect to database: ' + error);
    }
  }
  
  /**
   * Create a new session record
   */
  async createSession(data: CreateSessionData): Promise<Session> {
    const query = `
      INSERT INTO supervisor_sessions (project_name, claude_session_id, metadata)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_name) DO UPDATE
        SET claude_session_id = EXCLUDED.claude_session_id,
            metadata = EXCLUDED.metadata,
            last_active = NOW()
      RETURNING *
    `;
    
    const values = [
      data.projectName,
      data.claudeSessionId || null,
      JSON.stringify(data.metadata || {}),
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }
  
  /**
   * Get session by project name
   */
  async getSession(projectName: string): Promise<Session | null> {
    const query = `
      SELECT * FROM supervisor_sessions
      WHERE project_name = $1
    `;
    
    const result = await this.pool.query(query, [projectName]);
    return result.rows[0] || null;
  }
  
  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<Session[]> {
    const query = `
      SELECT * FROM supervisor_sessions
      ORDER BY last_active DESC
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }
  
  /**
   * Update session
   */
  async updateSession(projectName: string, data: UpdateSessionData): Promise<Session | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCounter = 1;
    
    if (data.claudeSessionId !== undefined) {
      updates.push('claude_session_id = $' + paramCounter++);
      values.push(data.claudeSessionId);
    }
    
    if (data.lastActive !== undefined) {
      updates.push('last_active = $' + paramCounter++);
      values.push(data.lastActive);
    }
    
    if (data.metadata !== undefined) {
      updates.push('metadata = $' + paramCounter++);
      values.push(JSON.stringify(data.metadata));
    }
    
    if (updates.length === 0) {
      return this.getSession(projectName);
    }
    
    values.push(projectName);
    
    const query = `
      UPDATE supervisor_sessions
      SET ` + updates.join(', ') + `
      WHERE project_name = $` + paramCounter + `
      RETURNING *
    `;
    
    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }
  
  /**
   * Delete session
   */
  async deleteSession(projectName: string): Promise<boolean> {
    const query = `
      DELETE FROM supervisor_sessions
      WHERE project_name = $1
    `;
    
    const result = await this.pool.query(query, [projectName]);
    return (result.rowCount ?? 0) > 0;
  }
  
  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
