const Service = require('../Model/ServiceModel');

// Helper to generate next serviceid like sv01, sv02...
async function generateNextId() {
  // Find highest numeric suffix
  const last = await Service.findOne({}).sort({ createdAt: -1 }).lean();
  if (!last || !last.serviceid) return 'sv01';
  const match = String(last.serviceid).match(/^sv(\d+)$/i);
  if (!match) return 'sv01';
  const num = parseInt(match[1], 10) + 1;
  return 'sv' + num.toString().padStart(2, '0');
}

exports.getAll = async (req, res) => {
  try {
    const services = await Service.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ services });
  } catch (err) {
    console.error('getAll services error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { servicename, servicepiority } = req.body || {};
    if (!servicename || !servicepiority) {
      return res.status(400).json({ message: 'servicename and servicepiority are required' });
    }
    // Normalize priority
    const priority = String(servicepiority).toLowerCase();
    if (!['low','medium','high'].includes(priority)) {
      return res.status(400).json({ message: 'servicepiority must be low, medium or high' });
    }

    const serviceid = await generateNextId();
    const created = await Service.create({ serviceid, servicename, servicepiority: priority });
    return res.status(201).json({ message: 'Created', service: created });
  } catch (err) {
    console.error('create service error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { servicename, servicepiority } = req.body || {};
    if (!servicename && !servicepiority) {
      return res.status(400).json({ message: 'Nothing to update' });
    }
    const updates = {};
    if (servicename) updates.servicename = servicename;
    if (servicepiority) {
      const p = String(servicepiority).toLowerCase();
      if (!['low','medium','high'].includes(p)) {
        return res.status(400).json({ message: 'servicepiority must be low, medium or high' });
      }
      updates.servicepiority = p;
    }
    const updated = await Service.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) return res.status(404).json({ message: 'Service not found' });
    return res.json({ message: 'Updated', service: updated });
  } catch (err) {
    console.error('update service error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Service.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Service not found' });
    return res.json({ message: 'Deleted', service: deleted });
  } catch (err) {
    console.error('delete service error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
