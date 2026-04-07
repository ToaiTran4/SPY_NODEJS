const { getDb } = require('../config/db');

async function getRandomKeyword() {
  const db = getDb();
  const count = await db.collection('keyword_pairs').countDocuments();
  if (count === 0) {
    // Default fallback
    return {
      _id: 'default',
      civilianKeyword: 'Mặt Trời',
      spyKeyword: 'Đèn',
      civilianDescription: 'Nguồn sáng tự nhiên lớn nhất trong hệ mặt trời',
      spyDescription: 'Vật phát sáng nhân tạo dùng trong nhà',
    };
  }
  const skip = Math.floor(Math.random() * count);
  const [kw] = await db.collection('keyword_pairs').find({}).skip(skip).limit(1).toArray();
  return kw;
}

async function getAllKeywords() {
  return getDb().collection('keyword_pairs').find({}).toArray();
}

async function addKeyword(pair) {
  const result = await getDb().collection('keyword_pairs').insertOne(pair);
  return { ...pair, _id: result.insertedId };
}

async function deleteKeyword(id) {
  const { ObjectId } = require('mongodb');
  return getDb().collection('keyword_pairs').deleteOne({ _id: new ObjectId(id) });
}

async function countKeywords() {
  return getDb().collection('keyword_pairs').countDocuments();
}

module.exports = { getRandomKeyword, getAllKeywords, addKeyword, deleteKeyword, countKeywords };
