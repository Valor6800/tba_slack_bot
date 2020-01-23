'use strict'

// Utility imports
const request = require("request");
const fs = require('fs');
const dateFormat = require('dateformat');

// Markdown imports
const table = require('markdown-table');
const mdToPdf = require('md-to-pdf');

// Configure slack auth tokens
let slack_http_options = {
    method: 'POST',
    url: process.env.slack_api_base,
    headers: {
        'Authorization': 'Bearer ',
        'Content-Type': 'application/json'
    },
    json: true
};
slack_http_options.headers.Authorization += process.env.slack_bot_oauth_token;

// Slack imports
const { WebClient } = require('@slack/web-api');
const slack = new WebClient(process.env.slack_bot_oauth_token);

// Persistent data cache to keep track of user submissions
let data_cache = [['Name','Yesterday','Today','Blockers']];

let response_thread_ts = '';

// TBA class import and setup
const TBA = require('../api/tba');
var tba = new TBA;

exports.slack_actions = function(req, res) {

    // Parse incoming payload
    let payload = JSON.parse(req.body.payload);
    let username = payload.user.username;

    // Action is someone opening up a modal
    if (payload.type === 'block_actions') {
        // Parse modal template
        let modal = JSON.parse(fs.readFileSync('api/views/modal.json'));
        modal.trigger_id = payload.trigger_id;
        slack_http_options.body = modal;
        slack_http_options.url = process.env.slack_api_base + 'views.open';
        // Respond with the modal to open up
        request(slack_http_options, function (error, response, body) {
            if (error) throw new Error(error);
        });
        res.sendStatus(200);

    // Action is someone submitting up a modal
    } else if (payload.type === 'view_submission') {

        // Check to see if the modal is the standup mnodal
        if (payload.view.callback_id === 'standup') {

            console.log("Sunmission from: " + username);

            // Cache response
            let row = [username];
            let tmp = {};
            for (var key in payload.view.state.values) {
                let content = payload.view.state.values[key];
                tmp[Object.keys(content)[0]] = content[Object.keys(content)[0]].value.replaceAll("\n","  ");
            }
            row.push(tmp.previous_day_summary, tmp.next_day_summary, tmp.blockers);
            data_cache.push(row);

            let channel = process.env.slack_mentor_channel;
            slack_http_options.url = process.env.slack_api_base + 'chat.postMessage';
            slack_http_options.body = {
                "channel": channel,
                "thread_ts": response_thread_ts,
                "text": "*Name*: " + username + "\n*Previous day*: " + tmp.previous_day_summary + "\n*Today*: " + tmp.next_day_summary + "\n*Blockers*: " + tmp.blockers
            };
            request(slack_http_options, function (error, response, body) {
                if (error) throw new Error(error);
            });

            res.json({"response_action": "clear"});
        }
    }
}

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

exports.slack_command = function(req, res) {
    res.sendStatus(200);
    exports.send_standup();
}

exports.send_standup = function() {
    // Reset the data cache
    data_cache = [['Name','Yesterday','Today','Blockers']];

    let payload = JSON.parse(fs.readFileSync('api/views/view.json'));
    payload.channel = process.env.slack_general_channel;

    let currTime = dateFormat(new Date(), "dddd, mmmm dS");
    payload.blocks[0].text.text = payload.blocks[0].text.text.replace("{{date}}", currTime);

    slack.chat.postMessage(payload).then(function(res) {
        console.log('Daily standup sent with ID: ', res.ts);
    });
}

exports.wake = function(req, res) {
    res.sendStatus(200);
    console.log("Wake up!");
};

exports.send_standup_report_thread = function() {

    let payload = {
        "text": "Daily standup time!",
        "blocks": [{
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Daily Standup Report for {{date}}*\nResponses will be posted below as students fill them out!"
            }
        }]
    };
    payload.channel = process.env.slack_mentor_channel;

    let currTime = dateFormat(new Date(), "dddd, mmmm dS");
    payload.blocks[0].text.text = payload.blocks[0].text.text.replace("{{date}}", currTime);

    slack.chat.postMessage(payload).then(function(res) {
        response_thread_ts = res.ts;
    });
}

function sendMatchSummary(match_data) {
    let event_code = match_data.event_key;
    let match_code = match_data.key;

    let team = 6800;

    tba.genOPRs(event_code, function(oprs) {

        tba.getMatch(match_code, function(match) {

            // Parse modal template
            let payload = JSON.parse(fs.readFileSync('api/views/match_summary.json'));
            payload.channel = process.env.slack_general_channel;

            // Gather generic year-to-year data
            let in_blue = tba.countInArray(match.alliances.blue.team_keys, 'frc' + team);
            let color = in_blue > 0 ? 'blue' : 'red';
            let match_num = match.comp_level.toUpperCase() + match.match_number;
            let status = match.winning_alliance.includes(color) ? 'won' : 'lost';
            let blue_score = match.alliances.blue.score;
            let red_score = match.alliances.red.score;

            // Populate template with the generic data
            payload.blocks[0].text.text = payload.blocks[0].text.text.replace('{{match}}', match_num);
            payload.blocks[0].text.text = payload.blocks[0].text.text.replace('{{team}}', team);
            payload.blocks[0].text.text = payload.blocks[0].text.text.replace('{{status}}', status);
            payload.blocks[0].text.text = payload.blocks[0].text.text.replace('{{blue_score}}', blue_score);
            payload.blocks[0].text.text = payload.blocks[0].text.text.replace('{{red_score}}', red_score);

            // Gather year specific match data
            let team_count = oprs.length;
            let parsed_match = tba.parseMatch(match);
            let rocket_hatch = parsed_match[team].HatchRocketLow + parsed_match[team].HatchRocketMid + parsed_match[team].HatchRocketTop;
            let ship_hatch = parsed_match[team].HatchShipFront + parsed_match[team].HatchShipSide;
            let rocket_cargo = parsed_match[team].CargoRocketLow + parsed_match[team].CargoRocketMid + parsed_match[team].CargoRocketTop;
            let ship_cargo = parsed_match[team].CargoShipFront + parsed_match[team].CargoShipFront;
            let hab_start = parsed_match[team].HabAuto;
            let hab_end = parsed_match[team].HabEnd;
            let fouls = parsed_match[team].Penalty;

            // Gather year specific OPR data
            let rocket_hatch_opr = oprs[team].HatchRocketLow + oprs[team].HatchRocketMid + oprs[team].HatchRocketTop;
            let ship_hatch_opr = oprs[team].HatchShipFront + oprs[team].HatchShipSide;
            let rocket_cargo_opr = oprs[team].CargoRocketLow + oprs[team].CargoRocketMid + oprs[team].CargoRocketTop;
            let ship_cargo_opr = oprs[team].CargoShipFront + oprs[team].CargoShipFront;
            let hab_start_opr = oprs[team].HabAuto;
            let hab_end_opr = oprs[team].HabEnd;
            let fouls_opr = oprs[team].Penalty;

            // Formulate the strings to print out
            let rocket_hatch_str = rocket_hatch + ' (' + rocket_hatch_opr.toFixed(1) + ')';
            let ship_hatch_str = ship_hatch + ' (' + ship_hatch_opr.toFixed(1) + ')';
            let rocket_cargo_str = rocket_cargo + ' (' + rocket_cargo_opr.toFixed(1) + ')';
            let ship_cargo_str = ship_cargo + ' (' + ship_cargo_opr.toFixed(1) + ')';
            let hab_start_str = hab_start + ' (' + hab_start_opr.toFixed(1) + ')';
            let hab_end_str = hab_end + ' (' + hab_end_opr.toFixed(1) + ')';
            let fouls_str = fouls + ' (' + fouls_opr.toFixed(1) + ')';

            // Populate template with the year specific data
            payload.blocks[1].fields[0].text = payload.blocks[1].fields[0].text.replace('{{rocket_hatch}}', rocket_hatch_str);
            payload.blocks[1].fields[1].text = payload.blocks[1].fields[1].text.replace('{{ship_hatch}}', ship_hatch_str);
            payload.blocks[1].fields[2].text = payload.blocks[1].fields[2].text.replace('{{rocket_cargo}}', rocket_cargo_str);
            payload.blocks[1].fields[3].text = payload.blocks[1].fields[3].text.replace('{{ship_cargo}}', ship_cargo_str);
            payload.blocks[1].fields[4].text = payload.blocks[1].fields[4].text.replace('{{hab_start}}', hab_start_str);
            payload.blocks[1].fields[5].text = payload.blocks[1].fields[5].text.replace('{{hab_end}}', hab_end_str);
            payload.blocks[1].fields[6].text = payload.blocks[1].fields[6].text.replace('{{fouls}}', fouls_str);

            slack.chat.postMessage(payload).then(function(res) {
                console.log('Match summary sent with ID: ', res.ts);
            });
        });
    });
}

exports.tba_webhook = function(req, res) {
    res.sendStatus(200);
    if (req.body.message_type === 'match_score') {
        let match_data = req.body.message_data.match;
        sendMatchSummary(match_data);
    }
}