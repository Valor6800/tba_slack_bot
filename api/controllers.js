'use strict'

// Utility imports
const request = require("request");
const fs = require('fs');
const dateFormat = require('dateformat');

// Markdown imports
const table = require('markdown-table');
const mdToPdf = require('md-to-pdf');

// Configure slack auth tokens
const config = require('../config');
let slack_http_options = {
    method: 'POST',
    url: 'https://slack.com/api/',
    headers: {
        'Authorization': 'Bearer ',
        'Content-Type': 'application/json'
    },
    json: true
};
slack_http_options.headers.Authorization += config.slack_auth_token;

// Slack imports
const { WebClient } = require('@slack/web-api');
const slack = new WebClient(config.slack_auth_token);

// Persistent data cache to keep track of user submissions
let data_cache = [['Name','Yesterday','Today','Blockers']];

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
        slack_http_options.url += 'views.open';
        // Respond with the modal to open up
        request(slack_http_options, function (error, response, body) {
            if (error) throw new Error(error);
        });
        res.sendStatus(200);

    // Action is someone submitting up a modal
    } else if (payload.type === 'view_submission') {

        // Check to see if the modal is the standup mnodal
        if (payload.view.callback_id === 'standup') {

            // Cache response
            let row = [username];
            let tmp = {};
            for (var key in payload.view.state.values) {
                let content = payload.view.state.values[key];
                tmp[Object.keys(content)[0]] = content[Object.keys(content)[0]].value.replaceAll("\n","  ");
            }
            row.push(tmp.previous_day_summary, tmp.next_day_summary, tmp.blockers);
            data_cache.push(row);

            res.json({"response_action": "clear"});
        }
    }
}

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

function sendReport(filename) {
    let channel = config.is_testing ? config.slack_test_channel : config.slack_mentor_channel;
    request.post({
        url: 'https://slack.com/api/files.upload',
        formData: {
            token: config.slack_bot_auth_token,
            title: "Standup report for " + dateFormat(new Date(), "dddd, mmmm dS"),
            filename: filename,
            filetype: "auto",
            channels: channel,
            file: fs.createReadStream(config.report_directory + '/' + filename),
        },
    }, function (err, response) {
        if (err) console.error(err);
        console.log('Standup report with ID: ', res.ts);
    });
}

function generateReport(callback) {

    // Create the reports directory if doesn't exist
    if (!fs.existsSync(config.report_directory)){
        fs.mkdirSync(config.report_directory);
    }

    // Create the markdown report
    let results = table(data_cache);
    let header = '## Report for ' + dateFormat(new Date(), "dddd, mmmm dS, yyyy") + '\n\n';

    // Create the filenames for the outputs
    let markdown_filename = 'report_' + dateFormat(new Date(), 'mm dd yy').replaceAll(' ', '_') + '.md';
    let pdf_filename = 'report_' + dateFormat(new Date(), 'mm dd yy').replaceAll(' ', '_') + '.pdf';

    // PDF options
    let options = {
        dest: config.report_directory + '/' + pdf_filename,
        pdf_options: {
            format: "A5",
            margin: "10mm"
        },
        stylesheet: "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/2.10.0/github-markdown.min.css",
        body_class: "markdown-body",
        css: ".page-break { page-break-after: always; } .markdown-body { font-size: 8px; } .markdown-body pre > code { white-space: pre-wrap; } "
    };

    // Write the markdown report to file
    fs.writeFile(config.report_directory + '/' + markdown_filename, header + results, (err) => {
        if (err) throw err;
        mdToPdf(config.report_directory + '/' + markdown_filename, options)
        .catch(console.error)
        .then(function(pdf) {
            callback(pdf_filename);
        });
    });
}

exports.slack_command = function(req, res) {
    res.sendStatus(200);
    exports.send_standup();
}

exports.send_standup = function() {
    // Reset the data cache
    data_cache = [['Name','Yesterday','Today','Blockers']];

    let payload = JSON.parse(fs.readFileSync('api/views/view.json'));
    payload.channel = config.is_testing ? config.slack_test_channel : config.slack_general_channel;

    let currTime = dateFormat(new Date(), "dddd, mmmm dS");
    payload.blocks[0].text.text = payload.blocks[0].text.text.replace("{{date}}", currTime);

    slack.chat.postMessage(payload).then(function(res) {
        console.log('Daily standup sent with ID: ', res.ts);
    });
}

exports.send_standup_report = function() {
    generateReport(sendReport);
}