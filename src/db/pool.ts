import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

class DatabasePool {
  private static instance: DatabasePool;
  private pool: pg.Pool;

  private constructor(config?: DatabaseConfig) {
    const dbConfig: DatabaseConfig = config || {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'supervisor',
      user: process.env.DB_USER || 'supervisor_user',
      password: process.env.DB_PASSWORD || 'change_me',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    this.pool = new Pool(dbConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    // Log pool status on connect
    this.pool.on('connect', () => {
      console.log('[DB] New client connected');
    });

    this.pool.on('remove', () => {
      console.log('[DB] Client removed');
    });
  }

  public static getInstance(config?: DatabaseConfig): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool(config);
    }
    return DatabasePool.instance;
  }

  public getPool(): pg.Pool {
    return this.pool;
  }

  public async query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
    const start = Date.now();
    const result = await this.pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (duration > 100) {
      console.warn(`[DB] Slow query (${duration}ms): ${text.substring(0, 100)}...`);
    }

    return result;
  }

  public async getClient(): Promise<pg.PoolClient> {
    return this.pool.connect();
  }

  public async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const result = await this.pool.query('SELECT NOW()');
      return {
        healthy: true,
        message: `Connected to database at ${result.rows[0].now}`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Database connection failed: ${error}`,
      };
    }
  }

  public async getStats(): Promise<{
    totalClients: number;
    idleClients: number;
    waitingClients: number;
  }> {
    return {
      totalClients: this.pool.totalCount,
      idleClients: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
    };
  }

  public async close(): Promise<void> {
    await this.pool.end();
    console.log('[DB] Connection pool closed');
  }
}

// Export singleton instance
export const db = DatabasePool.getInstance();
export default db;
