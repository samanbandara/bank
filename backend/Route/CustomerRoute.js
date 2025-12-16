const express = require("express");
const router = express.Router();
const CustomerController = require("../Controlers/CustomerController");

router.post("/", CustomerController.create);
router.get("/", CustomerController.list);
router.put("/:id/counter", CustomerController.updateCounter);
router.post("/archive", CustomerController.archiveOld);

module.exports = router;
