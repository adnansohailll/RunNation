import dotenv from 'dotenv';
dotenv.config();

// Dynamic import (not hoisted, unlike a static import) so dotenv.config()
// above has actually run before app.js — and everything it pulls in that
// reads process.env at module load time (db.js's Pool, middleware/auth.js)
// — gets evaluated.
const { default: app } = await import('./app.js');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
