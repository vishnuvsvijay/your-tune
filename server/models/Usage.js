const mongoose = require('mongoose')

const UsageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    seconds: { type: Number, default: 0 },
    at: { type: Date, default: Date.now, index: true },
    songId: { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },
    meta: { type: Object, default: {} },
  },
  { timestamps: false }
)

module.exports = mongoose.model('Usage', UsageSchema)

