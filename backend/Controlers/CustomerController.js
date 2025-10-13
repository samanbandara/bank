const Counter = require("../Model/CounterModel");
const Customer = require("../Model/CustomerModel");
const Service = require("../Model/ServiceModel");

function pickCounter(counters, requestedServices) {
  // Simple heuristic:
  // 1) Counters that cover ALL requested services
  // 2) Otherwise counters that cover at least one
  // 3) Tie-breaker: fewest existing tickets today (load), then lexicographical by counterid
  const coversAll = [];
  const coversSome = [];
  for (const c of counters) {
    const svc = Array.isArray(c.counterservices)
      ? c.counterservices.map((x) => String(x).toLowerCase())
      : [];
    const req = requestedServices.map((x) => String(x).toLowerCase());
    const hasAll = req.every((r) => svc.includes(r));
    const hasSome = req.some((r) => svc.includes(r));
    if (hasAll) coversAll.push(c);
    else if (hasSome) coversSome.push(c);
  }
  const pool = coversAll.length ? coversAll : coversSome;
  return pool;
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

exports.create = async (req, res) => {
  try {
    const { userid, date, services } = req.body || {};
    if (!userid || !date || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        message: "userid, date and services (non-empty array) are required",
      });
    }

    // Load services catalog to build normalization maps
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

    const counters = await Counter.find({}).lean();
    if (!counters || counters.length === 0) {
      return res.status(400).json({ message: "No counters available" });
    }

    // Normalize each counter's supported services before matching
    const countersNormalized = counters.map((c) => ({
      ...c,
      counterservices: normalizeList(c.counterservices || []),
    }));

    const candidates = pickCounter(countersNormalized, reqServiceIds);
    if (!candidates.length) {
      return res
        .status(400)
        .json({ message: "No counter supports the requested services" });
    }

    const loadMap = await getTodayLoadMap(date);
    candidates.sort((a, b) => {
      const la = loadMap.get(a.counterid) || 0;
      const lb = loadMap.get(b.counterid) || 0;
      if (la !== lb) return la - lb;
      return String(a.counterid).localeCompare(String(b.counterid));
    });
    const assigned = candidates[0];

    const token = await generateToken(date);
    const created = await Customer.create({
      userid,
      date,
      services: reqServiceIds,
      counterid: assigned.counterid,
      token,
    });
    return res
      .status(201)
      .json({ ok: true, token, counter: assigned, customer: created });
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
