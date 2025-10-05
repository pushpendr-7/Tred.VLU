const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');

const { initDatabase } = require('./db');
const { router: authRouter } = require('./auth');
const { getChain, validateChain } = require('./blockchain');

// Ensure data directory exists for sqlite and blockchain files
const dataDirPath = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDirPath)) {
  fs.mkdirSync(dataDirPath, { recursive: true });
}

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const SQLiteStore = SQLiteStoreFactory(session);
app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: dataDirPath }),
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

// Routes
app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);

app.get('/api/chain', (_req, res) => {
  try {
    const chain = getChain();
    const valid = validateChain();
    res.json({ valid, length: chain.length, chain });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load chain' });
  }
});

app.get('/', (_req, res) => {
  res.send('Tred.VLU server is running. See /healthz and /api/* endpoints.');
});

// Boot
(async () => {
  try {
    await initDatabase();
  } catch (error) {
    // If DB init fails, crash early so platform restarts the service
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
})();
