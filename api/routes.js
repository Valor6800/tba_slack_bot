'use strict'

const express = require('express');
const router = express.Router();
const controller = require('./controllers');

router.get('/', controller.getBase);

router.post('/', controller.webhook);

module.exports = router;