var moment = require('moment');
var _ = require('underscore');
var winston = require('winston');
require('winston-daily-rotate-file');
var fs = require('fs');
var util = require('util');

var logger = function(app, setting) {

    this.debugEnabled = true;

    if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs');
    }

    var myCustomLevels = {
        levels: {
            DEBUG: 0,
            INFO: 1,
            ERROR: 2
        }
    };

    var now = function() {
        var format = moment(new Date()).format('DD-MM-YYYY HH:mm:ss');
        return '[' + format + ']';
    };

    this.logger = new (winston.Logger)({
        levels: myCustomLevels.levels,
        transports: [
        new (winston.transports.Console)({
            'timestamp': now,
            level: 'INFO' }),
        new (winston.transports.DailyRotateFile)({
            'timestamp': now,
            datePattern: '_dd-MM-yyyy.log',
            filename: 'logs/' + app,
            level: 'DEBUG'})
        ]
    });

    _.bindAll(this, 'log', 'debug', 'error');

};



logger.prototype.log = function(message) {

    this.logger.log('INFO', util.inspect(message));

};

logger.prototype.debug = function(message) {

    if(this.debugEnabled) {

        this.logger.log('DEBUG', util.inspect(message));

    }

};

logger.prototype.error = function(message) {

    this.logger.log('ERROR', util.inspect(message));

};

module.exports = logger;
