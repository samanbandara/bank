const mongoose = require("mongoose");
const { Schema } = mongoose;

const OldCustomerSchema = new Schema(
  {
    userid: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    services: { type: [String], default: [] }, // service IDs
    counterid: { type: String, required: true },
    token: { type: String, required: true },
    access_type: { type: String },
    arrival_time: { type: String },
    served_seconds: { type: Number },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

OldCustomerSchema.index({ createdAt: -1 });
OldCustomerSchema.index({ date: 1 });
OldCustomerSchema.index({ token: 1 }, { unique: false });
OldCustomerSchema.index({ userid: 1 });
OldCustomerSchema.index({ counterid: 1, date: 1 });

module.exports = mongoose.model("OldCustomer", OldCustomerSchema, "oldcustomers");
