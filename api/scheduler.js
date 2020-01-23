'use strict'

var schedule = require('node-schedule');
const fs = require('fs');

const GMT_offset = 6;

module.exports = {
    scheduleTask: function (when_to_run, callback) {
        schedule.scheduleJob(when_to_run, function() {
            this();
        }.bind(callback));
    },
    scheduleStandup: function (callback) {
        var rule = new schedule.RecurrenceRule();
        rule.dayOfWeek = [1, 3, 5];
        rule.hour = parseInt(process.env.standup_schedule_hour) + parseInt(process.env.standup_schedule_gmt_offset);
        rule.minute = parseInt(process.env.standup_schedule_min);
        schedule.scheduleJob(rule, function() {
            this();
        }.bind(callback));
    },
    scheduleWakeup: function(callback) {
        var j = schedule.scheduleJob('*/5 * * * *', callback);
    }
};