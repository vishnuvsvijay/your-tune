const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    playlists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Playlist' }],
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
)

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
})

UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password)
}

const User = mongoose.model('User', UserSchema)
User.on('index', (err) => {
  if (err) console.error('User Model Index Error:', err.message)
})
module.exports = User
