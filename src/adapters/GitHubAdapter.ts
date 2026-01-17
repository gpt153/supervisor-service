import { config } from '../config';

/**
 * GitHubAdapter - Interface with GitHub API
 * 
 * Responsibilities:
 * - Post issue comments
 * - Fetch issue information
 * - Create/update labels
 */

export interface IssueComment {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}

export class GitHubAdapter {
  private token: string;
  private baseUrl = 'https://api.github.com';
  
  constructor(token?: string) {
    this.token = token || config.github.token;
    
    if (!this.token) {
      throw new Error('GitHub token is required');
    }
  }
  
  /**
   * Post a comment on an issue
   */
  async postIssueComment(params: IssueComment): Promise<void> {
    const url = `${this.baseUrl}/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}/comments`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'supervisor-service/1.0',
      },
      body: JSON.stringify({
        body: params.body,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to post comment: ${response.status} ${errorText}`);
    }
  }
  
  /**
   * Get issue information
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'supervisor-service/1.0',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch issue: ${response.status} ${errorText}`);
    }
    
    return response.json();
  }
  
  /**
   * Add labels to an issue
   */
  async addLabels(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<void> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/labels`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'supervisor-service/1.0',
      },
      body: JSON.stringify({
        labels,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to add labels: ${response.status} ${errorText}`);
    }
  }
  
  /**
   * Parse repository owner and name from webhook payload
   */
  static parseRepoInfo(payload: any): { owner: string; repo: string } | null {
    const fullName = payload?.repository?.full_name;
    if (!fullName) {
      return null;
    }
    
    const [owner, repo] = fullName.split('/');
    if (!owner || !repo) {
      return null;
    }
    
    return { owner, repo };
  }
}
