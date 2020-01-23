#!/usr/bin/env nodejs
'use strict'

// Imports
require('dotenv').config()
const bodyParser = require('body-parser');
const express = require('express');
const http = require('http');

// Read the private configuration file and apply auth tokens
const routes = require('./api/routes');
const scheduler = require('./api/scheduler');
const controller = require('./api/controllers');

// const TBA = require('./api/tba');

// var tba = new TBA;

// tba.genOPRs('2019txaus', function(oprs) {
//     console.log(oprs);
// });

scheduler.scheduleStandup(function() {
    controller.send_standup();
    controller.send_standup_report_thread();
});

scheduler.scheduleWakeup(function() {
    console.log("Sending wakeup");
    http.get("http://tba-slack-bot.herokuapp.com/wake");
})

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use('/', routes);

var server = http.createServer(app);

let port = process.env.PORT || 3000;

server.listen(port, function() {
    console.log('Express started on port ' + port);
})
.on('error', function(e) {
    console.log('Unable to listen on port %d!', port);
});