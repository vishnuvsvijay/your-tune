const mongoose = require('mongoose')

const SongSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    artist: { type: String, required: true },
    album: { type: String },
    genre: { type: String },
    fileId: { type: mongoose.Schema.Types.ObjectId },
    fileUrl: { type: String }, // Made optional to allow metadata-only songs
    coverImage: { type: String },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminUpload: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
)

module.exports = mongoose.model('Song', SongSchema)
