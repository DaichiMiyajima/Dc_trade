var _ = require('underscore');
var async = require('async');
var kraken = require(__dirname + '/../exchanges/kraken.js');
var bitflyer = require(__dirname + '/../exchanges/bitflyer.js');
var poloniex = require(__dirname + '/../exchanges/poloniex.js');
var publicAccess = require(__dirname + '/../exchanges/publicAccess.js');

var api = function(config, logger, setting){

    var kraken_access = new kraken(config, logger);
    var bitflyer_access = new bitflyer(config, logger);
    var poloniex_access = new poloniex(config, logger);
    this.public_access = new publicAccess(config, logger, setting);

    this.exchangesAccess = [
        {api:kraken_access, name:"kraken"},
        {api:bitflyer_access, name:"bitflyer"},
        {api:poloniex_access, name:"poloniex"},
    ];

    _.bindAll(this, 'getQueue', 'postOrder', 'getExecution', 'getFiatRate');

};

api.prototype.getQueue = function(cb){
    var qlength = 0;
    _.each(this.exchangesAccess, function(exchangeAccess,key){
        qlength = qlength + exchangeAccess.api.q.length();
    }.bind(this));
    cb(qlength);
};

api.prototype.postOrder = function(retry, orderinfo, cb){
    async.filter(
        this.exchangesAccess,
        function(item, callback) {
            callback(item.name == orderinfo.exchange);
        },
        function(exchangeAccess){
            exchangeAccess[0].api.postOrder(retry, orderinfo, cb);
    });
};

api.prototype.getExecution = function(retry, executioninfo, cb){
    async.filter(
        this.exchangesAccess,
        function(item, callback) {
            callback(item.name == executioninfo.exchange);
        },
        function(exchangeAccess){
            exchangeAccess[0].api.getExecution(retry, executioninfo, cb);
    });
};

api.prototype.getFiatRate = function(retry, cb){
    this.public_access.getFiatRate(retry, cb);
}

module.exports = api;
