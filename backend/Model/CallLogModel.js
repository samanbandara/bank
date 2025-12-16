const mongoose = require("mongoose");

const CallLogSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String, default: "" },
    phone_number: { type: String, default: "" },
    id_number: { type: String, default: "" },
    service_number: { type: String, default: "" },
    token: { type: String, default: "" },
    scheduled_time: { type: String, default: "" },
    arrival_time: { type: String, default: "" },
    message: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CallLog", CallLogSchema);
