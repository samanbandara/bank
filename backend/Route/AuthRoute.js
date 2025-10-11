const express = require('express');
const router = express.Router();
const AuthController = require('../Controlers/AuthController');

router.post('/login', AuthController.login);
router.get('/counters', AuthController.listCounters);
router.post('/counters', AuthController.createCounter);
router.get('/users', AuthController.listUsers);
router.put('/users/:id', AuthController.updatePassword);

module.exports = router;
