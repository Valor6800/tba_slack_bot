'use strict'

const express = require('express');
const router = express.Router();
const controller = require('./controllers');

router.post('/slack/actions', controller.slack_actions);

router.post('/slack/command/standup', controller.slack_command);

module.exports = router;