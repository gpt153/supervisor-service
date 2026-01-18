import crypto from 'crypto';
import db from '../db/pool.js';

export interface Secret {
  id: number;
  keyPath: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  description?: string;
  secretType?: string;
  provider?: string;
}

export interface SecretWithValue extends Secret {
  value: string;
}

export class SecretsManager {
  private encryptionKey: Buffer;

  constructor(encryptionKeyHex: string) {
    if (!encryptionKeyHex || encryptionKeyHex.length !== 64) {
      throw new Error('Encryption key must be 32 bytes (64 hex characters)');
    }
    this.encryptionKey = Buffer.from(encryptionKeyHex, 'hex');
  }

  /**
   * Encrypt a value using AES-256-GCM
   */
  private encrypt(value: string): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(value, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Format: [IV (16 bytes)][Auth Tag (16 bytes)][Encrypted Data]
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt a value using AES-256-GCM
   */
  private decrypt(encryptedBuffer: Buffer): string {
    const iv = encryptedBuffer.subarray(0, 16);
    const authTag = encryptedBuffer.subarray(16, 32);
    const encrypted = encryptedBuffer.subarray(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  }

  /**
   * Store a secret
   */
  async store(
    keyPath: string,
    value: string,
    options?: {
      createdBy?: string;
      description?: string;
      secretType?: string;
      provider?: string;
    }
  ): Promise<Secret> {
    const encryptedValue = this.encrypt(value);

    const result = await db.query<Secret>(
      `INSERT INTO secrets (key_path, encrypted_value, created_by, description, secret_type, provider)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key_path)
       DO UPDATE SET
         encrypted_value = EXCLUDED.encrypted_value,
         updated_at = NOW(),
         created_by = EXCLUDED.created_by,
         description = EXCLUDED.description,
         secret_type = EXCLUDED.secret_type,
         provider = EXCLUDED.provider
       RETURNING id, key_path, created_at, updated_at, created_by, description, secret_type, provider`,
      [
        keyPath,
        encryptedValue,
        options?.createdBy,
        options?.description,
        options?.secretType,
        options?.provider,
      ]
    );

    return result.rows[0];
  }

  /**
   * Retrieve a secret
   */
  async retrieve(keyPath: string): Promise<string | null> {
    const result = await db.query<{ encrypted_value: Buffer }>(
      `SELECT encrypted_value FROM secrets WHERE key_path = $1`,
      [keyPath]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.decrypt(result.rows[0].encrypted_value);
  }

  /**
   * List all secrets (metadata only, no values)
   */
  async list(filter?: { provider?: string; secretType?: string }): Promise<Secret[]> {
    let query = `SELECT id, key_path, created_at, updated_at, created_by, description, secret_type, provider
                 FROM secrets
                 WHERE 1=1`;
    const params: string[] = [];

    if (filter?.provider) {
      params.push(filter.provider);
      query += ` AND provider = $${params.length}`;
    }

    if (filter?.secretType) {
      params.push(filter.secretType);
      query += ` AND secret_type = $${params.length}`;
    }

    query += ` ORDER BY key_path`;

    const result = await db.query<Secret>(query, params);
    return result.rows;
  }

  /**
   * Delete a secret
   */
  async delete(keyPath: string): Promise<boolean> {
    const result = await db.query(`DELETE FROM secrets WHERE key_path = $1`, [keyPath]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Check if a secret exists
   */
  async exists(keyPath: string): Promise<boolean> {
    const result = await db.query(`SELECT 1 FROM secrets WHERE key_path = $1`, [keyPath]);
    return result.rows.length > 0;
  }

  /**
   * Bulk store secrets
   */
  async storeBulk(
    secrets: Array<{
      keyPath: string;
      value: string;
      createdBy?: string;
      description?: string;
      secretType?: string;
      provider?: string;
    }>
  ): Promise<Secret[]> {
    const results: Secret[] = [];

    for (const secret of secrets) {
      const stored = await this.store(secret.keyPath, secret.value, {
        createdBy: secret.createdBy,
        description: secret.description,
        secretType: secret.secretType,
        provider: secret.provider,
      });
      results.push(stored);
    }

    return results;
  }

  /**
   * Update secret metadata (not value)
   */
  async updateMetadata(
    keyPath: string,
    metadata: {
      description?: string;
      secretType?: string;
      provider?: string;
    }
  ): Promise<Secret | null> {
    const updates: string[] = [];
    const params: any[] = [keyPath];
    let paramIndex = 2;

    if (metadata.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(metadata.description);
    }

    if (metadata.secretType !== undefined) {
      updates.push(`secret_type = $${paramIndex++}`);
      params.push(metadata.secretType);
    }

    if (metadata.provider !== undefined) {
      updates.push(`provider = $${paramIndex++}`);
      params.push(metadata.provider);
    }

    if (updates.length === 0) {
      return null;
    }

    updates.push(`updated_at = NOW()`);

    const result = await db.query<Secret>(
      `UPDATE secrets
       SET ${updates.join(', ')}
       WHERE key_path = $1
       RETURNING id, key_path, created_at, updated_at, created_by, description, secret_type, provider`,
      params
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }
}
