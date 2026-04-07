const Keyword = require('../models/Keyword');

async function getRandomKeyword() {
  const count = await Keyword.countDocuments();
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
  return Keyword.findOne({}).skip(skip);
}

async function getAllKeywords() {
  return Keyword.find({});
}

async function addKeyword(pair) {
  return Keyword.create(pair);
}

async function deleteKeyword(id) {
  return Keyword.findByIdAndDelete(id);
}

async function countKeywords() {
  return Keyword.countDocuments();
}

module.exports = { getRandomKeyword, getAllKeywords, addKeyword, deleteKeyword, countKeywords };
