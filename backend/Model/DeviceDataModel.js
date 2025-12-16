const mongoose = require("mongoose");

const DeviceDataSchema = new mongoose.Schema(
  {
    device_name: { type: String, default: "" },
    generated_date: { type: String, default: "" },
    generated_time: { type: String, default: "" },
    "2g": {
      operator: { type: String, default: "" },
      sim: { type: String, default: "" },
      data: { type: String, default: "" },
      voice: { type: String, default: "" },
      rssi: { type: Number, default: -1 },
    },
    wifi: {
      ssid: { type: String, default: "" },
      rssi: { type: String, default: "" },
      ip: { type: String, default: "" },
    },
  },
  { collection: "device_data", timestamps: true }
);

module.exports = mongoose.model("DeviceData", DeviceDataSchema);
