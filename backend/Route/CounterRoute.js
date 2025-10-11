const express = require("express");
const router = express.Router();
const CounterController = require("../Controlers/CounterController");

router.get("/", CounterController.getAllCounters);
router.post("/", CounterController.addCounter);
router.delete("/:id", CounterController.deleteCounter);
router.put("/:id", CounterController.updateCounter);

module.exports = router;
