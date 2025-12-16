const CallLog = require("../Model/CallLogModel");
const BankSchedule = require("../Model/BankScheduleModel");

async function getScheduleForDate(dateStr) {
  try {
    const doc = await BankSchedule.findOne({}).sort({ updatedAt: -1 }).lean();
    const defaultDay = {
      open: true,
      openTime: doc?.days?.[0]?.openTime || "09:00",
      closeTime: doc?.days?.[0]?.closeTime || "15:00",
    };
    if (!doc || !Array.isArray(doc.days)) return { ...defaultDay };
    const dayIdx = (new Date(dateStr).getDay() + 6) % 7; // Monday=0 ... Sunday=6
    const match = doc.days.find((d) => Number(d.dayIndex) === dayIdx);
    if (!match) return { ...defaultDay };
    return {
      open: match.open !== undefined ? Boolean(match.open) : true,
      openTime: match.openTime || defaultDay.openTime,
      closeTime: match.closeTime || defaultDay.closeTime,
    };
  } catch (err) {
    return { ...defaultDay };
  }
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function makeToken(dateStr) {
  const day = String(dateStr || "").replace(/-/g, "");
  if (!day) return null;
  return CallLog.countDocuments({ date: dateStr }).then((count) => {
    const next = String(count + 1).padStart(3, "0");
    return `T-${day}-${next}`;
  });
}

exports.receive = async (req, res) => {
  try {
    const { date, time, phone_number, id_number, service_number, arrival_time, message } = req.body || {};
    const dateStr = date || new Date().toISOString().slice(0, 10);

    const schedule = await getScheduleForDate(dateStr);
    if (!schedule.open) {
      return res.status(400).json({ message: "Bank is closed on the selected day" });
    }

    const now = new Date();
    const scheduled = new Date(now.getTime() + 60 * 60000); // +1 hour
    const close = new Date(`${dateStr}T${schedule.closeTime || "17:00"}:00`);

    if (scheduled > close) {
      return res.status(400).json({
        message: `No slots available before close at ${schedule.closeTime}`,
        close_time: schedule.closeTime,
      });
    }

    const scheduledTime = `${pad2(scheduled.getHours())}:${pad2(scheduled.getMinutes())}`;

    const token = await makeToken(dateStr);
    if (!token) return res.status(400).json({ message: "Invalid date" });

    const doc = await CallLog.create({
      date: dateStr,
      time: time || "",
      phone_number: phone_number || "",
      id_number: id_number || "",
      service_number: service_number || "",
      token,
      scheduled_time: scheduledTime,
      arrival_time: arrival_time || "",
      message: message || `Your token is scheduled at ${scheduledTime}`,
    });

    return res.status(201).json({
      ok: true,
      token: doc.token,
      countername: "", // counter assignment is not handled here; left blank
      userid: id_number || "",
      date: dateStr,
      service: service_number || "",
      phone_number: phone_number || "",
      arrival_time: arrival_time || "",
      message: doc.message,
    });
  } catch (err) {
    console.error("Call receive error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
