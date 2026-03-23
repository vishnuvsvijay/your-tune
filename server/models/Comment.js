const mongoose = require('mongoose')

const CommentSchema = new mongoose.Schema(
  {
    songId: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', index: true },
    userId: { type: String, index: true },
    name: { type: String, default: '' },
    text: { type: String, required: true },
    likes: { type: Number, default: 0 },
    likedBy: { type: [String], default: [] },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null, index: true }, // For replies
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
)

module.exports = mongoose.model('Comment', CommentSchema)
