const mongoose = require("mongoose");
const { Schema } = mongoose;

const CustomerSchema = new Schema(
  {
    userid: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    services: { type: [String], default: [] }, // service IDs
    counterid: { type: String, required: true },
    token: { type: String, required: true },
  },
  { timestamps: true }
);

// Indexes for performance on larger datasets
CustomerSchema.index({ createdAt: -1 });
CustomerSchema.index({ date: 1 });
CustomerSchema.index({ token: 1 }, { unique: false });
CustomerSchema.index({ userid: 1 });
CustomerSchema.index({ counterid: 1, date: 1 });

module.exports = mongoose.model("Customer", CustomerSchema, "customers");
