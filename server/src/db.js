import pg from 'pg';

const { Pool } = pg;

// A pooled connection string is used for hosted Postgres in production.
// DATABASE_URL is the generic name; POSTGRES_URL is what Vercel's
// Supabase/Neon marketplace integrations inject. The discrete DB_* vars
// remain for local development.
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'hello_world',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    });

export default pool;
