# Hello World — React + Tailwind CSS + Node.js + PostgreSQL

A full-stack Hello World app.

## Structure

```
runs/
├── client/   # React + Tailwind CSS (Vite)
└── server/   # Node.js + Express + PostgreSQL
```

## Prerequisites

- Node.js 18+
- PostgreSQL running locally

## Setup

### 1. Database

Create a PostgreSQL database:

```sql
CREATE DATABASE hello_world;
```

### 2. Backend

```bash
cd server
cp .env.example .env
# Edit .env with your PostgreSQL credentials
npm start
```

The server runs on **http://localhost:3001**.

### 3. Frontend

```bash
cd client
npm run dev
```

The app runs on **http://localhost:5173**.

## API Endpoints

| Method | Path          | Description                     |
|--------|---------------|---------------------------------|
| GET    | /api/hello    | Returns a message from PostgreSQL |
| GET    | /api/health   | Health check                    |

## Deploying to Vercel

The repo root has `vercel.json` and `api/index.js`, which expose the Express
app (`server/src/app.js`) as a Vercel serverless function, alongside the
`client/` Vite build served as static output.

1. Provision a hosted Postgres database (Vercel Postgres, Neon, Supabase, etc.)
   and run the same schema/data as your local `run_metadata` table.
2. In the Vercel project's **Settings → Environment Variables**, add:
   - `DATABASE_URL` — the hosted Postgres connection string.
   - (No `PORT` or `DB_HOST`/local vars are needed in production.)
3. Deploy. Vercel runs `npm run build` (builds `client/`) and bundles
   `api/index.js` as a serverless function; `/api/*` requests are rewritten
   to it.

Local `.env`/`.env.local` files are never deployed — they're git-ignored and
only used for `npm run dev`. Production credentials live in Vercel's
Environment Variables, not in the repo.
