const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const connectSqlite3 = require('connect-sqlite3');

const { initDatabase } = require('./db');
const { router: authRouter } = require('./auth');

// Ensure required directories exist (for DB, blockchain, uploads, sessions)
const rootDir = path.join(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const uploadsDir = path.join(rootDir, 'uploads');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const SQLiteStore = connectSqlite3(session);
app.use(
  session({
    store: new SQLiteStore({
      dir: dataDir,
      db: 'sessions.sqlite',
      table: 'sessions',
      // concurrentDB option reduces SQLITE_BUSY errors for some environments
      // see https://www.npmjs.com/package/connect-sqlite3
      concurrentDB: false,
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// Mount routes
app.use('/auth', authRouter);

// Health check
app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

// Fallback route
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

async function start() {
  await initDatabase();
  const port = process.env.PORT || 3000;
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Server listening on port ${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  start().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server', error);
    process.exit(1);
  });
}

module.exports = { app, start };