import express from 'express';
import cors from 'cors';
import pool from './db.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import clubsRoutes from './routes/clubs.js';
import { requireAuth } from './middleware/auth.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/clubs', clubsRoutes);

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

const COMMENT_COLUMNS = `rc.id, rc.body, rc.created_at, u.id AS user_id, u.name AS user_name`;
const COMMENT_JOIN = `FROM run_comments rc JOIN users u ON u.id = rc.user_id`;

// GET /api/runs/:id/comments — anyone can view a run's comments
app.get('/api/runs/:id/comments', async (req, res) => {
  const runId = Number(req.params.id);
  if (!Number.isInteger(runId)) return res.status(400).json({ error: 'Invalid run id' });
  try {
    const { rows } = await pool.query(
      `SELECT ${COMMENT_COLUMNS} ${COMMENT_JOIN} WHERE rc.run_id = $1 ORDER BY rc.created_at ASC`,
      [runId]
    );
    res.json({ comments: rows });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/runs/:id/comments — any logged-in user can comment
app.post('/api/runs/:id/comments', requireAuth, async (req, res) => {
  const runId = Number(req.params.id);
  if (!Number.isInteger(runId)) return res.status(400).json({ error: 'Invalid run id' });
  const body = String(req.body?.body ?? '').trim();
  if (!body) return res.status(400).json({ error: 'Comment cannot be empty' });

  try {
    const { rows: runRows } = await pool.query('SELECT id FROM run_metadata WHERE id = $1', [runId]);
    if (runRows.length === 0) return res.status(404).json({ error: 'Run not found' });

    const { rows: inserted } = await pool.query(
      'INSERT INTO run_comments (run_id, user_id, body) VALUES ($1, $2, $3) RETURNING id',
      [runId, req.user.id, body]
    );
    const { rows } = await pool.query(
      `SELECT ${COMMENT_COLUMNS} ${COMMENT_JOIN} WHERE rc.id = $1`,
      [inserted[0].id]
    );
    res.status(201).json({ comment: rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/runs/:id/comments/:commentId — comment author or super admin
app.delete('/api/runs/:id/comments/:commentId', requireAuth, async (req, res) => {
  const commentId = Number(req.params.commentId);
  if (!Number.isInteger(commentId)) return res.status(400).json({ error: 'Invalid comment id' });

  try {
    const { rows } = await pool.query('SELECT user_id FROM run_comments WHERE id = $1', [commentId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }
    await pool.query('DELETE FROM run_comments WHERE id = $1', [commentId]);
    res.status(204).end();
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
