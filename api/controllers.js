'use strict'

var request = require("request");
const config = require('../config');

var pre_url = 'https://maker.ifttt.com/trigger/';
var post_url = '/with/key/' + config.maker_key;

function send_webhook(trigger, val1, val2, val3) {
    var options = {
        method: 'POST',
        url: pre_url + trigger + post_url,
        headers: {
            'Content-Type': 'application/json' },
        body: {
            value1: val1,
            value2: val2,
            value3: val3
        },
        json: true
    };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);
    });
}

exports.getBase = function(req, res) {
    res.status(200);
    res.type('html');
    res.send(`<html><body>
    <h2>TBA Slack Bot</h2>
    </body></html>`);
};

var sendJSONresponse = function(res, status, content) {
    res.status(status);
    res.json(content);
}

exports.webhook = function(req, res) {

    let message_type = req.body.message_type;
    let message_data = req.body.message_data;

    // Verification
    if (message_type === 'verification') {
        console.log('Verification key: ' + message_data.verification_key);
        sendJSONresponse(res, 200, 'Verification key receieved');
    }

    // Upcoming match
    if (message_type === 'upcoming_match') {

        let link = 'www.thebluealliance.com/match/' + message_data.match_key;
        let time = (new Date(message_data.predicted_time)).toLocaleTimeString();
        let teams = message_data.team_keys;
        let blue_teams  = teams[0].replace('frc','') + ', ' + teams[1].replace('frc','') + ', ' + teams[2].replace('frc','');
        let red_teams = teams[3].replace('frc','') + ', ' + teams[4].replace('frc','') + ', ' + teams[5].replace('frc','');
        let match = message_data.match_key.split('_')[1].toUpperCase();

        let payload = 'Red teams: ' + red_teams +'<br>';
        payload += 'Blue teams: ' + blue_teams;

        send_webhook(message_type, match, link, payload);
    }

    // Match result
    if (message_type === 'match_score') {

        let link = 'www.thebluealliance.com/match/' + message_data.match.key;
        
    }


}

