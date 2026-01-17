import { query } from '@anthropic-ai/claude-agent-sdk';
import { buildMcpServers, getProjectWorkingDirectory } from './buildMcpServers';

export interface ProjectManagerOptions {
  projectName: string;
  sessionId?: string; // For resuming existing sessions
}

export interface SendCommandOptions {
  command: string;
  onStreamChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

/**
 * ProjectManager - Manages a single project's Claude Code instance
 * 
 * Uses @anthropic-ai/claude-agent-sdk to:
 * - Create new Claude Code sessions
 * - Resume existing sessions after restart
 * - Send commands and stream responses
 * - Configure MCP servers (GitHub, Archon)
 * - Isolate working directory per project
 */
export class ProjectManager {
  private projectName: string;
  private sessionId?: string;
  private workingDirectory: string;
  private mcpServers: Record<string, any>;
  
  constructor(options: ProjectManagerOptions) {
    this.projectName = options.projectName;
    this.sessionId = options.sessionId;
    this.workingDirectory = getProjectWorkingDirectory(options.projectName);
    this.mcpServers = buildMcpServers(options.projectName);
  }
  
  /**
   * Send a command to this project's Claude Code instance
   * Automatically creates or resumes session
   */
  async sendCommand(options: SendCommandOptions): Promise<string> {
    const {
      command,
      onStreamChunk,
      onComplete,
      onError,
    } = options;
    
    let fullResponse = '';
    let capturedSessionId: string | undefined;
    
    try {
      // Use Claude Agent SDK's query function
      const queryResult = query({
        prompt: command,
        options: {
          // Session resume support
          resume: this.sessionId,
          
          // Working directory isolation
          cwd: this.workingDirectory,
          
          // MCP server configuration
          mcpServers: this.mcpServers,
          
          // Enable session persistence
          persistSession: true,
        },
      });
      
      // Stream messages
      for await (const message of queryResult) {
        // Capture session ID from any message
        if ('session_id' in message && message.session_id) {
          capturedSessionId = message.session_id;
        }
        
        // Handle different message types
        if (message.type === 'assistant') {
          // Extract text from BetaMessage
          const betaMessage = message.message;
          const textBlocks = betaMessage.content.filter((block: any) => block.type === 'text');
          const text = textBlocks.map((block: any) => block.text).join('');
          
          fullResponse += text;
          if (onStreamChunk && text) {
            onStreamChunk(text);
          }
        } else if (message.type === 'result') {
          // Final result message
          if (message.subtype === 'success') {
            fullResponse = message.result || fullResponse;
          } else {
            // Error occurred - subtype tells us what went wrong
            const errorMsg = 'Result subtype: ' + String(message.subtype);
            throw new Error('Query failed: ' + errorMsg);
          }
        }
      }
      
      // Save session ID for future resume
      if (capturedSessionId) {
        this.sessionId = capturedSessionId;
      }
      
      if (onComplete) {
        onComplete(fullResponse);
      }
      
      return fullResponse;
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(err);
      }
      throw err;
    }
  }
  
  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }
  
  /**
   * Get project name
   */
  getProjectName(): string {
    return this.projectName;
  }
  
  /**
   * Get working directory
   */
  getWorkingDirectory(): string {
    return this.workingDirectory;
  }
  
  /**
   * Check if session exists (has been initialized)
   */
  hasSession(): boolean {
    return this.sessionId !== undefined;
  }
}
