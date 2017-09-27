var _ = require('underscore');
var async = require('async');
var moment = require("moment");
var tools = require(__dirname + '/../util/tools.js');

var monitortrade = function(config, firebase, logger, setting){

    this.config = config;
    this.logger = logger;
    this.firebase = firebase;
    this.setting = setting;

    this.orderfailorder = [];
    this.notyetorder = [];

    _.bindAll(this,
        'monitorfinish'
    );
};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(monitortrade, EventEmitter);
//---EventEmitter Setup

monitortrade.prototype.monitorfinish = function(object){

    async.series([
        function(callback){
            this.firebase.referArray(this.setting.finishedpass, function(array){
                if(array){
                    callback('notfinish',null);
                }else{
                    callback(null,array)
                }
            }.bind(this))
        }.bind(this),
        function(callback){
            this.firebase.referArray(this.setting.orderFailedPass, function(array){
                if(array){
                    callback('notfinish',null);
                }else{
                    callback(null,array);
                }
            }.bind(this))
        }.bind(this),
        function(callback){
            this.firebase.referArray(this.setting.notyetpass, function(array){
                if(array){
                    var datatime = moment().format("YYYY-MM-DD HH:mm:ss");
                    var notyetorder = [];
                    _.each(array,function(eachpairorder,key){
                        var pair = key;
                        _.each(eachpairorder,function(eachexchange,key){
                            var exchange = key;
                            _.each(eachexchange,function(eachpairorder,key){
                                var object = {
                                    pair : pair,
                                    exchange : exchange
                                };
                                var notyetorderObject =_.extend(object, eachpairorder);
                                notyetorder.push(notyetorderObject);
                            });
                        });
                    });
                    _.each(notyetorder,function(eachorder,key){
                        if(eachorder.time && moment(datatime) < moment(eachorder.time).add(3, "minutes")){
                            callback('notfinish',null);
                        }
                    });
                    callback(null,array);
                }else{
                    callback(null,array);
                }
            }.bind(this))
        }.bind(this),
    ], function (err, results) {
        if (err) {
            this.logger.error('trade has not been finished yet');
        }else{
            this.logger.error('trade has not been finished');
            this.firebase.lineNotification('trade has been finished');
            var system;
            if(object.refresh){
                system = "refresh"
            }else{
                system = "think"
            }
            this.firebase.updateObject({time:moment().format("YYYY-MM-DD HH:mm:ss"),system:system}, this.setting.systempass, this.setting.tradestatus);
            this.firebase.updateObject({time:moment().format("YYYY-MM-DD HH:mm:ss"),status:"complete"}, this.setting.systempass, this.setting.orderstatus);
        }
    }.bind(this));

};


module.exports = monitortrade;