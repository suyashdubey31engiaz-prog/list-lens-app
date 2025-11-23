const mongoose = require('mongoose');

const ListSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  items: [{
    text: { type: String, default: "" }, // The Scanned Text
    note: { type: String, default: "" }, // NEW: The "Side-by-Side" Note
    isChecked: { type: Boolean, default: false }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('List', ListSchema);