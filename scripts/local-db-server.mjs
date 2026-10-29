import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import pg from 'pg';

const { Client } = pg;

const rootDir = process.cwd();
const dataDir = path.resolve(rootDir, '.data/postgres');
const binDir = path.resolve(rootDir, 'node_modules/@embedded-postgres/windows-x64/native/bin');
const initdbExe = path.resolve(binDir, 'initdb.exe');
const postgresExe = path.resolve(binDir, 'postgres.exe');

async function main() {
  console.log('[local-db] Starting local PostgreSQL server management...');

  if (!fs.existsSync(binDir)) {
    console.error(`[local-db] ERROR: PostgreSQL native binaries not found at: ${binDir}`);
    process.exit(1);
  }

  // Ensure .data dir exists
  fs.mkdirSync(path.resolve(rootDir, '.data'), { recursive: true });

  // Initialize cluster if needed
  if (!fs.existsSync(path.resolve(dataDir, 'PG_VERSION'))) {
    console.log(`[local-db] Initializing database cluster at ${dataDir}...`);
    try {
      execFileSync(initdbExe, [
        '-D', dataDir,
        '-U', 'postgres',
        '-A', 'trust',
        '--encoding=UTF8',
        '--locale=C',
      ], { stdio: 'inherit' });
      console.log('[local-db] Database cluster initialized successfully.');
    } catch (err) {
      console.error('[local-db] Failed to initialize database cluster:', err);
      process.exit(1);
    }
  } else {
    console.log(`[local-db] Existing database cluster found at ${dataDir}.`);
  }

  console.log('[local-db] Spawning PostgreSQL daemon on 127.0.0.1:5432...');
  const pgProcess = spawn(postgresExe, [
    '-D', dataDir,
    '-p', '5432',
    '-h', '127.0.0.1',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let isReady = false;

  const onData = (data) => {
    const text = data.toString('utf-8');
    process.stdout.write(text);
    if (text.includes('database system is ready to accept connections')) {
      isReady = true;
      ensureDatabaseExists().catch((err) => {
        console.error('[local-db] Error ensuring database exists:', err);
      });
    }
  };

  pgProcess.stdout.on('data', onData);
  pgProcess.stderr.on('data', onData);

  pgProcess.on('exit', (code, signal) => {
    console.log(`[local-db] PostgreSQL server exited with code ${code}, signal ${signal}`);
    process.exit(code ?? 0);
  });

  const cleanup = () => {
    console.log('[local-db] Shutting down PostgreSQL daemon...');
    if (pgProcess && !pgProcess.killed) {
      pgProcess.kill('SIGINT');
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

async function ensureDatabaseExists() {
  console.log('[local-db] Checking default database connection...');
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    database: 'postgres',
  });

  try {
    await client.connect();
    console.log('[local-db] Connected to PostgreSQL. Ensuring required databases exist...');

    // 1. p4i_office_test
    const resMain = await client.query("SELECT 1 FROM pg_database WHERE datname = 'p4i_office_test'");
    if (resMain.rows.length === 0) {
      console.log("[local-db] Creating database 'p4i_office_test'...");
      await client.query('CREATE DATABASE p4i_office_test');
      console.log("[local-db] Database 'p4i_office_test' created.");
    } else {
      console.log("[local-db] Database 'p4i_office_test' already exists.");
    }

    // 2. p4i_office_restore_test (for backup/restore round-trip testing)
    const resRestore = await client.query("SELECT 1 FROM pg_database WHERE datname = 'p4i_office_restore_test'");
    if (resRestore.rows.length === 0) {
      console.log("[local-db] Creating database 'p4i_office_restore_test'...");
      await client.query('CREATE DATABASE p4i_office_restore_test');
      console.log("[local-db] Database 'p4i_office_restore_test' created.");
    } else {
      console.log("[local-db] Database 'p4i_office_restore_test' already exists.");
    }

    console.log('[local-db] Ready for development, migration, seeding, and automated testing!');
  } catch (err) {
    console.error('[local-db] Error setting up database:', err);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[local-db] Fatal error in local-db runner:', err);
  process.exit(1);
});
