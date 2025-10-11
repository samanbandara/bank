const counter = require("../Model/CounterModel");
const Administrator = require("../Model/AdminModel");

async function generateNextCounterId() {
  // Generate counter id like counter1, counter2, ... based on existing docs
  const list = await counter
    .find({ counterid: { $regex: /^counter\d+$/i } }, { counterid: 1 })
    .lean();
  let maxNum = 0;
  for (const c of list) {
    const m = String(c.counterid).match(/^counter(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n)) maxNum = Math.max(maxNum, n);
    }
  }
  return `counter${maxNum + 1}`;
}

const getAllCounters = async (req, res, next) => {
  let counters;
  try {
    counters = await counter.find();
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
  if (!counters || counters.length === 0) {
    return res.status(200).json({ counters: [] });
  }

  return res.status(200).json({ counters });
};

const addCounter = async (req, res, next) => {
  let { counterid, countername, counterservices } = req.body || {};
  try {
    if (!counterid) {
      counterid = await generateNextCounterId();
    }
    if (!countername) {
      countername = counterid;
    }
    if (!Array.isArray(counterservices)) {
      counterservices = [];
    }
    if (counterservices.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one service must be selected" });
    }
    const existingCounter = await counter.findOne({ counterid });
    if (existingCounter) {
      return res.status(400).json({ message: "Counter already exists" });
    }
    const created = new counter({ counterid, countername, counterservices });
    await created.save();
    return res
      .status(201)
      .json({ message: "Counter added successfully", counter: created });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const deleteCounter = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await counter.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Counter not found" });

    // Also delete corresponding administrator user if present
    const username = deleted.counterid || deleted.countername;
    if (username) {
      try {
        await Administrator.findOneAndDelete({ username, role: "counter" });
      } catch (e) {
        console.warn(
          "Failed to delete admin user for counter:",
          username,
          e?.message
        );
      }
    }

    return res.json({ message: "Deleted", counter: deleted });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const updateCounter = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { counterservices } = req.body || {};
    if (!Array.isArray(counterservices)) counterservices = [];
    if (counterservices.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one service must be selected" });
    }
    const updated = await counter.findByIdAndUpdate(
      id,
      { $set: { counterservices } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Counter not found" });
    return res.json({ message: "Updated", counter: updated });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllCounters = getAllCounters;
exports.addCounter = addCounter;
exports.deleteCounter = deleteCounter;
exports.updateCounter = updateCounter;
