const mongoose = require('mongoose');
const { Schema } = mongoose;

const AdminSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'counter'], default: 'counter' }
}, { timestamps: true });

// Explicitly bind to collection name 'administrator'
module.exports = mongoose.model('Administrator', AdminSchema, 'administrator');
