import { Client } from 'pg';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SetupConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  adminUser: string;
  adminPassword: string;
}

class DatabaseSetup {
  private config: SetupConfig;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'supervisor',
      user: process.env.DB_USER || 'supervisor_user',
      password: process.env.DB_PASSWORD || 'change_me',
      adminUser: process.env.DB_ADMIN_USER || 'postgres',
      adminPassword: process.env.DB_ADMIN_PASSWORD || '',
    };
  }

  async run(): Promise<void> {
    console.log('🚀 Starting database setup...\n');

    try {
      // Step 1: Connect as admin to create database and user
      await this.createDatabaseAndUser();

      // Step 2: Connect as supervisor_user to run schema
      await this.runSchema();

      console.log('\n✅ Database setup completed successfully!');
      console.log(`\nConnection string: postgresql://${this.config.user}:****@${this.config.host}:${this.config.port}/${this.config.database}`);
    } catch (error) {
      console.error('\n❌ Database setup failed:', error);
      process.exit(1);
    }
  }

  private async createDatabaseAndUser(): Promise<void> {
    console.log('📦 Step 1: Creating database and user...');

    const adminClient = new Client({
      host: this.config.host,
      port: this.config.port,
      database: 'postgres',
      user: this.config.adminUser,
      password: this.config.adminPassword,
    });

    try {
      await adminClient.connect();

      // Create user if not exists
      console.log(`  Creating user: ${this.config.user}...`);
      await adminClient.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '${this.config.user}') THEN
            CREATE USER ${this.config.user} WITH PASSWORD '${this.config.password}';
          END IF;
        END
        $$;
      `);
      console.log('  ✅ User created or already exists');

      // Create database if not exists
      console.log(`  Creating database: ${this.config.database}...`);
      const dbExists = await adminClient.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [this.config.database]
      );

      if (dbExists.rows.length === 0) {
        await adminClient.query(`CREATE DATABASE ${this.config.database} OWNER ${this.config.user}`);
        console.log('  ✅ Database created');
      } else {
        console.log('  ✅ Database already exists');
      }

      // Grant privileges
      await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${this.config.database} TO ${this.config.user}`);
      console.log('  ✅ Privileges granted');

    } finally {
      await adminClient.end();
    }
  }

  private async runSchema(): Promise<void> {
    console.log('\n📋 Step 2: Running schema...');

    const client = new Client({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
    });

    try {
      await client.connect();

      // Read schema file
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = await readFile(schemaPath, 'utf-8');

      console.log('  Loading schema from:', schemaPath);

      // Execute schema
      await client.query(schema);

      console.log('  ✅ Schema created successfully');

      // Verify tables
      const tables = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      console.log(`\n  📊 Created ${tables.rows.length} tables:`);
      tables.rows.forEach((row) => {
        console.log(`    - ${row.table_name}`);
      });

      // Verify extensions
      const extensions = await client.query(`
        SELECT extname FROM pg_extension
        WHERE extname IN ('pgcrypto', 'vector')
      `);

      console.log(`\n  🔧 Installed ${extensions.rows.length} extensions:`);
      extensions.rows.forEach((row) => {
        console.log(`    - ${row.extname}`);
      });

      // Test data
      const portRanges = await client.query('SELECT * FROM project_port_ranges');
      console.log(`\n  📌 Seeded ${portRanges.rows.length} port ranges:`);
      portRanges.rows.forEach((row) => {
        console.log(`    - ${row.project_name}: ${row.port_range_start}-${row.port_range_end}`);
      });

    } finally {
      await client.end();
    }
  }
}

// Run setup
const setup = new DatabaseSetup();
setup.run();
