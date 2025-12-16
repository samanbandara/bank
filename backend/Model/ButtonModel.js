const mongoose = require("mongoose");
const { Schema } = mongoose;

const ButtonSchema = new Schema(
  {
    devicename: { type: String },
    deviceid: { type: String }, // optional unique hardware id
    button_count: { type: Number },
    assignedCounterId: { type: String },
    online: { type: Boolean, default: false },
    status: { type: String }, // legacy/status field (e.g. 'online')
    lastHeartbeatAt: { type: Date },
  },
  { timestamps: true }
);

ButtonSchema.index({ assignedCounterId: 1 });
ButtonSchema.index({ online: 1 });
ButtonSchema.index({ deviceid: 1 });

module.exports = mongoose.model("ButtonDevice", ButtonSchema, "buttons");
