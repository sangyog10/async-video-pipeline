import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv'

dotenv.config()

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  min?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

class Database {
  private pool: Pool
  private isConnected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      ...config,
      max: config.max || 20,
      min: config.min || 2,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    })

    //pool error
    this.pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });

    // Graceful shutdown
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
  }

  /**
  * Initialize database connection(testing if the connection can be initiated or not)
  */
  async connect() {
    if (this.isConnected) return;              //return if already connected

    try {
      const client = await this.pool.connect() // connecting to pool
      await client.query("SELECT NOW()")       // ping to check if it is responding
      client.release()                         // releasing the connection to the pool

      this.isConnected = true
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }


  /**
   * Execute query and return all rows
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const client = await this.pool.connect()

    try {
      const result = await client.query(sql, params)
      return result.rows
    } catch (error) {
      console.error('Query error:', { sql, params, error });
      throw error;
    } finally {
      client.release()
    }
  }


  /**
  * Execute query and return single row
  */
  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params)
    return rows.length > 0 ? rows[0] : null
  }


  /**
   * Execute query and return affected row count
   */
  async execute(sql: string, params: any[] = []): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Execute error:', { sql, params, error });
      throw error;
    } finally {
      client.release();
    }
  }


  /**
   * Execute multiple queries in transations
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      const result = await callback(client)
      await client.query("COMMIT")
      return result
    } catch (error) {
      await client.query("ROLLBACK")
      console.error('Transaction error:', error);
      throw error;
    } finally {
      client.release()
    }
  }


  /**
   * Get pool status for monitoring
   */
  getStatus() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      isConnected: this.isConnected
    }
  }


  /**
  * Health check for monitoring
  */
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }


  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.pool.end();
      this.isConnected = false;
      console.log('Database connections closed gracefully');
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }
}

const dbConfig: DatabaseConfig = {
  host: process.env.POSTGRES_HOST || '',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || '',
  user: process.env.POSTGRES_USER || '',
  password: process.env.POSTGRES_PASSWORD || '',
};

// This line creates the pool object, but doesn't connect yet.
const db = new Database(dbConfig)


export default db;