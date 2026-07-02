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
