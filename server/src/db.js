import pg from 'pg';

const { Pool } = pg;

// DATABASE_URL is used for hosted Postgres (Vercel Postgres, Neon, Supabase, etc.)
// in production. The discrete DB_* vars remain for local development.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
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
