import pg from 'pg';

const { Pool } = pg;

// Local development only — connects to a local Postgres instance using the
// discrete DB_* vars from server/.env. Rename this file to db.js to use it
// (and rename the original db.js aside first, or restore it before deploying
// to Vercel).
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'hello_world',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

export default pool;
