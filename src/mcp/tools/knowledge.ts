import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolContext } from '../server';

const execAsync = promisify(exec);

const SUPERVISOR_ROOT = '/home/samuel/supervisor';
const DOCS_PATH = join(SUPERVISOR_ROOT, 'docs');
const LEARNINGS_PATH = join(DOCS_PATH, 'supervisor-learnings/learnings');

export function registerKnowledgeTools(context: ToolContext): void {
  context.registerTool(
    {
      name: 'search_learnings',
      description: 'Search supervisor learnings by keyword or category',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          category: {
            type: 'string',
            description: 'Filter by category (optional)',
            enum: [
              'context-management',
              'github-automation',
              'bmad-workflow',
              'scar-integration',
              'template-issues',
              'git-operations',
              'tool-usage',
              'project-setup',
            ],
          },
        },
        required: ['query'],
      },
    },
    async (args: any) => {
      try {
        let grepCommand = 'grep -r -i "' + args.query + '" .';
        
        if (args.category) {
          grepCommand += ' | grep "category: ' + args.category + '"';
        }
        
        const { stdout } = await execAsync(grepCommand, {
          cwd: LEARNINGS_PATH,
          maxBuffer: 1024 * 1024 * 5,
        }).catch(() => ({ stdout: '' }));
        
        const results = stdout.trim().split('\n').filter(l => l);
        
        const files = new Set<string>();
        results.forEach(line => {
          const match = line.match(/^([^:]+):/);
          if (match) {
            files.add(match[1]);
          }
        });
        
        const learnings = await Promise.all(
          Array.from(files).slice(0, 10).map(async (file) => {
            const content = await readFile(join(LEARNINGS_PATH, file), 'utf-8');
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const categoryMatch = content.match(/^category:\s+(.+)$/m);
            
            return {
              filename: file,
              title: titleMatch ? titleMatch[1] : file,
              category: categoryMatch ? categoryMatch[1] : 'unknown',
            };
          })
        );
        
        return {
          success: true,
          query: args.query,
          count: learnings.length,
          learnings,
        };
      } catch (error) {
        throw new Error('Failed to search learnings: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'read_learning',
      description: 'Read specific learning document',
      inputSchema: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'Learning filename (e.g., "006-never-trust-scar-verify-always.md")',
          },
        },
        required: ['filename'],
      },
    },
    async (args: any) => {
      try {
        const content = await readFile(join(LEARNINGS_PATH, args.filename), 'utf-8');
        
        return {
          success: true,
          filename: args.filename,
          content,
        };
      } catch (error) {
        throw new Error('Failed to read learning: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'list_docs',
      description: 'List documentation files',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'File pattern (optional, e.g., "scar-*")',
          },
        },
      },
    },
    async (args: any) => {
      try {
        const files = await readdir(DOCS_PATH);
        let docFiles = files.filter(f => f.endsWith('.md'));
        
        if (args.pattern) {
          const pattern = args.pattern.replace('*', '.*');
          const regex = new RegExp(pattern, 'i');
          docFiles = docFiles.filter(f => regex.test(f));
        }
        
        const docs = await Promise.all(
          docFiles.map(async (file) => {
            const content = await readFile(join(DOCS_PATH, file), 'utf-8');
            const titleMatch = content.match(/^#\s+(.+)$/m);
            
            return {
              filename: file,
              title: titleMatch ? titleMatch[1] : file,
            };
          })
        );
        
        return {
          success: true,
          count: docs.length,
          docs,
        };
      } catch (error) {
        throw new Error('Failed to list docs: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'read_doc',
      description: 'Read documentation file',
      inputSchema: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'Documentation filename',
          },
        },
        required: ['filename'],
      },
    },
    async (args: any) => {
      try {
        const content = await readFile(join(DOCS_PATH, args.filename), 'utf-8');
        
        return {
          success: true,
          filename: args.filename,
          content,
        };
      } catch (error) {
        throw new Error('Failed to read doc: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );
}
