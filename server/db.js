const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const databaseFilePath = path.join(__dirname, '..', 'data', 'app.db');

function openDatabase() {
  const database = new sqlite3.Database(databaseFilePath);
  return database;
}

function promisify(database) {
  return {
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        database.run(sql, params, function onRun(error) {
          if (error) return reject(error);
          resolve({ id: this.lastID, changes: this.changes });
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        database.get(sql, params, function onGet(error, row) {
          if (error) return reject(error);
          resolve(row);
        });
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        database.all(sql, params, function onAll(error, rows) {
          if (error) return reject(error);
          resolve(rows);
        });
      });
    },
    raw: database,
  };
}

const db = promisify(openDatabase());

async function initDatabase() {
  await db.run(`PRAGMA foreign_keys = ON;`);

  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      image_path TEXT,
      address TEXT,
      start_price REAL NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      activated_at TEXT,
      end_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(item_id) REFERENCES items(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      buyer_user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      raw_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(item_id) REFERENCES items(id),
      FOREIGN KEY(buyer_user_id) REFERENCES users(id)
    );
  `);

  await db.run(`CREATE INDEX IF NOT EXISTS idx_bids_item_created ON bids(item_id, created_at DESC);`);
}

async function createUser({ email, passwordHash, name, address }) {
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO users (email, password_hash, name, address, created_at) VALUES (?, ?, ?, ?, ?)`,
    [email, passwordHash, name, address || '', now]
  );
  return { id: result.id, email, name, address: address || '', created_at: now };
}

function getUserByEmail(email) {
  return db.get(`SELECT * FROM users WHERE email = ?`, [email]);
}

function getUserById(id) {
  return db.get(`SELECT * FROM users WHERE id = ?`, [id]);
}

async function createItem({ userId, title, description, imagePath, address, startPrice }) {
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO items (user_id, title, description, image_path, address, start_price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, title, description || '', imagePath || '', address || '', startPrice, now]
  );
  return getItemById(result.id);
}

function listItemsWithHighestBid() {
  return db.all(`
    SELECT i.*, 
           (SELECT MAX(b.amount) FROM bids b WHERE b.item_id = i.id) AS highest_bid,
           (SELECT COUNT(DISTINCT b2.user_id) FROM bids b2 WHERE b2.item_id = i.id) AS unique_bidders
    FROM items i
    ORDER BY i.created_at DESC
  `);
}

function getItemById(itemId) {
  return db.get(`
    SELECT i.*, 
           (SELECT MAX(b.amount) FROM bids b WHERE b.item_id = i.id) AS highest_bid,
           (SELECT COUNT(DISTINCT b2.user_id) FROM bids b2 WHERE b2.item_id = i.id) AS unique_bidders
    FROM items i
    WHERE i.id = ?
  `, [itemId]);
}

function listBidsForItem(itemId) {
  return db.all(
    `SELECT b.*, u.name AS bidder_name FROM bids b JOIN users u ON u.id = b.user_id WHERE b.item_id = ? ORDER BY b.created_at DESC`,
    [itemId]
  );
}

function getHighestBidForItem(itemId) {
  return db.get(`SELECT MAX(amount) as amount FROM bids WHERE item_id = ?`, [itemId]);
}

function countUniqueBiddersForItem(itemId) {
  return db.get(`SELECT COUNT(DISTINCT user_id) AS num FROM bids WHERE item_id = ?`, [itemId]);
}

async function addBid({ itemId, userId, amount }) {
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO bids (item_id, user_id, amount, created_at) VALUES (?, ?, ?, ?)`,
    [itemId, userId, amount, now]
  );
  return db.get(`SELECT * FROM bids WHERE id = ?`, [result.id]);
}

async function activateAuctionIfEligible(itemId, minUniqueBidders = 2, durationMs = 24 * 60 * 60 * 1000) {
  const item = await getItemById(itemId);
  if (!item) return null;
  if (item.is_active) return item;
  const { num } = await countUniqueBiddersForItem(itemId);
  if ((num || 0) >= minUniqueBidders) {
    const activatedAt = new Date();
    const endAt = new Date(activatedAt.getTime() + durationMs);
    await db.run(`UPDATE items SET is_active = 1, activated_at = ?, end_at = ? WHERE id = ?`, [
      activatedAt.toISOString(),
      endAt.toISOString(),
      itemId,
    ]);
    return getItemById(itemId);
  }
  return item;
}

async function getPaymentForItem(itemId) {
  return db.get(`SELECT * FROM payments WHERE item_id = ? ORDER BY created_at DESC LIMIT 1`, [itemId]);
}

module.exports = {
  db,
  initDatabase,
  createUser,
  getUserByEmail,
  getUserById,
  createItem,
  listItemsWithHighestBid,
  getItemById,
  listBidsForItem,
  getHighestBidForItem,
  countUniqueBiddersForItem,
  addBid,
  activateAuctionIfEligible,
  getPaymentForItem,
};
