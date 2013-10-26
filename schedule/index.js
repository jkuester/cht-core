var fs = require('fs'),
    _ = require('underscore'),
    async = require('async'),
    date = require('../date'),
    moment = require('moment'),
    config = require('../config'),
    tasks;

tasks = _.compact(_.map(fs.readdirSync(__dirname), function(file) {
    try {
        if (!/^index\./.test(file)) {
            return require('./' + file);
        }
    } catch(e) {
        console.error(e); // carry on ...
    }
}));

/*
 * Return true if within time window to set outgoing/pending tasks/messages.
 */
function sendable(m) {
    var after = config.get('schedule_morning_hours') || 0,
        until = config.get('schedule_evening_hours') || 23,
        hour = m.hours();

    return hour >= after && hour <= until;
}

function checkSchedule() {
    var db = require('../db'),
        now = moment(date.getDate());

    console.log('doing checkSchedule()');
    async.forEachSeries(tasks, function(task, callback) {
        if (_.isFunction(task.execute)) {
            console.log('calling task.execute()');
            task.execute({
                db: db
            }, callback);
        } else if (sendable(now)) {
            console.log('sendable, calling task()');
            task(db, callback);
        } else {
            console.log('not sendable, calling callback()');
            callback();
        }
    }, function(err) {
        if (err) {
            console.error('Error running tasks: ' + JSON.stringify(err));
        }
        reschedule();
    });
}

function reschedule() {
    var now = moment(),
        heartbeat = now.clone().startOf('minute').add('minutes', 5),
        duration = moment.duration(heartbeat.valueOf() - now.valueOf());

    console.log('checking schedule again in', moment.duration(duration).humanize());
    setTimeout(checkSchedule, duration.asMilliseconds());
}

checkSchedule();
