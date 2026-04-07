const mongoose = require('mongoose');

const userInventorySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  skillId: { type: String, required: true },
  skillType: { type: String },
  quantity: { type: Number, default: 0 },
}, { collection: 'user_inventory', timestamps: true });

const UserInventory = mongoose.model('UserInventory', userInventorySchema);

module.exports = UserInventory;
