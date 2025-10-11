const Administrator = require('../Model/AdminModel');

// POST /auth/login
// body: { username, password }
// returns: { ok: true, role, username }
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'Username and password are required' });
    }

    const user = await Administrator.findOne({ username }).lean();
    if (!user) {
      return res.status(401).json({ ok: false, message: 'Invalid credentials' });
    }

    // NOTE: For simplicity, compare plaintext. In production, use bcrypt.
    if (user.password !== password) {
      return res.status(401).json({ ok: false, message: 'Invalid credentials' });
    }

    return res.json({ ok: true, role: user.role || (user.username.toLowerCase()==='admin'?'admin':'counter'), username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// GET /auth/counters - list counter users
exports.listCounters = async (_req, res) => {
  try {
    const counters = await Administrator.find({ role: 'counter' }).sort({ username: 1 }).lean();
    return res.json({ counters: counters.map(c => ({ _id: c._id, username: c.username })) });
  } catch (err) {
    console.error('List counters error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /auth/counters - create next counter user with auto username/password
exports.createCounter = async (_req, res) => {
  try {
    // Find existing counter users and compute next index
    const existing = await Administrator.find({ username: { $regex: /^counter\d+$/i } }, { username: 1 }).lean();
    let maxNum = 0;
    for (const u of existing) {
      const m = String(u.username).match(/^counter(\d+)$/i);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num)) maxNum = Math.max(maxNum, num);
      }
    }
    const next = maxNum + 1;
    const username = `counter${next}`;
    const password = username; // as requested, password same as username
    const created = await Administrator.create({ username, password, role: 'counter' });
    return res.status(201).json({ ok: true, user: { _id: created._id, username: created.username, password } });
  } catch (err) {
    console.error('Create counter error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// GET /auth/users - list all administrator users (including passwords)
exports.listUsers = async (_req, res) => {
  try {
    const users = await Administrator.find({}, { username: 1, role: 1, password: 1 }).sort({ role: 1, username: 1 }).lean();
    return res.json({ users });
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /auth/users/:id - update user password
exports.updatePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    if (!password || String(password).trim().length < 3) {
      return res.status(400).json({ message: 'Password must be at least 3 characters' });
    }
    const updated = await Administrator.findByIdAndUpdate(id, { password }, { new: true });
    if (!updated) return res.status(404).json({ message: 'User not found' });
    return res.json({ message: 'Password updated', user: { _id: updated._id, username: updated.username, role: updated.role } });
  } catch (err) {
    console.error('Update password error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
