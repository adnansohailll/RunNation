// Local development only — rename this file to index.js to use it (and
// rename the original index.js aside first, or restore it before deploying
// to Vercel). Also requires db.js to be the db-local.js variant, since
// app.js imports pool from './db.js'.
//
// Uses the 'dotenv/config' side-effect import instead of importing dotenv
// and calling .config() separately: ES module imports are hoisted above
// other top-level code, so a plain `import app from './app.js'` below a
// `dotenv.config()` call would still evaluate app.js (and its db.js import)
// before .env is loaded, leaving DB_* env vars undefined at pool-construction
// time.
import 'dotenv/config';

import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
