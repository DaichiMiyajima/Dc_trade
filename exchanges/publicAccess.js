var _ = require('underscore');
var async = require('async');
var request	= require('request');

var publicAccess = function(config, logger, setting) {

    this.q = async.queue(function (task, callback) {
        this.logger.debug('Added ' + task.name + ' API call to the queue.');
        this.logger.debug('There are currently ' + this.q.running() + ' running jobs and ' + this.q.length() + ' jobs in queue.');
        task.func(function() { setTimeout(callback, 3100); });
    }.bind(this), 1);

    this.logger = logger;
    this.config = config;

    _.bindAll(this, 
        'retry', 
        'errorHandler', 
        'getFiatRate'
    );
};

// using variadic functions to bind
publicAccess.prototype.retry = function(method, args) {

    var self = this;

    _.each(args, function(arg, i) {
        if(_.isFunction(arg)){
            args[i] = _.bind(arg, self);
        }
    });

    setTimeout(function() {
        method.apply(self, args);
    }, 1000*31);
};

publicAccess.prototype.errorHandler = function(caller, receivedArgs, retryAllowed, callerName, handler, finished){

    return function(err, result){
        var args = _.toArray(receivedArgs);
        var parsedError = null;

        finished();

        if(err) {

            this.logger.lineNotification(callerName + ': Public API でエラーです。リトライを継続します\n' + err);

            if(retryAllowed) {

                this.logger.error('Retrying in 31 seconds!');
                return this.retry(caller, args);
                    
            }

        }else{

            this.logger.debug(callerName + ': public API Call Result (Substring)!');
            this.logger.debug(JSON.stringify(result).substring(0,99));

        }

        handler(err, result);

    }.bind(this);

};

publicAccess.prototype.getFiatRate = function(retry, cb) {

    var args = arguments;

    var wrapper = function(finished) {

        var handler = function(err, data) {
            if (!err) {
                cb(JSON.parse(data.body));
            } else {
                cb(err, null);
            }
        };

        request.get({url : this.config.gaitameonlineRate}, this.errorHandler(this.getFiatRate, args, retry, 'getFiatRate', handler, finished));
    }.bind(this);

    this.q.push({name: 'getFiatRate', func: wrapper});

};

module.exports = publicAccess;
