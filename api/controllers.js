'use strict'

const { WebClient } = require('@slack/web-api');
const request = require("request");
const fs = require('fs');
const dateFormat = require('dateformat');

const config = require('../config');
config.slack_http_options.headers.Authorization += config.slack_auth_token;

const slack = new WebClient(config.slack_auth_token);

let data_cache = {};

exports.slack_actions = function(req, res) {

    // Parse incoming payload
    let payload = JSON.parse(req.body.payload);
    let username = payload.user.username;

    // Action is someone opening up a modal
    if (payload.type === 'block_actions') {
        // Parse modal template
        let modal = JSON.parse(fs.readFileSync('api/views/modal.json'));
        modal.trigger_id = payload.trigger_id;
        config.slack_http_options.body = modal;
        config.slack_http_options.url += 'views.open';
        // Respond with the modal to open up
        request(config.slack_http_options, function (error, response, body) {
            if (error) throw new Error(error);
        });
        res.sendStatus(200);

    // Action is someone submitting up a modal
    } else if (payload.type === 'view_submission') {

        // Check to see if the modal is the standup mnodal
        if (payload.view.callback_id === 'standup') {

            // Cache response
            data_cache[username] = {};
            for (var key in payload.view.state.values) {
                let content = payload.view.state.values[key];
                data_cache[username][Object.keys(content)[0]] = content[Object.keys(content)[0]].value;
            }
            console.log(data_cache);

            res.json({"response_action": "clear"});
        }
    }
}

exports.slack_command = function(req, res) {
    let view = JSON.parse(fs.readFileSync('api/views/view.json'));
    res.json(view);
}

exports.send_standup = function(channel) {
    let payload = JSON.parse(fs.readFileSync('api/views/view.json'));
    payload.channel = channel;

    let currTime = dateFormat(new Date(), "dddd, mmmm dS");
    payload.blocks[0].text.text = payload.blocks[0].text.text.replace("{{date}}", currTime);

    slack.chat.postMessage(payload).then(function(res) {
        console.log('Daily standup sent with ID: ', res.ts);
    });
}

exports.send_standup_report = function() {
    let payload = JSON.parse(fs.readFileSync('api/views/report.json'));
    
    payload.channel = "CQCAC4UVC";
    slack.chat.postMessage(payload).then(function(res) {
        console.log('Standup report sent with ID: ', res.ts);
    });
}