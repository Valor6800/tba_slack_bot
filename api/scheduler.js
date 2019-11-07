'use strict'

var schedule = require('node-schedule');
const fs = require('fs');

module.exports = {
    // '*/30 * * * * *'
    scheduleTask: function (when_to_run, callback) {
        schedule.scheduleJob(when_to_run, function() {
            this();
        }.bind(callback));
    },
    scheduleStandup: function (callback) {
        var rule = new schedule.RecurrenceRule();
        rule.dayOfWeek = [1, 3];
        rule.hour = 8;
        rule.minute = 15;
        schedule.scheduleJob(rule, function() {
            this();
        }.bind(callback));
    }
};