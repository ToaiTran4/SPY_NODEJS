const mongoose = require('mongoose');

let db = null;

async function connectDb() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/spygame_dev';
  console.log('[Mongoose] URI from process.env:', process.env.MONGODB_URI);
  console.log('[Mongoose] Connecting to:', uri);
  
  try {
    await mongoose.connect(uri);
    db = mongoose.connection.db;
    console.log('[Mongoose] Connected to:', db.databaseName);
    return db;
  } catch (error) {
    console.error('[Mongoose] Connection error:', error);
    process.exit(1);
  }
}

function getDb() {
  if (!db) {
    // If mongoose is connected, we can get the db instance
    if (mongoose.connection && mongoose.connection.db) {
      db = mongoose.connection.db;
      return db;
    }
    throw new Error('Database not connected. Call connectDb() first.');
  }
  return db;
}

module.exports = { connectDb, getDb };
