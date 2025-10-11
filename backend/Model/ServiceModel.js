const mongoose = require('mongoose');
const { Schema } = mongoose;

const ServiceSchema = new Schema({
  serviceid: { type: String, required: true, unique: true },
  servicename: { type: String, required: true },
  servicepiority: { type: String, enum: ['low','medium','high'], required: true }
}, { timestamps: true });

// Bind to existing collection name 'counterservices'
module.exports = mongoose.model('CounterService', ServiceSchema, 'counterservices');
