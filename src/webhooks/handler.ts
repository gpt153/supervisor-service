import { Pool } from 'pg';

/**
 * WebhookHandler - Process GitHub webhook events
 * 
 * Responsibilities:
 * - Parse GitHub webhook payloads
 * - Extract project name from repository
 * - Store events in database for async processing
 * - Identify SCAR completion events
 */

export interface WebhookEvent {
  id: string;
  event_type: string;
  project_name: string | null;
  issue_number: number | null;
  payload: any;
  created_at: Date;
}

export interface ProcessedEvent {
  eventId: string;
  shouldTriggerVerification: boolean;
  projectName: string | null;
  issueNumber: number | null;
  eventType: string;
}

export class WebhookHandler {
  private pool: Pool;
  
  // Map repository names to project names
  private readonly repoToProject: Map<string, string> = new Map([
    ['consilio', 'consilio'],
    ['consilio-planning', 'consilio'],
    ['openhorizon.cc', 'openhorizon'],
    ['openhorizon-planning', 'openhorizon'],
    ['health-agent', 'health-agent'],
    ['health-agent-planning', 'health-agent'],
    ['odin', 'odin'],
    ['odin-planning', 'odin'],
    ['quiculum-monitor', 'quiculum-monitor'],
    ['quiculum-monitor-planning', 'quiculum-monitor'],
    ['supervisor-service', 'supervisor-service'],
    ['supervisor-service-planning', 'supervisor-service'],
  ]);
  
  constructor(pool: Pool) {
    this.pool = pool;
  }
  
  /**
   * Process incoming webhook event
   * 
   * @param eventType GitHub event type (issue_comment, issues, etc.)
   * @param payload Full GitHub webhook payload
   * @returns Processed event information
   */
  async processEvent(eventType: string, payload: any): Promise<ProcessedEvent> {
    // Extract project name from repository
    const projectName = this.extractProjectName(payload);
    
    // Extract issue number if present
    const issueNumber = this.extractIssueNumber(payload);
    
    // Store event in database
    const eventId = await this.storeEvent({
      eventType,
      projectName,
      issueNumber,
      payload,
    });
    
    // Check if this should trigger verification
    const shouldTriggerVerification = this.shouldTriggerVerification(eventType, payload);
    
    return {
      eventId,
      shouldTriggerVerification,
      projectName,
      issueNumber,
      eventType,
    };
  }
  
  /**
   * Extract project name from repository information
   */
  private extractProjectName(payload: any): string | null {
    const repoName = payload?.repository?.name;
    if (!repoName) {
      return null;
    }
    
    // Look up project name from repository name
    return this.repoToProject.get(repoName) || null;
  }
  
  /**
   * Extract issue number from payload
   */
  private extractIssueNumber(payload: any): number | null {
    const issueNumber = payload?.issue?.number || payload?.pull_request?.number;
    return issueNumber ? parseInt(issueNumber, 10) : null;
  }
  
  /**
   * Determine if event should trigger verification
   * 
   * Triggers on:
   * - SCAR commenting "Implementation complete"
   * - SCAR commenting "PR created"
   * - Issue closed with "completed" label
   */
  private shouldTriggerVerification(eventType: string, payload: any): boolean {
    // Only process comment events
    if (eventType !== 'issue_comment') {
      return false;
    }
    
    // Check if comment is from SCAR (github-actions bot)
    const commentUser = payload?.comment?.user?.login;
    if (commentUser !== 'github-actions[bot]' && commentUser !== 'scar-bot') {
      return false;
    }
    
    // Check comment body for completion indicators
    const commentBody = payload?.comment?.body || '';
    const completionIndicators = [
      'implementation complete',
      'pr created',
      'pull request created',
      '✅ implementation complete',
      'work completed',
    ];
    
    const lowerBody = commentBody.toLowerCase();
    return completionIndicators.some(indicator => lowerBody.includes(indicator));
  }
  
  /**
   * Store webhook event in database
   */
  private async storeEvent(data: {
    eventType: string;
    projectName: string | null;
    issueNumber: number | null;
    payload: any;
  }): Promise<string> {
    const query = `
      INSERT INTO webhook_events (event_type, project_name, issue_number, payload)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    
    const values = [
      data.eventType,
      data.projectName,
      data.issueNumber,
      JSON.stringify(data.payload),
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0].id;
  }
  
  /**
   * Mark event as processed
   */
  async markEventProcessed(eventId: string, error?: string): Promise<void> {
    const query = `
      UPDATE webhook_events
      SET processed = true,
          processed_at = NOW(),
          error_message = $2
      WHERE id = $1
    `;
    
    await this.pool.query(query, [eventId, error || null]);
  }
  
  /**
   * Get unprocessed events
   */
  async getUnprocessedEvents(limit: number = 100): Promise<WebhookEvent[]> {
    const query = `
      SELECT * FROM webhook_events
      WHERE processed = false
      ORDER BY created_at ASC
      LIMIT $1
    `;
    
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }
  
  /**
   * Get events for a specific project and issue
   */
  async getEventsForIssue(projectName: string, issueNumber: number): Promise<WebhookEvent[]> {
    const query = `
      SELECT * FROM webhook_events
      WHERE project_name = $1 AND issue_number = $2
      ORDER BY created_at DESC
    `;
    
    const result = await this.pool.query(query, [projectName, issueNumber]);
    return result.rows;
  }
}
