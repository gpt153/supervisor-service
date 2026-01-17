import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { ToolContext } from '../server';

const SUPERVISOR_ROOT = '/home/samuel/supervisor';

export function registerPlanningTools(context: ToolContext): void {
  context.registerTool(
    {
      name: 'list_epics',
      description: 'List all epics for a project',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name (e.g., "consilio", "openhorizon")',
          },
        },
        required: ['project'],
      },
    },
    async (args: any) => {
      const projectPath = join(SUPERVISOR_ROOT, args.project, '.bmad/epics');
      
      try {
        const files = await readdir(projectPath);
        const epicFiles = files.filter(f => f.endsWith('.md'));
        
        const epics = await Promise.all(
          epicFiles.map(async (file) => {
            const content = await readFile(join(projectPath, file), 'utf-8');
            const titleMatch = content.match(/^#\s+Epic:\s+(.+)$/m);
            const statusMatch = content.match(/^\*\*Status:\*\*\s+(.+)$/m);
            
            return {
              filename: file,
              title: titleMatch ? titleMatch[1] : file,
              status: statusMatch ? statusMatch[1] : 'Unknown',
            };
          })
        );
        
        return {
          success: true,
          project: args.project,
          count: epics.length,
          epics,
        };
      } catch (error) {
        throw new Error('Failed to list epics: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'read_epic',
      description: 'Read epic content',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name',
          },
          epic_file: {
            type: 'string',
            description: 'Epic filename (e.g., "001-feature-name.md")',
          },
        },
        required: ['project', 'epic_file'],
      },
    },
    async (args: any) => {
      const filePath = join(SUPERVISOR_ROOT, args.project, '.bmad/epics', args.epic_file);
      
      try {
        const content = await readFile(filePath, 'utf-8');
        
        return {
          success: true,
          project: args.project,
          epic_file: args.epic_file,
          content,
        };
      } catch (error) {
        throw new Error('Failed to read epic: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'list_adrs',
      description: 'List all Architecture Decision Records for a project',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name',
          },
        },
        required: ['project'],
      },
    },
    async (args: any) => {
      const projectPath = join(SUPERVISOR_ROOT, args.project, '.bmad/adr');
      
      try {
        const files = await readdir(projectPath);
        const adrFiles = files.filter(f => f.endsWith('.md'));
        
        const adrs = await Promise.all(
          adrFiles.map(async (file) => {
            const content = await readFile(join(projectPath, file), 'utf-8');
            const titleMatch = content.match(/^#\s+ADR[-\s]?\d+:\s+(.+)$/m);
            const statusMatch = content.match(/^\*\*Status:\*\*\s+(.+)$/m);
            
            return {
              filename: file,
              title: titleMatch ? titleMatch[1] : file,
              status: statusMatch ? statusMatch[1] : 'Unknown',
            };
          })
        );
        
        return {
          success: true,
          project: args.project,
          count: adrs.length,
          adrs,
        };
      } catch (error) {
        throw new Error('Failed to list ADRs: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'read_adr',
      description: 'Read ADR content',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name',
          },
          adr_file: {
            type: 'string',
            description: 'ADR filename (e.g., "001-technology-choice.md")',
          },
        },
        required: ['project', 'adr_file'],
      },
    },
    async (args: any) => {
      const filePath = join(SUPERVISOR_ROOT, args.project, '.bmad/adr', args.adr_file);
      
      try {
        const content = await readFile(filePath, 'utf-8');
        
        return {
          success: true,
          project: args.project,
          adr_file: args.adr_file,
          content,
        };
      } catch (error) {
        throw new Error('Failed to read ADR: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'read_workflow_status',
      description: 'Get project workflow status (progress, current phase, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name',
          },
        },
        required: ['project'],
      },
    },
    async (args: any) => {
      const filePath = join(SUPERVISOR_ROOT, args.project, '.bmad/workflow-status.yaml');
      
      try {
        const content = await readFile(filePath, 'utf-8');
        
        return {
          success: true,
          project: args.project,
          content,
        };
      } catch (error) {
        throw new Error('Failed to read workflow status: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'list_templates',
      description: 'List available templates for creating new artifacts',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    async () => {
      const templatesPath = join(SUPERVISOR_ROOT, 'templates');
      
      try {
        const files = await readdir(templatesPath);
        const templates = files.filter(f => f.endsWith('.md'));
        
        return {
          success: true,
          count: templates.length,
          templates,
        };
      } catch (error) {
        throw new Error('Failed to list templates: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );
}
