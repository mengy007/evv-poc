// lib/db.ts
import 'server-only';
import type { Pool, PoolOptions } from 'mysql2/promise';
import mysql from 'mysql2/promise';

type SSLMode = 'disable' | 'default' | 'self-signed';

function must(name: string, v: string | undefined): string {
  if (!v || v.trim() === '') {
    throw new Error(
      `[DB ENV] Missing required env var ${name}. ` +
      `Set it in .env.local (dev) and Vercel Project Settings (prod).`
    );
  }
  return v;
}

function getConfig(): PoolOptions {
  const host = must('MYSQL_HOST', process.env.MYSQL_HOST);
  const user = must('MYSQL_USER', process.env.MYSQL_USER);
  const password = must('MYSQL_PASSWORD', process.env.MYSQL_PASSWORD);
  const database = must('MYSQL_DATABASE', process.env.MYSQL_DATABASE);
  const port = Number(process.env.MYSQL_PORT ?? '3306');
  const sslMode = (process.env.MYSQL_SSL ?? 'disable').toLowerCase() as SSLMode;

  let ssl: PoolOptions['ssl'] | undefined;
  if (sslMode === 'default') ssl = {};                // platform CA bundle
  else if (sslMode === 'self-signed') ssl = { rejectUnauthorized: false };
  // 'disable' -> leave undefined

  return {
    host,
    port,
    user,
    password,
    database,
    // Tune to your app. Small defaults are fine for serverless.
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    ssl,
    // Optional timeouts
    connectTimeout: 10_000,
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __MYSQL_POOL__: Pool | undefined;
}

function createPool(): Pool {
  const cfg = getConfig();
  return mysql.createPool(cfg);
}

export function pool(): Pool {
  // Reuse the pool across dev hot reloads
  if (!global.__MYSQL_POOL__) {
    global.__MYSQL_POOL__ = createPool();
  }
  return global.__MYSQL_POOL__!;
}

// Simple health helper (useful in API routes)
export async function dbHealth() {
  const p = pool();
  const [rows] = await p.query('SELECT 1 AS ok');
  return rows;
}
