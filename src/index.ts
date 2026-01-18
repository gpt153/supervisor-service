import dotenv from 'dotenv';
import db from './db/pool.js';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Starting Supervisor Service...');

  // Verify environment variables
  const requiredEnvVars = ['ENCRYPTION_KEY', 'DB_HOST', 'DB_NAME', 'DB_USER'];
  const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingEnvVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
  }

  // Verify encryption key format
  const encryptionKey = process.env.ENCRYPTION_KEY || '';
  if (encryptionKey.length !== 64) {
    console.error('❌ ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    console.error('   Generate one with: openssl rand -hex 32');
    process.exit(1);
  }

  // Test database connection
  console.log('📊 Testing database connection...');
  try {
    const healthCheck = await db.healthCheck();
    if (healthCheck.healthy) {
      console.log(`✅ Database connected: ${healthCheck.message}`);
    } else {
      console.error(`❌ Database connection failed: ${healthCheck.message}`);
      process.exit(1);
    }

    // Get database stats
    const stats = await db.getStats();
    console.log(`📈 Database stats: ${stats.totalClients} total, ${stats.idleClients} idle, ${stats.waitingClients} waiting`);
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }

  // Verify database schema is loaded
  console.log('🔍 Verifying database schema...');
  try {
    const result = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('secrets', 'project_port_ranges', 'port_allocations', 'task_executions')
      ORDER BY table_name
    `);

    const expectedTables = ['port_allocations', 'project_port_ranges', 'secrets', 'task_executions'];
    const foundTables = result.rows.map((row) => row.table_name);

    if (foundTables.length === expectedTables.length) {
      console.log(`✅ Schema verified: ${foundTables.length} core tables found`);
    } else {
      console.error('❌ Schema incomplete. Expected tables:', expectedTables);
      console.error('   Found tables:', foundTables);
      console.error('\n   Run database setup:');
      console.error('   npm run db:setup');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Schema verification failed:', error);
    process.exit(1);
  }

  console.log('\n✅ Supervisor Service initialized successfully!');
  console.log('\n📋 Available interfaces:');
  console.log('   • MCP Server: Run `npm run mcp` to start MCP server on stdio');
  console.log('   • Direct API: Import managers from src/ in your code');
  console.log('\n📚 Managers available:');
  console.log('   • SecretsManager: Store/retrieve encrypted secrets');
  console.log('   • PortManager: Allocate and manage ports for services');
  console.log('   • TaskTimer: Track task execution and build estimates');
  console.log('   • CloudflareManager: DNS and tunnel management (stub)');
  console.log('   • GCloudManager: VM management (stub)');
  console.log('\n💡 Next steps:');
  console.log('   1. Test MCP tools: npm run mcp');
  console.log('   2. Store a secret: Use mcp__meta__store_secret tool');
  console.log('   3. Allocate ports: Use mcp__meta__allocate_port tool');
  console.log('   4. Track tasks: Use mcp__meta__start_task tool');
  console.log('\n🔧 Configuration:');
  console.log(`   • Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  console.log(`   • Encryption: ${encryptionKey.substring(0, 16)}...${encryptionKey.substring(48)}`);
  console.log(`   • Environment: ${process.env.NODE_ENV || 'development'}`);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
