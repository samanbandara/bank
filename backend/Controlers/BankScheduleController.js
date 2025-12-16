const BankSchedule = require("../Model/BankScheduleModel");

function normalizeSchedule(days = []) {
  const defaults = [
    { dayIndex: 0, dayName: "Monday" },
    { dayIndex: 1, dayName: "Tuesday" },
    { dayIndex: 2, dayName: "Wednesday" },
    { dayIndex: 3, dayName: "Thursday" },
    { dayIndex: 4, dayName: "Friday" },
    { dayIndex: 5, dayName: "Saturday" },
    { dayIndex: 6, dayName: "Sunday" },
  ];

  const map = new Map();
  for (const d of days) {
    const idx = Number(d.dayIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 6) continue;
    map.set(idx, {
      dayIndex: idx,
      dayName: d.dayName || defaults[idx].dayName,
      open: Boolean(d.open),
      openTime: d.openTime || "09:00",
      closeTime: d.closeTime || "17:00",
    });
  }

  return defaults.map((d) => map.get(d.dayIndex) || { ...d, open: true, openTime: "09:00", closeTime: "17:00" });
}

exports.get = async (req, res) => {
  try {
    const doc = await BankSchedule.findOne({}).sort({ updatedAt: -1 }).lean();
    if (!doc) {
      return res.json({
        schedule: {
          days: normalizeSchedule(),
          timezone: "local",
        },
      });
    }
    return res.json({ schedule: { days: normalizeSchedule(doc.days), timezone: doc.timezone || "local" } });
  } catch (err) {
    console.error("get bank schedule error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.upsert = async (req, res) => {
  try {
    const body = req.body || {};
    const days = normalizeSchedule(body.days || []);
    const timezone = body.timezone || "local";

    const doc = await BankSchedule.findOneAndUpdate(
      {},
      { days, timezone },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ message: "saved", schedule: doc });
  } catch (err) {
    console.error("upsert bank schedule error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
