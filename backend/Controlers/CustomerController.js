const Counter = require("../Model/CounterModel");
const Customer = require("../Model/CustomerModel");
const OldCustomer = require("../Model/OldCustomerModel");
const Service = require("../Model/ServiceModel");
const Button = require("../Model/ButtonModel");
const BankSchedule = require("../Model/BankScheduleModel");

// Determine candidate counters based on requested services.
function filterCountersByServices(counters, requestedServices) {
  const coversAll = [];
  const coversSome = [];
  const reqLower = requestedServices.map((s) => s.toLowerCase());
  for (const c of counters) {
    const svc = Array.isArray(c.counterservices)
      ? c.counterservices.map((x) => String(x).toLowerCase())
      : [];
    const hasAll = reqLower.every((r) => svc.includes(r));
    const hasSome = reqLower.some((r) => svc.includes(r));
    if (hasAll) coversAll.push(c);
    else if (hasSome) coversSome.push(c);
  }
  return coversAll.length ? coversAll : coversSome;
}

async function getTodayLoadMap(dateStr) {
  const todayTickets = await Customer.find(
    { date: dateStr },
    { counterid: 1 }
  ).lean();
  const load = new Map();
  for (const t of todayTickets) {
    const k = t.counterid;
    load.set(k, (load.get(k) || 0) + 1);
  }
  return load;
}

async function generateToken(dateStr) {
  // Token like T-YYYYMMDD-XXX
  const day = dateStr.replace(/-/g, "");
  const count = await Customer.countDocuments({ date: dateStr });
  const next = String(count + 1).padStart(3, "0");
  return `T-${day}-${next}`;
}

async function getScheduleForDate(dateStr) {
  const defaultDay = { open: true, openTime: "09:00", closeTime: "17:00" };
  try {
    const doc = await BankSchedule.findOne({}).sort({ updatedAt: -1 }).lean();
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
    return { ...defaultDay }; // fail open with defaults
  }
}

function addMinutes(base, mins) {
  return new Date(base.getTime() + mins * 60000);
}

exports.create = async (req, res) => {
  try {
    const { userid, date, services } = req.body || {};
    const access_type = (req.body && req.body.access_type) ? String(req.body.access_type) : "web";
    if (!userid || !date || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        message: "userid, date and services (non-empty array) are required",
      });
    }

    // Load services catalog to build normalization maps
    const svcCatalog = await Service.find(
      {},
      { _id: 1, serviceid: 1, servicename: 1, average_minutes: 1 }
    ).lean();
    const idToSid = new Map();
    const nameToSid = new Map();
    const sidToSid = new Map();
    for (const s of svcCatalog) {
      const sid = String(s.serviceid || "").toLowerCase();
      const _id = String(s._id || "");
      const name = String(s.servicename || "").toLowerCase();
      if (sid) sidToSid.set(sid, sid);
      if (_id && sid) idToSid.set(_id, sid);
      if (name && sid) nameToSid.set(name, sid);
    }

    const normalizeList = (arr) => {
      const out = [];
      for (const raw of arr || []) {
        const v = String(raw || "");
        const vLower = v.toLowerCase();
        let norm = null;
        // Try by ObjectId
        if (/^[0-9a-fA-F]{24}$/.test(v)) {
          norm = idToSid.get(v);
        }
        // Try by serviceid
        if (!norm) {
          norm = sidToSid.get(vLower);
        }
        // Try by servicename
        if (!norm) {
          norm = nameToSid.get(vLower);
        }
        // Fallback: if it looks like a serviceid pattern, keep lowercased
        if (!norm && /^sv\d+$/i.test(v)) {
          norm = vLower;
        }
        if (norm) out.push(norm);
      }
      return out;
    };

    // Normalize requested services to serviceid (lowercase)
    const reqServiceIds = normalizeList(services);
    if (!reqServiceIds.length) {
      return res.status(400).json({
        message: "Requested services did not match any known service IDs",
      });
    }

    const schedule = await getScheduleForDate(date);
    if (!schedule.open) {
      return res.status(400).json({ message: "Bank is closed on the selected day" });
    }

    const counters = await Counter.find({}).lean();
    if (!counters || counters.length === 0) {
      return res.status(400).json({ message: "No counters available" });
    }

    // Normalize each counter's supported services before matching
    const countersNormalized = counters.map((c) => ({
      ...c,
      counterservices: normalizeList(c.counterservices || []),
    }));

    let candidates = filterCountersByServices(countersNormalized, reqServiceIds);
    if (!candidates.length) {
      return res
        .status(400)
        .json({ message: "No counter supports the requested services" });
    }

    // If user provided an ordered list (first service priority), prefer counters that serve the first service
    const firstService = reqServiceIds[0];
    if (firstService) {
      const firstCandidates = candidates.filter((c) =>
        Array.isArray(c.counterservices) && c.counterservices.includes(firstService)
      );
      if (firstCandidates.length) {
        candidates = firstCandidates;
      }
    }

    // Prefer counters whose assigned button device is online (if any exist)
    try {
      const buttonDocs = await Button.find(
        { assignedCounterId: { $in: candidates.map((c) => c.counterid) } },
        { assignedCounterId: 1, online: 1, status: 1 }
      ).lean();
      const onlineSet = new Set(
        buttonDocs
          .filter((b) => b.online === true || b.status === "online")
          .map((b) => b.assignedCounterId)
      );
      const onlineCandidates = candidates.filter((c) =>
        onlineSet.has(c.counterid)
      );
      if (onlineCandidates.length) {
        candidates = onlineCandidates; // only keep online ones if any
      }
    } catch (e) {
      // Ignore button filtering errors – proceed without it
    }

    const loadMap = await getTodayLoadMap(date);
    candidates.sort((a, b) => {
      const la = loadMap.get(a.counterid) || 0;
      const lb = loadMap.get(b.counterid) || 0;
      if (la !== lb) return la - lb; // fewer tickets first
      const ta = a.lastAssignedAt ? new Date(a.lastAssignedAt).getTime() : 0;
      const tb = b.lastAssignedAt ? new Date(b.lastAssignedAt).getTime() : 0;
      if (ta !== tb) return ta - tb; // least recently assigned first
      return String(a.counterid).localeCompare(String(b.counterid)); // stable tie-break
    });
    const assigned = candidates[0];

    // Update fairness marker
    try {
      await Counter.updateOne(
        { _id: assigned._id },
        { $set: { lastAssignedAt: new Date() } }
      );
    } catch (_) {}

    // ETA calculation: if no customers, opening time; else add queue length * avg minutes
    const loadForCounter = loadMap.get(assigned.counterid) || 0;

    // derive average minutes from requested services
    const avgMinutes = (() => {
      const serviceMap = new Map();
      for (const s of svcCatalog) {
        serviceMap.set(String(s.serviceid).toLowerCase(), Number(s.average_minutes) || 0);
      }
      const vals = reqServiceIds
        .map((sid) => serviceMap.get(String(sid).toLowerCase()) || 0)
        .filter((v) => Number.isFinite(v) && v > 0);
      if (!vals.length) return 5; // fallback
      const sum = vals.reduce((a, b) => a + b, 0);
      return sum / vals.length;
    })();

    const queueMinutes = loadForCounter * avgMinutes;

    // establish base time: date's opening time (on selected day), but not earlier than now if same day
    const opening = new Date(`${date}T${schedule.openTime || "09:00"}:00`);
    const now = new Date();
    let base = opening;
    const isSameDay = opening.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
    if (isSameDay && now > opening) {
      base = now; // already past opening today
    }

    let etaDate = base;
    if (loadForCounter === 0) {
      etaDate = base; // first customer: base respects current time if today
    } else {
      etaDate = addMinutes(base, queueMinutes);
    }

    const pad2 = (n) => String(n).padStart(2, "0");
    const etaTime = `${pad2(etaDate.getHours())}:${pad2(etaDate.getMinutes())}`;

    const token = await generateToken(date);
    const created = await Customer.create({
      userid,
      date,
      services: reqServiceIds,
      counterid: assigned.counterid,
      token,
      access_type,
      arrival_time: etaTime,
    });

    return res
      .status(201)
      .json({ ok: true, token, counter: assigned, customer: created, eta_time: etaTime });
  } catch (err) {
    console.error("customer.create error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.list = async (req, res) => {
  try {
    // Query params: page, limit, q, date, counterid
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "20", 10), 1),
      200
    );
    const q = String(req.query.q || "").trim();
    const date = String(req.query.date || "").trim();
    const counterid = String(req.query.counterid || "").trim();
    const sort = String(req.query.sort || "createdAt").trim();
    const dir = String(req.query.dir || "asc")
      .trim()
      .toLowerCase();

    const filter = {};
    if (date) filter.date = date;
    if (counterid) filter.counterid = counterid;
    if (q) {
      // search in token or userid prefix
      filter.$or = [
        { token: { $regex: q, $options: "i" } },
        { userid: { $regex: q, $options: "i" } },
      ];
    }
    const sortFieldMap = new Map([
      ["createdAt", "createdAt"],
      ["date", "date"],
      ["token", "token"],
      ["userid", "userid"],
      ["counterid", "counterid"],
    ]);
    const sortField = sortFieldMap.get(sort) || "createdAt";
    const sortOrder = dir === "asc" ? 1 : -1;

    const [total, customers] = await Promise.all([
      Customer.countDocuments(filter),
      Customer.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
    if (!customers.length)
      return res.json({
        customers: [],
        total,
        page,
        pages: Math.ceil(total / limit),
      });

    // Load counters and services for name resolution
    const [counters, services] = await Promise.all([
      Counter.find({}, { counterid: 1, countername: 1 }).lean(),
      Service.find({}, { serviceid: 1, servicename: 1 }).lean(),
    ]);
    const counterMap = new Map(
      counters.map((c) => [String(c.counterid), String(c.countername)])
    );
    const serviceMap = new Map(
      services.map((s) => [
        String(s.serviceid).toLowerCase(),
        String(s.servicename),
      ])
    );

    const enriched = customers.map((c) => ({
      _id: String(c._id),
      userid: c.userid,
      date: c.date,
      token: c.token,
      counterid: c.counterid,
      countername: counterMap.get(String(c.counterid)) || c.counterid,
      services: c.services || [],
      serviceNames: (c.services || []).map(
        (sid) => serviceMap.get(String(sid).toLowerCase()) || sid
      ),
      createdAt: c.createdAt,
      arrival_time: c.arrival_time,
      access_type: c.access_type,
    }));

    return res.json({
      customers: enriched,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("customer.list error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateCounter = async (req, res) => {
  try {
    const { id } = req.params;
    const { counterid } = req.body || {};
    if (!counterid) {
      return res.status(400).json({ message: "counterid is required" });
    }

    const customer = await Customer.findById(id).lean();
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    // Ensure the target counter exists
    const target = await Counter.findOne({ counterid }).lean();
    if (!target) return res.status(404).json({ message: "Counter not found" });

    // Optional: Validate target counter supports at least one requested service
    try {
      const svcCatalog = await Service.find(
        {},
        { _id: 1, serviceid: 1, servicename: 1 }
      ).lean();
      const idToSid = new Map();
      const nameToSid = new Map();
      const sidToSid = new Map();
      for (const s of svcCatalog) {
        const sid = String(s.serviceid || "").toLowerCase();
        const _id = String(s._id || "");
        const name = String(s.servicename || "").toLowerCase();
        if (sid) sidToSid.set(sid, sid);
        if (_id && sid) idToSid.set(_id, sid);
        if (name && sid) nameToSid.set(name, sid);
      }
      const normalizeList = (arr) => {
        const out = [];
        for (const raw of arr || []) {
          const v = String(raw || "");
          const vLower = v.toLowerCase();
          let norm = null;
          if (/^[0-9a-fA-F]{24}$/.test(v)) norm = idToSid.get(v);
          if (!norm) norm = sidToSid.get(vLower);
          if (!norm) norm = nameToSid.get(vLower);
          if (!norm && /^sv\d+$/i.test(v)) norm = vLower;
          if (norm) out.push(norm);
        }
        return out;
      };

      const customerSvc = normalizeList(customer.services || []);
      const targetSvc = normalizeList(target.counterservices || []);
      const supportsSome = customerSvc.some((s) => targetSvc.includes(s));
      if (!supportsSome) {
        return res.status(400).json({
          message:
            "Selected counter does not support any of the customer's services",
        });
      }
    } catch (_) {
      // If validation fails due to mapping, ignore and proceed
    }

    const updated = await Customer.findByIdAndUpdate(
      id,
      { $set: { counterid } },
      { new: true }
    ).lean();

    const countername = target.countername || counterid;
    return res.json({
      ok: true,
      message: "Counter updated",
      customer: updated,
      counter: { counterid, countername },
    });
  } catch (err) {
    console.error("customer.updateCounter error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /customers/archive?before=YYYY-MM-DD
// Moves all customers with date < before into the oldcustomers collection, then deletes them from active customers.
exports.archiveOld = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const before = String(req.query.before || todayStr).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) {
      return res.status(400).json({ message: "Invalid 'before' date format; expected YYYY-MM-DD" });
    }

    const criteria = { date: { $lt: before } };
    const docs = await Customer.find(criteria).lean();
    if (!docs.length) {
      return res.json({ ok: true, moved: 0 });
    }

    // Insert into archive collection
    await OldCustomer.insertMany(docs, { ordered: false });

    // Remove from active collection
    const ids = docs.map((d) => d._id);
    await Customer.deleteMany({ _id: { $in: ids } });

    return res.json({ ok: true, moved: docs.length, before });
  } catch (err) {
    console.error("customer.archiveOld error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
