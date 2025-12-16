const express = require("express");
const router = express.Router();
const CustomerController = require("../Controlers/CustomerController");
const CallLog = require("../Model/CallLogModel");

async function createCustomer(payload) {
	return new Promise((resolve, reject) => {
		const fakeReq = { body: payload };
		const fakeRes = {
			status(code) {
				this.statusCode = code;
				return this;
			},
			json(data) {
				resolve({ statusCode: this.statusCode || 200, data });
			},
		};
		CustomerController.create(fakeReq, fakeRes).catch(reject);
	});
}

// Accept ESP payload and map to customer creation
router.post("/", (req, res, next) => {
	const { id_number, service_number, date } = req.body || {};
	if (!id_number || String(id_number).length !== 12) {
		return res.status(400).json({ message: "id_number (12 digits) is required" });
	}
	if (!service_number) {
		return res.status(400).json({ message: "service_number is required" });
	}
	if (!date) {
		return res.status(400).json({ message: "date is required" });
	}
	const phone = String(req.body.phone_number || "");

	const payload = {
		userid: String(id_number),
		date: String(date),
		services: [String(service_number)],
		access_type: "call",
	};

	createCustomer(payload)
		.then(({ statusCode, data }) => {
			if (statusCode >= 400 || !data || !data.token || !data.counter) {
				return res.status(statusCode || 500).json(data || { message: "Failed to create customer" });
			}
			return res.json({
				phone_number: phone,
				token: data.token,
				countername: data.counter.countername || data.counter.counterid,
				userid: payload.userid,
				date: payload.date,
				service: payload.services[0],
			});
		})
		.catch((err) => {
			console.error("CallRoute /calls error", err);
			return res.status(500).json({ message: "Internal server error" });
		});
});

// Store call-end payload into calllogs collection
router.post("/log", async (req, res) => {
	try {
		const { date, time, phone_number, id_number, service_number, token } = req.body || {};
		if (!date || !time || !phone_number) {
			return res.status(400).json({ message: "date, time, and phone_number are required" });
		}
		const doc = await CallLog.create({
			date: String(date),
			time: String(time || ""),
			phone_number: String(phone_number || ""),
			id_number: String(id_number || ""),
			service_number: String(service_number || ""),
			token: String(token || ""),
		});
		return res.status(201).json({ message: "stored", id: doc._id });
	} catch (err) {
		console.error("/calls/log error", err);
		return res.status(500).json({ message: "Internal server error" });
	}
});

module.exports = router;
