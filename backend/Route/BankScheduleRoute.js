const express = require("express");
const router = express.Router();
const BankScheduleController = require("../Controlers/BankScheduleController");

router.get("/", BankScheduleController.get);
router.put("/", BankScheduleController.upsert);

module.exports = router;
