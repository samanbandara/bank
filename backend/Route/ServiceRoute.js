const express = require('express');
const router = express.Router();
const ServiceController = require('../Controlers/ServiceController');

router.get('/', ServiceController.getAll);
router.post('/', ServiceController.create);
router.put('/:id', ServiceController.update);
router.delete('/:id', ServiceController.remove);

module.exports = router;
