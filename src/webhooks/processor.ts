import { Pool } from 'pg';
import { WebhookHandler } from './handler';
import { VerificationRunner } from '../verification/VerificationRunner';
import { GitHubAdapter } from '../adapters/GitHubAdapter';
import { Orchestrator } from '../orchestrator/Orchestrator';
import { config } from '../config';

/**
 * WebhookProcessor - Async processing of webhook events
 * 
 * Responsibilities:
 * - Process webhook events from queue
 * - Trigger verification when SCAR completes
 * - Post verification results to GitHub
 * - Handle errors and retries
 */

export class WebhookProcessor {
  private handler: WebhookHandler;
  private verificationRunner: VerificationRunner;
  private githubAdapter: GitHubAdapter;
  private isProcessing = false;
  
  constructor(pool: Pool, _orchestrator: Orchestrator) {
    this.handler = new WebhookHandler(pool);
    this.verificationRunner = new VerificationRunner(pool);
    this.githubAdapter = new GitHubAdapter();
  }
  
  /**
   * Process a webhook event (async)
   */
  async processWebhookEvent(eventId: string, projectName: string, issueNumber: number): Promise<void> {
    console.log(`Processing webhook event ${eventId}: ${projectName} #${issueNumber}`);
    
    try {
      // Run verification
      const workspaceRoot = `${config.paths.archonWorkspaces}/${projectName}`;
      
      const result = await this.verificationRunner.runVerification({
        projectName,
        issueNumber,
        workspaceRoot,
      });
      
      console.log(`Verification completed with status: ${result.status}`);
      
      // Post results to GitHub
      await this.postVerificationResults(projectName, issueNumber, result);
      
      // Mark event as processed
      await this.handler.markEventProcessed(eventId);
      
      console.log(`Webhook event ${eventId} processed successfully`);
      
    } catch (error) {
      console.error(`Error processing webhook event ${eventId}:`, error);
      
      // Mark event as processed with error
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.handler.markEventProcessed(eventId, errorMessage);
    }
  }
  
  /**
   * Post verification results to GitHub as comment
   */
  private async postVerificationResults(
    projectName: string,
    issueNumber: number,
    result: any
  ): Promise<void> {
    try {
      // Get repository information from webhook events
      const events = await this.handler.getEventsForIssue(projectName, issueNumber);
      if (events.length === 0) {
        console.warn('No webhook events found for issue, cannot post comment');
        return;
      }
      
      const payload = events[0].payload;
      const repoInfo = GitHubAdapter.parseRepoInfo(payload);
      
      if (!repoInfo) {
        console.warn('Could not parse repository info from webhook payload');
        return;
      }
      
      // Format verification results as markdown
      const markdown = this.verificationRunner.formatAsMarkdown(result);
      
      // Add header
      const commentBody = `## 🤖 Automated Verification Results\n\n${markdown}\n\n---\n*Verification triggered by supervisor-service*`;
      
      // Post comment
      await this.githubAdapter.postIssueComment({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        issueNumber,
        body: commentBody,
      });
      
      console.log(`Posted verification results to ${repoInfo.owner}/${repoInfo.repo}#${issueNumber}`);
      
      // Add labels based on result
      const labels: string[] = [];
      if (result.status === 'passed') {
        labels.push('verification-passed');
      } else if (result.status === 'failed') {
        labels.push('verification-failed');
      } else if (result.status === 'partial') {
        labels.push('verification-partial');
      }
      
      if (labels.length > 0) {
        await this.githubAdapter.addLabels(repoInfo.owner, repoInfo.repo, issueNumber, labels);
      }
      
    } catch (error) {
      console.error('Error posting verification results:', error);
      // Don't throw - we still want to mark event as processed
    }
  }
  
  /**
   * Start processing unprocessed events (background job)
   */
  async startProcessingQueue(intervalMs: number = 30000): Promise<void> {
    if (this.isProcessing) {
      console.warn('Event processing already running');
      return;
    }
    
    this.isProcessing = true;
    
    const processLoop = async () => {
      if (!this.isProcessing) {
        return;
      }
      
      try {
        // Get unprocessed events
        const events = await this.handler.getUnprocessedEvents(10);
        
        if (events.length > 0) {
          console.log(`Processing ${events.length} webhook events`);
          
          // Process events in parallel (with concurrency limit)
          const limit = 3;
          for (let i = 0; i < events.length; i += limit) {
            const batch = events.slice(i, i + limit);
            await Promise.all(
              batch.map(event => {
                if (event.project_name && event.issue_number) {
                  return this.processWebhookEvent(
                    event.id,
                    event.project_name,
                    event.issue_number
                  );
                }
                return Promise.resolve();
              })
            );
          }
        }
      } catch (error) {
        console.error('Error in event processing loop:', error);
      }
      
      // Schedule next iteration
      setTimeout(processLoop, intervalMs);
    };
    
    // Start the loop
    console.log(`Starting webhook event processor (checking every ${intervalMs}ms)`);
    processLoop();
  }
  
  /**
   * Stop processing events
   */
  stopProcessingQueue(): void {
    console.log('Stopping webhook event processor');
    this.isProcessing = false;
  }
}
