const express = require('express');
const { login, logout, getUserInfo } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);

router.post('/logout', authenticate, logout);

router.get('/userinfo', authenticate, getUserInfo);

module.exports = router;
