import { db } from '../db/pool.js';

/**
 * Result of secret detection
 */
export interface SecretDetection {
  provider: string;        // e.g., 'anthropic', 'stripe_live'
  value: string;           // The actual secret value
  keyPath: string;         // Where to store it (e.g., 'meta/anthropic/api_key')
  description: string;     // Human-readable description
  secretType: string;      // 'api_key', 'token', 'password'
}

/**
 * Pattern from database
 */
interface DetectionPattern {
  provider: string;
  pattern: string;
  secret_type: string;
  key_path_template: string;
  enabled: boolean;
}

/**
 * Detection context (helps with ambiguous secrets)
 */
export interface DetectionContext {
  question?: string;       // What question was asked before user provided secret
  projectName?: string;    // Current project context
  conversationHistory?: string[];  // Recent messages
}

/**
 * Automatically detects secrets in user messages
 *
 * Uses database-driven patterns to identify API keys, tokens, and passwords.
 * Automatically determines appropriate storage location based on secret type.
 */
export class AutoSecretDetector {
  private patterns: DetectionPattern[] = [];
  private patternsLoaded = false;

  /**
   * Load detection patterns from database
   */
  async loadPatterns(): Promise<void> {
    const result = await db.query<DetectionPattern>(
      `SELECT provider, pattern, secret_type, key_path_template, enabled
       FROM secret_detection_patterns
       WHERE enabled = true
       ORDER BY provider`
    );

    this.patterns = result.rows;
    this.patternsLoaded = true;
  }

  /**
   * Detect if string is likely a secret
   *
   * @param value - The string to test (potential secret)
   * @param context - Additional context to help with detection
   * @returns SecretDetection if detected, null otherwise
   */
  async detectSecret(
    value: string,
    context?: DetectionContext
  ): Promise<SecretDetection | null> {
    // Ensure patterns are loaded
    if (!this.patternsLoaded) {
      await this.loadPatterns();
    }

    // Trim whitespace
    const trimmedValue = value.trim();

    // Test against all patterns
    for (const pattern of this.patterns) {
      try {
        const regex = new RegExp(pattern.pattern);
        if (regex.test(trimmedValue)) {
          return {
            provider: pattern.provider,
            value: trimmedValue,
            keyPath: this.resolveKeyPath(pattern.key_path_template, context),
            description: this.generateDescription(pattern.provider, context),
            secretType: pattern.secret_type
          };
        }
      } catch (error) {
        console.error(`Invalid regex pattern for ${pattern.provider}:`, error);
        // Continue to next pattern
      }
    }

    // If no pattern match, try context-based detection
    if (context?.question) {
      return this.detectFromContext(trimmedValue, context);
    }

    return null;
  }

  /**
   * Detect secret based on question context
   * (when pattern doesn't match but question indicates it's a secret)
   */
  private detectFromContext(
    value: string,
    context: DetectionContext
  ): SecretDetection | null {
    const question = context.question?.toLowerCase() || '';

    // API key keywords
    if (question.includes('api key') || question.includes('api-key')) {
      return {
        provider: 'unknown_api_key',
        value,
        keyPath: this.resolveKeyPath('project/{project}/api_key', context),
        description: 'API key',
        secretType: 'api_key'
      };
    }

    // Token keywords
    if (question.includes('token') || question.includes('access token')) {
      return {
        provider: 'unknown_token',
        value,
        keyPath: this.resolveKeyPath('project/{project}/token', context),
        description: 'Access token',
        secretType: 'token'
      };
    }

    // Password keywords
    if (question.includes('password') || question.includes('secret')) {
      return {
        provider: 'unknown_password',
        value,
        keyPath: this.resolveKeyPath('project/{project}/password', context),
        description: 'Password',
        secretType: 'password'
      };
    }

    // Database connection string keywords
    if (
      question.includes('database') ||
      question.includes('connection string') ||
      question.includes('db url')
    ) {
      return {
        provider: 'database_url',
        value,
        keyPath: this.resolveKeyPath('project/{project}/database_url', context),
        description: 'Database connection string',
        secretType: 'connection_string'
      };
    }

    return null;
  }

  /**
   * Resolve key path template with context
   *
   * Templates can contain:
   * - {project} - replaced with projectName from context
   * - {provider} - replaced with provider name
   */
  private resolveKeyPath(
    template: string,
    context?: DetectionContext
  ): string {
    let resolved = template;

    // Replace {project} with actual project name
    if (context?.projectName) {
      resolved = resolved.replace('{project}', context.projectName);
    } else {
      // If no project context and template needs it, use 'meta' as fallback
      resolved = resolved.replace('project/{project}/', 'meta/');
    }

    return resolved;
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(
    provider: string,
    context?: DetectionContext
  ): string {
    const projectSuffix = context?.projectName ? ` for ${context.projectName}` : '';

    const descriptions: Record<string, string> = {
      anthropic: 'Anthropic API key',
      openai: 'OpenAI API key',
      google_api: 'Google/Gemini API key',
      stripe_live: `Stripe live API key${projectSuffix}`,
      stripe_test: `Stripe test API key${projectSuffix}`,
      github: 'GitHub personal access token',
      cloudflare: 'Cloudflare API token',
      database_url: `Database connection string${projectSuffix}`,
      unknown_api_key: `API key${projectSuffix}`,
      unknown_token: `Access token${projectSuffix}`,
      unknown_password: `Password${projectSuffix}`
    };

    return descriptions[provider] || `Secret${projectSuffix}`;
  }

  /**
   * Reload patterns from database
   * (useful if patterns are updated)
   */
  async reloadPatterns(): Promise<void> {
    this.patternsLoaded = false;
    await this.loadPatterns();
  }

  /**
   * Get all loaded patterns (for debugging)
   */
  getLoadedPatterns(): DetectionPattern[] {
    return [...this.patterns];
  }
}
