import { ToolContext } from '../server';
import { GitHubAdapter } from '../../adapters/GitHubAdapter';
import { config } from '../../config';

export function registerGitHubTools(context: ToolContext): void {
  const github = new GitHubAdapter(config.github.token);

  context.registerTool(
    {
      name: 'list_issues',
      description: 'List GitHub issues for a project repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          state: {
            type: 'string',
            description: 'Issue state (open, closed, all)',
            enum: ['open', 'closed', 'all'],
            default: 'open',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by labels',
          },
        },
        required: ['owner', 'repo'],
      },
    },
    async (args: any) => {
      try {
        const params = new URLSearchParams();
        params.append('state', args.state || 'open');
        
        if (args.labels && args.labels.length > 0) {
          params.append('labels', args.labels.join(','));
        }
        
        const url = 'https://api.github.com/repos/' + args.owner + '/' + args.repo + '/issues?' + params.toString();
        
        const response = await fetch(url, {
          headers: {
            'Authorization': 'Bearer ' + config.github.token,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'supervisor-service/1.0',
          },
        });
        
        if (!response.ok) {
          throw new Error('GitHub API error: ' + response.status);
        }
        
        const issues = (await response.json()) as any[];
        
        return {
          success: true,
          owner: args.owner,
          repo: args.repo,
          count: issues.length,
          issues: issues.map((issue: any) => ({
            number: issue.number,
            title: issue.title,
            state: issue.state,
            labels: issue.labels.map((l: any) => l.name),
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            url: issue.html_url,
          })),
        };
      } catch (error) {
        throw new Error('Failed to list issues: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'read_issue',
      description: 'Read issue details including comments',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          issue_number: {
            type: 'number',
            description: 'Issue number',
          },
          include_comments: {
            type: 'boolean',
            description: 'Include comments (default: true)',
            default: true,
          },
        },
        required: ['owner', 'repo', 'issue_number'],
      },
    },
    async (args: any) => {
      try {
        const issue = await github.getIssue(args.owner, args.repo, args.issue_number);
        
        let comments: any[] = [];
        
        if (args.include_comments !== false) {
          const commentsUrl = 'https://api.github.com/repos/' + args.owner + '/' + args.repo + '/issues/' + args.issue_number + '/comments';
          
          const commentsResponse = await fetch(commentsUrl, {
            headers: {
              'Authorization': 'Bearer ' + config.github.token,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'supervisor-service/1.0',
            },
          });
          
          if (commentsResponse.ok) {
            const commentsData = (await commentsResponse.json()) as any[];
            comments = commentsData.map((c: any) => ({
              id: c.id,
              author: c.user.login,
              body: c.body,
              created_at: c.created_at,
            }));
          }
        }
        
        return {
          success: true,
          issue: {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state,
            labels: issue.labels.map((l: any) => l.name),
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            url: issue.html_url,
            comments_count: comments.length,
            comments,
          },
        };
      } catch (error) {
        throw new Error('Failed to read issue: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'create_issue',
      description: 'Create a new GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          title: {
            type: 'string',
            description: 'Issue title',
          },
          body: {
            type: 'string',
            description: 'Issue body',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Labels to add',
          },
        },
        required: ['owner', 'repo', 'title', 'body'],
      },
    },
    async (args: any) => {
      try {
        const url = 'https://api.github.com/repos/' + args.owner + '/' + args.repo + '/issues';
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + config.github.token,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'supervisor-service/1.0',
          },
          body: JSON.stringify({
            title: args.title,
            body: args.body,
            labels: args.labels || [],
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error('GitHub API error: ' + response.status + ' ' + errorText);
        }
        
        const issue = (await response.json()) as any;
        
        return {
          success: true,
          issue: {
            number: issue.number,
            url: issue.html_url,
            title: issue.title,
          },
        };
      } catch (error) {
        throw new Error('Failed to create issue: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'comment_issue',
      description: 'Add a comment to a GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          issue_number: {
            type: 'number',
            description: 'Issue number',
          },
          body: {
            type: 'string',
            description: 'Comment body',
          },
        },
        required: ['owner', 'repo', 'issue_number', 'body'],
      },
    },
    async (args: any) => {
      try {
        await github.postIssueComment({
          owner: args.owner,
          repo: args.repo,
          issueNumber: args.issue_number,
          body: args.body,
        });
        
        return {
          success: true,
          message: 'Comment posted successfully',
        };
      } catch (error) {
        throw new Error('Failed to comment: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'close_issue',
      description: 'Close a GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          issue_number: {
            type: 'number',
            description: 'Issue number',
          },
        },
        required: ['owner', 'repo', 'issue_number'],
      },
    },
    async (args: any) => {
      try {
        const url = 'https://api.github.com/repos/' + args.owner + '/' + args.repo + '/issues/' + args.issue_number;
        
        const response = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Authorization': 'Bearer ' + config.github.token,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'supervisor-service/1.0',
          },
          body: JSON.stringify({
            state: 'closed',
          }),
        });
        
        if (!response.ok) {
          throw new Error('GitHub API error: ' + response.status);
        }
        
        return {
          success: true,
          message: 'Issue closed successfully',
        };
      } catch (error) {
        throw new Error('Failed to close issue: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );
}
