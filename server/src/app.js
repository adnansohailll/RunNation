import express from 'express';
import cors from 'cors';
import pool from './db.js';

const app = express();

app.use(cors());
app.use(express.json());

// GET /api/runs — return all rows from run_metadata
app.get('/api/runs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM run_metadata ORDER BY 1');
    res.json({ columns: result.fields.map((f) => f.name), rows: result.rows });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runs/:id — return a single row from run_metadata
app.get('/api/runs/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid run id' });
  }
  try {
    const result = await pool.query('SELECT * FROM run_metadata WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json({ columns: result.fields.map((f) => f.name), row: result.rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
