const express = require('express');
const bcrypt = require('bcryptjs');
const { createUser, getUserByEmail, getUserById } = require('./db');
const { addEvent } = require('./blockchain');

const router = express.Router();

function sanitizeUser(userRow) {
  if (!userRow) return null;
  const { id, email, name, address, created_at } = userRow;
  return { id, email, name, address, created_at };
}

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, address } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const existing = await getUserByEmail(email.trim().toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({
      email: email.trim().toLowerCase(),
      passwordHash,
      name: name.trim(),
      address: (address || '').trim(),
    });
    req.session.userId = user.id;
    addEvent('USER_REGISTERED', { userId: user.id, email: user.email });
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
    const user = await getUserByEmail(email.trim().toLowerCase());
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    req.session.userId = user.id;
    addEvent('USER_LOGGED_IN', { userId: user.id });
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', async (req, res) => {
  const userId = req.session?.userId;
  req.session.destroy(() => {
    if (userId) addEvent('USER_LOGGED_OUT', { userId });
    res.json({ ok: true });
  });
});

router.get('/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.json({ user: null });
    const user = await getUserById(req.session.userId);
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = { router, requireAuth };
