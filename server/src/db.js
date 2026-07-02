import pg from 'pg';

const { Pool } = pg;

// A pooled connection string is used for hosted Postgres in production.
// DATABASE_URL is the generic name; POSTGRES_URL is what Vercel's
// Supabase/Neon marketplace integrations inject. The discrete DB_* vars
// remain for local development.
const rawConnectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// pg-connection-string parses `sslmode=require` (which Supabase URLs include)
// into an empty `ssl: {}` object, which then overwrites our explicit
// `rejectUnauthorized: false` below during pg's internal config merge —
// causing "self-signed certificate in certificate chain". Strip it so our
// explicit ssl option is the only one pg sees.
const connectionString = rawConnectionString
  ? (() => {
      const url = new URL(rawConnectionString);
      url.searchParams.delete('sslmode');
      return url.toString();
    })()
  : undefined;

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
