const mongoose = require("mongoose");
const { Schema } = mongoose;

const DaySchema = new Schema(
  {
    dayIndex: { type: Number, required: true, min: 0, max: 6 },
    dayName: { type: String, required: true },
    open: { type: Boolean, default: true },
    openTime: { type: String, default: "09:00" },
    closeTime: { type: String, default: "17:00" },
  },
  { _id: false }
);

const BankScheduleSchema = new Schema(
  {
    days: { type: [DaySchema], required: true },
    timezone: { type: String, default: "local" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BankSchedule", BankScheduleSchema, "bank_schedules");
