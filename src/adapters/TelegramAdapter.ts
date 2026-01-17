import { Telegraf, Context } from 'telegraf';
import { Orchestrator } from '../orchestrator/Orchestrator';
import { SessionStore } from '../storage/SessionStore';

export interface TelegramAdapterOptions {
  botToken: string;
  orchestrator: Orchestrator;
  sessionStore: SessionStore;
}

interface TelegramSession {
  chatId: number;
  currentProject?: string;
  lastCommand?: string;
}

/**
 * TelegramAdapter - Telegram Bot interface for supervisor-service
 * 
 * Responsibilities:
 * - Handle incoming Telegram messages
 * - Route commands to Orchestrator
 * - Stream responses back to Telegram
 * - Manage per-chat sessions
 */
export class TelegramAdapter {
  private bot: Telegraf;
  private orchestrator: Orchestrator;
  private sessionStore: SessionStore;
  private sessions: Map<number, TelegramSession>;
  
  constructor(options: TelegramAdapterOptions) {
    this.bot = new Telegraf(options.botToken);
    this.orchestrator = options.orchestrator;
    this.sessionStore = options.sessionStore;
    this.sessions = new Map();
    
    this.setupHandlers();
  }
  
  /**
   * Setup Telegram bot command handlers
   */
  private setupHandlers(): void {
    // Start command
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '👋 Welcome to Supervisor Service Bot!\n\n' +
        'I help you manage your projects through Claude Code.\n\n' +
        '*Available Commands:*\n' +
        '/status - Show status of all projects\n' +
        '/verify - Verify current project\n' +
        '/switch <project> - Switch to a project\n' +
        '/help - Show this help message\n\n' +
        '*Usage:*\n' +
        'Just send me a command and I will route it to your current project.',
        { parse_mode: 'Markdown' }
      );
    });
    
    // Help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '*Supervisor Service Bot - Help*\n\n' +
        '*Commands:*\n' +
        '/start - Welcome message\n' +
        '/status - Show status of all projects\n' +
        '/verify - Verify SCAR work on current project\n' +
        '/switch <project> - Switch active project\n' +
        '/current - Show current project\n' +
        '/help - Show this help\n\n' +
        '*Project Commands:*\n' +
        'Send any text to execute it on your current project.\n' +
        'Example: "Show me the latest issues"\n\n' +
        '*Project Switching:*\n' +
        '/switch consilio\n' +
        'switch to openhorizon\n\n' +
        '*Verification:*\n' +
        '/verify - Verify all SCAR work\n' +
        '/verify #123 - Verify specific issue',
        { parse_mode: 'Markdown' }
      );
    });
    
    // Status command
    this.bot.command('status', async (ctx) => {
      try {
        await ctx.reply('🔍 Fetching project status...');
        
        // Get all sessions from database
        const sessions = await this.sessionStore.getAllSessions();
        
        if (sessions.length === 0) {
          await ctx.reply('No active projects found.');
          return;
        }
        
        let statusMessage = '*Project Status:*\n\n';
        
        for (const session of sessions) {
          const lastActive = session.last_active 
            ? new Date(session.last_active).toLocaleString()
            : 'Never';
          
          const sessionStatus = session.claude_session_id ? 'Active' : 'None';
          
          statusMessage += `📂 *${session.project_name}*\n`;
          statusMessage += `   Last Active: ${lastActive}\n`;
          statusMessage += `   Session: ${sessionStatus}\n\n`;
        }
        
        await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error fetching status:', error);
        await ctx.reply(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
    
    // Current project command
    this.bot.command('current', async (ctx) => {
      if (!ctx.chat) return;
      const session = this.getSession(ctx.chat.id);
      
      if (!session.currentProject) {
        await ctx.reply(
          'No project selected.\n\nUse /switch <project> to select a project.',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      await ctx.reply(
        `📂 Current project: *${session.currentProject}*`,
        { parse_mode: 'Markdown' }
      );
    });
    
    // Switch project command
    this.bot.command('switch', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      
      if (args.length === 0) {
        await ctx.reply('Usage: /switch <project-name>');
        return;
      }
      
      const projectName = args.join(' ');
      await this.switchProject(ctx, projectName);
    });
    
    // Verify command
    this.bot.command('verify', async (ctx) => {
      if (!ctx.chat) return;
      const session = this.getSession(ctx.chat.id);
      
      if (!session.currentProject) {
        await ctx.reply('Please select a project first using /switch <project>');
        return;
      }
      
      const args = ctx.message.text.split(' ').slice(1);
      const issueNumber = args[0] ? args[0].replace('#', '') : undefined;
      
      const command = issueNumber 
        ? `Verify issue #${issueNumber}`
        : 'Verify all SCAR work';
      
      await this.executeCommand(ctx, command);
    });
    
    // Handle text messages
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      
      // Skip if it is a command (already handled)
      if (text.startsWith('/')) {
        return;
      }
      
      // Check for "switch to X" pattern
      const switchMatch = text.match(/^switch\s+to\s+(.+)$/i);
      if (switchMatch) {
        await this.switchProject(ctx, switchMatch[1]);
        return;
      }
      
      // Execute as command on current project
      await this.executeCommand(ctx, text);
    });
    
    // Error handler
    this.bot.catch((err, ctx) => {
      console.error('Telegram bot error:', err);
      ctx.reply(`An error occurred: ${err instanceof Error ? err.message : 'Unknown error'}`);
    });
  }
  
  /**
   * Get or create session for a chat
   */
  private getSession(chatId: number): TelegramSession {
    let session = this.sessions.get(chatId);
    
    if (!session) {
      session = { chatId };
      this.sessions.set(chatId, session);
    }
    
    return session;
  }
  
  /**
   * Switch to a different project
   */
  private async switchProject(ctx: Context, projectName: string): Promise<void> {
    if (!ctx.chat) return;
      const session = this.getSession(ctx.chat.id);
    
    try {
      // Verify project exists by trying to get its manager
      await this.orchestrator.getProjectManager(projectName);
      
      session.currentProject = projectName;
      
      await ctx.reply(
        `Switched to project: *${projectName}*\n\n` +
        'You can now send commands for this project.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      await ctx.reply(
        `Failed to switch to project: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        'Use /status to see available projects.'
      );
    }
  }
  
  /**
   * Execute a command on the current project
   */
  private async executeCommand(ctx: Context, command: string): Promise<void> {
    if (!ctx.chat) return;
      const session = this.getSession(ctx.chat.id);
    
    if (!session.currentProject) {
      await ctx.reply(
        'No project selected.\n\n' +
        'Use /switch <project> to select a project first.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    try {
      // Send "typing" action
      await ctx.sendChatAction('typing');
      
      let responseBuffer = '';
      let lastUpdate = Date.now();
      
      await this.orchestrator.sendCommand(
        session.currentProject,
        command,
        {
          onStreamChunk: async (chunk) => {
            responseBuffer += chunk;
            
            // Send updates every 2 seconds
            const now = Date.now();
            if (now - lastUpdate > 2000) {
              await ctx.sendChatAction('typing');
              lastUpdate = now;
            }
          },
          onComplete: async (fullResponse) => {
            // Format response for Telegram
            const formatted = this.formatResponse(fullResponse);
            
            // Split into chunks if too long (Telegram limit: 4096 chars)
            const chunks = this.splitMessage(formatted, 4000);
            
            for (const chunk of chunks) {
              await ctx.reply(chunk, { parse_mode: 'Markdown' });
            }
          },
          onError: async (error) => {
            await ctx.reply(
              `Error executing command:\n${error.message}`,
              { parse_mode: 'Markdown' }
            );
          }
        }
      );
      
      session.lastCommand = command;
    } catch (error) {
      console.error('Error executing command:', error);
      await ctx.reply(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  /**
   * Format response for Telegram markdown
   */
  private formatResponse(response: string): string {
    // Escape special markdown characters
    let formatted = response
      .replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
    
    // Preserve code blocks
    formatted = formatted.replace(/```([^`]+)```/g, (_match, code) => {
      return '```\n' + code.replace(/\\/g, '') + '\n```';
    });
    
    return formatted;
  }
  
  /**
   * Split message into chunks for Telegram
   */
  private splitMessage(message: string, maxLength: number): string[] {
    if (message.length <= maxLength) {
      return [message];
    }
    
    const chunks: string[] = [];
    let currentChunk = '';
    
    const lines = message.split('\n');
    
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        
        // If single line is too long, split it
        if (line.length > maxLength) {
          for (let i = 0; i < line.length; i += maxLength) {
            chunks.push(line.substring(i, i + maxLength));
          }
        } else {
          currentChunk = line;
        }
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  /**
   * Start the Telegram bot
   */
  async start(): Promise<void> {
    console.log('Starting Telegram bot...');
    await this.bot.launch();
    console.log('Telegram bot started successfully');
    
    // Enable graceful stop
    process.once('SIGINT', () => this.stop());
    process.once('SIGTERM', () => this.stop());
  }
  
  /**
   * Stop the Telegram bot
   */
  async stop(): Promise<void> {
    console.log('Stopping Telegram bot...');
    this.bot.stop();
    console.log('Telegram bot stopped');
  }
}
