## handling everything related to database from scratch:

db/
├── database.ts (contains logic to connect, run query, etc)
├── migrations/
│   └── (migration SQL files will go here)
└── migrate.ts (migration runner - you'll build this)


1. Fist created db/database.ts file, which contains all the logic to connect to postgres, query, connection pool etc. and connect to main file so that connection to database is established when we run the server
2. Now create db/migrate.ts file which is responsibe for running the migration:

## In-Depth Explanation
The Core Flow:

1. Entry Point (migrate() function at bottom)
- This is what runs when you execute tsx database/migrate.ts
- Orchestrates the entire process from start to finish


2. Database Connection
- Uses your existing db.connect() method
- Verifies the database is reachable before doing anything


3. Migrations Tracking Table (createMigrationsTable())
- Creates a table called schema_migrations (if it doesn't exist)
- This table is the "memory" of your migration system
- Each row = one migration that has been executed
- Columns:
    - id: auto-incrementing number
    - name: the filename (like "001_create_users.sql")
    - executed_at: timestamp of when it ran



4. Reading Migration Files (readMigrationFiles())
- Uses Node's fs module to read your migrations/ folder
- Filters for only .sql files
- Critically: sorts alphabetically - this is why you use numbered prefixes (001, 002, etc.)
- Reads each file's content into memory
- Returns array of { name, sql } objects


5. Checking What's Been Run (getExecutedMigrations())
- Queries the schema_migrations table
- Gets all migration names that have been recorded
- Returns array of strings (filenames)


6.Finding Pending Migrations
- Compares ALL migrations vs EXECUTED migrations
- Uses array filter: "give me migrations whose name is NOT in the executed list"
- This is how it knows what needs to run


7. Executing Each Migration (executeMigration())
- THE CRITICAL PART: Uses transactions
- Inside one transaction:
    - Runs the SQL from the migration file (CREATE TABLE, etc.)
    - Inserts a record into schema_migrations table

- If ANYTHING fails, the entire transaction rolls back:
    - Schema change doesn't apply
    - Migration is NOT marked as executed
    - Next run will try again
- If success: migration is permanently recorded


8. Error Handling
- If any migration fails, the process stops immediately
- Exits with error code 1 (tells shell/CI that it failed)
- The failed migration is NOT recorded
- You fix the problem, run again, and it retries from that point


9. Cleanup
- Always closes database connection in finally block
- Happens whether migrations succeed or fail



Why This Design Works
Idempotency:
Running migrate.ts multiple times is safe
It only runs what hasn't been run yet
Already-executed migrations are skipped

Ordering:
Alphabetical sort ensures 001 runs before 002
This is why naming matters: 001_users.sql, 002_posts.sql, etc.

Atomicity:
Each migration is in its own transaction
Either the entire migration succeeds, or nothing changes
Can't get "half-applied" migrations (mostly - DDL in Postgres is transactional)

State Tracking:
The schema_migrations table is the source of truth
Simple, reliable, and visible (you can query it)

Failure Recovery:
Failed migration doesn't get recorded
Fix the SQL, run again
It picks up where it left off

What Happens When You Run It
First time (empty database):
Starting migration process...
✓ Database connected
✓ Migrations table "schema_migrations" ready

Found 1 migration file(s)
Already executed: 0 migration(s)

Pending migrations: 1
---
Running: 001_create_users.sql...
✓ Success: 001_create_users.sql

---
✓ Successfully executed 1 migration(s)
✓ Database schema is up to date


Second time (nothing new):
Starting migration process...
✓ Database connected
✓ Migrations table "schema_migrations" ready

Found 1 migration file(s)
Already executed: 1 migration(s)

✓ All migrations are up to date. Nothing to run.



With new migration added:
Starting migration process...
✓ Database connected
✓ Migrations table "schema_migrations" ready

Found 2 migration file(s)
Already executed: 1 migration(s)

Pending migrations: 1
---
Running: 002_add_posts.sql...
✓ Success: 002_add_posts.sql

---
✓ Successfully executed 1 migration(s)
✓ Database schema is up to date


Next Steps
Create a migration file: database/migrations/001_initial_schema.sql
Add your table creation SQL
Run: tsx database/migrate.ts
Check your database - tables should exist