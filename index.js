#!/usr/bin/env nodejs
'use strict'

// Imports
const bodyParser = require('body-parser');
const express = require('express');
const http = require('http');

// Read the private configuration file and apply auth tokens
const config = require('./config');
const routes = require('./api/routes');
const scheduler = require('./api/scheduler');
const controller = require('./api/controllers');

scheduler.scheduleStandup(function() {
    controller.send_standup();
});
scheduler.scheduleReport(function() {
    controller.send_standup_report();
});

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use('/', routes);

var server = http.createServer(app);

server.listen(config.server_port, function() {
    console.log('Express started on port ' + config.server_port);
})
.on('error', function(e) {
    console.log('Unable to listen on port %d!', config.server_port);
});