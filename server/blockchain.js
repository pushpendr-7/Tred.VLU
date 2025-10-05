const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const chainFilePath = path.join(__dirname, '..', 'data', 'blockchain.json');

function ensureChainFile() {
  if (!fs.existsSync(chainFilePath)) {
    const genesis = createBlock({
      index: 0,
      timestamp: new Date().toISOString(),
      eventType: 'GENESIS',
      payload: {},
      previousHash: '0',
    });
    saveChain([genesis]);
  }
}

function loadChain() {
  ensureChainFile();
  const content = fs.readFileSync(chainFilePath, 'utf-8');
  return JSON.parse(content);
}

function saveChain(chain) {
  fs.writeFileSync(chainFilePath, JSON.stringify(chain, null, 2));
}

function hashBlock(blockWithoutHash) {
  const json = JSON.stringify(blockWithoutHash);
  return crypto.createHash('sha256').update(json).digest('hex');
}

function createBlock({ index, timestamp, eventType, payload, previousHash }) {
  const base = { index, timestamp, eventType, payload, previousHash };
  const hash = hashBlock(base);
  return { ...base, hash };
}

function addEvent(eventType, payload) {
  const chain = loadChain();
  const last = chain[chain.length - 1];
  const block = createBlock({
    index: last.index + 1,
    timestamp: new Date().toISOString(),
    eventType,
    payload,
    previousHash: last.hash,
  });
  chain.push(block);
  saveChain(chain);
  return block;
}

function validateChain() {
  const chain = loadChain();
  for (let i = 1; i < chain.length; i += 1) {
    const prev = chain[i - 1];
    const curr = chain[i];
    const expectedHash = hashBlock({
      index: curr.index,
      timestamp: curr.timestamp,
      eventType: curr.eventType,
      payload: curr.payload,
      previousHash: curr.previousHash,
    });
    if (curr.previousHash !== prev.hash) return false;
    if (curr.hash !== expectedHash) return false;
  }
  return true;
}

function getChain() {
  return loadChain();
}

module.exports = {
  addEvent,
  validateChain,
  getChain,
};
