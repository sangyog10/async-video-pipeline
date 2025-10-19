import fs from 'fs';
import path from 'path';
import db from './database.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';



const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename)

/**
 * Migration Runner
 * 
 * This script manages database schema migrations by:
 * 1. Tracking which migrations have been executed
 * 2. Running pending migrations in order
 * 3. Recording successful migrations to prevent re-execution
 */

// Directory where migration SQL files are stored
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Table that tracks which migrations have been executed
const MIGRATIONS_TABLE = 'schema_migrations';

/**
 * Represents a migration file
 */
interface Migration {
  name: string;      // Filename (e.g., "001_create_users.sql")
  sql: string;       // The SQL content to execute
}

/**
 * Create the migrations tracking table if it doesn't exist
 * 
 * This table stores a record of every migration that has been executed.
 * Before running migrations, we check this table to see what's already been applied.
 */
async function createMigrationsTable(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await db.execute(sql);
    console.log(`Migrations table "${MIGRATIONS_TABLE}" ready`);
  } catch (error) {
    console.error('Failed to create migrations table:', error);
    throw error;
  }
}

/**
 * Read all migration files from the migrations directory
 * 
 * Returns an array of Migration objects sorted alphabetically by filename.
 * Only .sql files are included.
 */
function readMigrationFiles(): Migration[] {
  // Check if migrations directory exists
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log(`Creating migrations directory: ${MIGRATIONS_DIR}`);
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return [];
  }

  // Read all files from the directory
  const files = fs.readdirSync(MIGRATIONS_DIR);

  // Filter for .sql files only and sort alphabetically
  // Sorting ensures migrations run in the correct order (001, 002, 003...)
  const sqlFiles = files
    .filter(file => file.endsWith('.sql'))
    .sort();

  // Read the content of each SQL file
  const migrations: Migration[] = sqlFiles.map(filename => {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filepath, 'utf-8');
    return { name: filename, sql };
  });

  return migrations;
}

/**
 * Get a list of migrations that have already been executed
 * 
 * Queries the migrations tracking table to see which migrations
 * have already been run. Returns an array of migration names (filenames).
 */
async function getExecutedMigrations(): Promise<string[]> {
  const sql = `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`;

  try {
    const rows = await db.query<{ name: string }>(sql);
    return rows.map(row => row.name);
  } catch (error) {
    console.error('Failed to fetch executed migrations:', error);
    throw error;
  }
}

/**
 * Execute a single migration within a transaction
 * 
 * @param migration - The migration to execute
 * 
 * Steps:
 * 1. Begin transaction
 * 2. Execute the migration SQL
 * 3. Record the migration in the tracking table
 * 4. Commit transaction
 * 
 * If anything fails, the transaction is rolled back automatically
 * by the db.transaction() method.
 */
async function executeMigration(migration: Migration): Promise<void> {
  await db.transaction(async (client) => {
    // Execute the migration SQL
    // This could be CREATE TABLE, ALTER TABLE, INSERT data, etc.
    await client.query(migration.sql);

    // Record this migration as executed
    // This prevents it from running again on the next migrate run
    await client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`,
      [migration.name]
    );
  });
}

/**
 * Main migration function
 * 
 * This orchestrates the entire migration process:
 * 1. Ensure migrations tracking table exists
 * 2. Read all migration files
 * 3. Determine which migrations haven't been run yet
 * 4. Execute pending migrations in order
 * 5. Report results
 */
async function migrate(): Promise<void> {
  console.log('Starting migration process...\n');

  try {
    // Step 1: Connect to database
    await db.connect();
    console.log('✓ Database connected\n');

    // Step 2: Ensure migrations tracking table exists
    await createMigrationsTable();

    // Step 3: Read all migration files from disk
    const allMigrations = readMigrationFiles();
    console.log(`\nFound ${allMigrations.length} migration file(s)`);

    if (allMigrations.length === 0) {
      console.log('\nNo migrations to run. Create .sql files in the migrations directory.');
      return;
    }

    // Step 4: Get list of already-executed migrations
    const executedMigrations = await getExecutedMigrations();
    console.log(`Already executed: ${executedMigrations.length} migration(s)`);

    // Step 5: Filter out already-executed migrations to get pending ones
    // A migration is pending if its name is NOT in the executedMigrations array
    const pendingMigrations = allMigrations.filter(
      migration => !executedMigrations.includes(migration.name)
    );

    if (pendingMigrations.length === 0) {
      console.log('\n✓ All migrations are up to date. Nothing to run.');
      return;
    }

    console.log(`\nPending migrations: ${pendingMigrations.length}`);
    console.log('---');

    // Step 6: Execute each pending migration in order
    for (const migration of pendingMigrations) {
      try {
        console.log(`Running: ${migration.name}...`);
        await executeMigration(migration);
        console.log(`✓ Success: ${migration.name}\n`);
      } catch (error) {
        // If a migration fails, stop immediately
        // The failed migration is NOT recorded in the tracking table
        // Next time you run migrate, it will try this migration again
        console.error(`\n✗ FAILED: ${migration.name}`);
        console.error('Error:', error);
        console.error('\nMigration process stopped. Fix the error and try again.');
        process.exit(1);
      }
    }

    console.log('---');
    console.log(`✓ Successfully executed ${pendingMigrations.length} migration(s)`);
    console.log('✓ Database schema is up to date');

  } catch (error) {
    console.error('\n✗ Migration process failed:', error);
    process.exit(1);
  } finally {
    // Always close the database connection when done
    await db.close();
  }
}

// Run the migration if this file is executed directly
// (not imported as a module)
//change to esm syntax


if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().then(() => {
    console.log('\nMigration process completed.');
    process.exit(0);
  });
}