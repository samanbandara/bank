const mongoose = require("mongoose");

const SmsSchema = new mongoose.Schema(
  {
    sender: { type: String, required: true },
    received_time: { type: String, default: "" },
    message: { type: String, default: "" },
    storage: { type: String, default: "" },
  },
  { collection: "sms", timestamps: true }
);

module.exports = mongoose.model("Sms", SmsSchema);
