const { MongoClient } = require('mongodb');

let db = null;

async function connectDb() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/spygame_dev';
  console.log('[MongoDB] URI from process.env:', process.env.MONGODB_URI);
  console.log('[MongoDB] Connecting to:', uri);
  const client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  console.log('[MongoDB] Connected to:', db.databaseName);
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not connected. Call connectDb() first.');
  return db;
}

module.exports = { connectDb, getDb };
