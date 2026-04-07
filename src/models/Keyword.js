const mongoose = require('mongoose');

const keywordSchema = new mongoose.Schema({
  civilianKeyword: { type: String, required: true },
  spyKeyword: { type: String, required: true },
  civilianDescription: { type: String, required: true },
  spyDescription: { type: String, required: true },
  isSpecial: { type: Boolean, default: false },
  category: { type: String },
}, { collection: 'keyword_pairs', timestamps: true });

const Keyword = mongoose.model('Keyword', keywordSchema);

module.exports = Keyword;
