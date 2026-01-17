import { exec } from 'child_process';
import { promisify } from 'util';
import { Pool } from 'pg';

const execAsync = promisify(exec);

/**
 * VerificationRunner - Run automated verification checks on SCAR implementations
 * 
 * Responsibilities:
 * - Run build validation
 * - Run test suite
 * - Search for mocks/placeholders
 * - Store results in database
 * - Format results as markdown
 */

export interface VerificationConfig {
  projectName: string;
  issueNumber: number;
  workspaceRoot: string;
}

export interface VerificationResult {
  id: string;
  status: 'passed' | 'failed' | 'partial' | 'error';
  buildSuccess: boolean;
  testsPassed: boolean;
  mocksDetected: boolean;
  details: {
    buildOutput?: string;
    buildError?: string;
    testOutput?: string;
    testError?: string;
    mockFiles?: string[];
    mockCount?: number;
    summary?: string;
  };
}

export class VerificationRunner {
  private pool: Pool;
  
  constructor(pool: Pool) {
    this.pool = pool;
  }
  
  /**
   * Run complete verification suite
   */
  async runVerification(config: VerificationConfig): Promise<VerificationResult> {
    console.log(`Starting verification for ${config.projectName} #${config.issueNumber}`);
    
    const workdir = config.workspaceRoot;
    
    // Initialize result
    const result: VerificationResult = {
      id: '',
      status: 'error',
      buildSuccess: false,
      testsPassed: false,
      mocksDetected: false,
      details: {},
    };
    
    try {
      // 1. Run build validation
      console.log('Running build validation...');
      const buildResult = await this.runBuild(workdir);
      result.buildSuccess = buildResult.success;
      result.details.buildOutput = buildResult.output;
      result.details.buildError = buildResult.error;
      
      // 2. Run tests (only if build succeeded)
      if (result.buildSuccess) {
        console.log('Running tests...');
        const testResult = await this.runTests(workdir);
        result.testsPassed = testResult.success;
        result.details.testOutput = testResult.output;
        result.details.testError = testResult.error;
      } else {
        console.log('Skipping tests due to build failure');
        result.details.testError = 'Skipped due to build failure';
      }
      
      // 3. Search for mocks/placeholders
      console.log('Searching for mocks and placeholders...');
      const mockResult = await this.searchForMocks(workdir);
      result.mocksDetected = mockResult.found;
      result.details.mockFiles = mockResult.files;
      result.details.mockCount = mockResult.count;
      
      // 4. Determine overall status
      if (result.buildSuccess && result.testsPassed && !result.mocksDetected) {
        result.status = 'passed';
      } else if (result.buildSuccess && result.testsPassed && result.mocksDetected) {
        result.status = 'partial';
      } else {
        result.status = 'failed';
      }
      
      // 5. Generate summary
      result.details.summary = this.generateSummary(result);
      
      // 6. Store in database
      result.id = await this.storeResult(config, result);
      
      console.log(`Verification complete: ${result.status}`);
      return result;
      
    } catch (error) {
      console.error('Verification error:', error);
      result.status = 'error';
      result.details.summary = 'Verification failed with error: ' + (error instanceof Error ? error.message : String(error));
      result.id = await this.storeResult(config, result);
      return result;
    }
  }
  
  /**
   * Run build command
   */
  private async runBuild(workdir: string): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const { stdout, stderr } = await execAsync('npm run build', {
        cwd: workdir,
        timeout: 120000, // 2 minutes
        maxBuffer: 1024 * 1024 * 10, // 10MB
      });
      
      return {
        success: true,
        output: stdout + (stderr ? '\nStderr:\n' + stderr : ''),
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
      };
    }
  }
  
  /**
   * Run test suite
   */
  private async runTests(workdir: string): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const { stdout, stderr } = await execAsync('npm test', {
        cwd: workdir,
        timeout: 300000, // 5 minutes
        maxBuffer: 1024 * 1024 * 10, // 10MB
      });
      
      return {
        success: true,
        output: stdout + (stderr ? '\nStderr:\n' + stderr : ''),
      };
    } catch (error: any) {
      // npm test returns non-zero on test failures
      // We still consider it "ran" if we got output
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
      };
    }
  }
  
  /**
   * Search for mock/placeholder code
   */
  private async searchForMocks(workdir: string): Promise<{ found: boolean; files: string[]; count: number }> {
    try {
      // Search patterns for common placeholder indicators
      const patterns = [
        'TODO',
        'FIXME',
        'MOCK',
        'PLACEHOLDER',
        'NOT IMPLEMENTED',
        'STUB',
        'throw new Error',
      ];
      
      // Build grep command
      const grepPattern = patterns.join('\\|');
      const command = `grep -r -n -i "${grepPattern}" src/ --exclude-dir=node_modules --exclude="*.test.ts" --exclude="*.spec.ts" 2>/dev/null || true`;
      
      const { stdout } = await execAsync(command, {
        cwd: workdir,
        maxBuffer: 1024 * 1024 * 5, // 5MB
      });
      
      if (!stdout.trim()) {
        return { found: false, files: [], count: 0 };
      }
      
      // Parse results
      const lines = stdout.trim().split('\n');
      const fileSet = new Set<string>();
      
      lines.forEach(line => {
        const match = line.match(/^([^:]+):/);
        if (match) {
          fileSet.add(match[1]);
        }
      });
      
      return {
        found: true,
        files: Array.from(fileSet),
        count: lines.length,
      };
      
    } catch (error) {
      console.error('Error searching for mocks:', error);
      return { found: false, files: [], count: 0 };
    }
  }
  
  /**
   * Generate verification summary
   */
  private generateSummary(result: Partial<VerificationResult>): string {
    const lines: string[] = [];
    
    lines.push('# Verification Summary');
    lines.push('');
    
    if (result.status === 'passed') {
      lines.push('✅ All checks passed!');
    } else if (result.status === 'partial') {
      lines.push('⚠️ Partial success - mocks/placeholders detected');
    } else if (result.status === 'failed') {
      lines.push('❌ Verification failed');
    } else {
      lines.push('⚠️ Verification error');
    }
    
    lines.push('');
    lines.push('## Build');
    lines.push(result.buildSuccess ? '✅ Build successful' : '❌ Build failed');
    
    if (result.details?.buildError) {
      lines.push('```');
      lines.push(result.details.buildError.slice(0, 500));
      if (result.details.buildError.length > 500) {
        lines.push('... (truncated)');
      }
      lines.push('```');
    }
    
    lines.push('');
    lines.push('## Tests');
    lines.push(result.testsPassed ? '✅ Tests passed' : '❌ Tests failed or skipped');
    
    if (result.details?.testError) {
      lines.push('```');
      lines.push(result.details.testError.slice(0, 500));
      if (result.details.testError.length > 500) {
        lines.push('... (truncated)');
      }
      lines.push('```');
    }
    
    lines.push('');
    lines.push('## Mock Detection');
    
    if (result.mocksDetected && result.details?.mockCount) {
      lines.push(`⚠️ Found ${result.details.mockCount} potential mocks/placeholders`);
      if (result.details.mockFiles && result.details.mockFiles.length > 0) {
        lines.push('');
        lines.push('Files with placeholders:');
        result.details.mockFiles.slice(0, 10).forEach(file => {
          lines.push(`- ${file}`);
        });
        if (result.details.mockFiles.length > 10) {
          lines.push(`... and ${result.details.mockFiles.length - 10} more`);
        }
      }
    } else {
      lines.push('✅ No mocks or placeholders detected');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Store verification result in database
   */
  private async storeResult(config: VerificationConfig, result: Partial<VerificationResult>): Promise<string> {
    const query = `
      INSERT INTO verification_results (
        project_name,
        issue_number,
        status,
        build_success,
        tests_passed,
        mocks_detected,
        details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    
    const values = [
      config.projectName,
      config.issueNumber,
      result.status || 'error',
      result.buildSuccess || false,
      result.testsPassed || false,
      result.mocksDetected || false,
      JSON.stringify(result.details || {}),
    ];
    
    const dbResult = await this.pool.query(query, values);
    return dbResult.rows[0].id;
  }
  
  /**
   * Get verification results for an issue
   */
  async getResultsForIssue(projectName: string, issueNumber: number): Promise<VerificationResult[]> {
    const query = `
      SELECT * FROM verification_results
      WHERE project_name = $1 AND issue_number = $2
      ORDER BY created_at DESC
    `;
    
    const result = await this.pool.query(query, [projectName, issueNumber]);
    return result.rows;
  }
  
  /**
   * Format result as markdown for GitHub comment
   */
  formatAsMarkdown(result: VerificationResult): string {
    return result.details.summary || 'Verification completed';
  }
}
