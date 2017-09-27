var _ = require('underscore');
var async = require('async');
var poloniex = require(__dirname + '/../library/poloniex.js');
var tools = require(__dirname + '/../util/tools.js');

var exchange = function(config, logger) {

    this.poloniex = new poloniex(config.poloniex.apiKey, config.poloniex.secret);

    this.q = async.queue(function (task, callback) {
        this.logger.debug('Added ' + task.name + ' API call to the queue.');
        this.logger.debug('There are currently ' + this.q.running() + ' running jobs and ' + this.q.length() + ' jobs in queue.');
        task.func(function() { setTimeout(callback, 200); });
    }.bind(this), 10);

    this.logger = logger;

    _.bindAll(this, 'retry', 'errorHandler', 'postOrder', 'getExecution');

};

// using variadic functions to bind
exchange.prototype.retry = function(method, args) {

    var self = this;

    _.each(args, function(arg, i) {
        if(_.isFunction(arg)){
            args[i] = _.bind(arg, self);
        }
    });

    setTimeout(function() {
        method.apply(self, args);
    }, 200);
};

exchange.prototype.errorHandler = function(caller, receivedArgs, retryAllowed, callerName, handler, finished){

    return function(err, result){
        var args = _.toArray(receivedArgs);
        var parsedError = null;

        finished();

        if(err) {

            if(JSON.stringify(err) === '{}' && err.message) {
                parsedError = err.message;
            } else {
                parsedError = JSON.stringify(err);
            }

            if(parsedError === '["EQuery:Unknown asset pair"]') {

                this.logger.error(callerName + ': poloniex API returned Unknown asset pair error, exiting!');
                return process.exit();

            } else {

                this.logger.error(callerName + ': poloniex API returned the following error:');
                this.logger.error(parsedError.substring(0,99));

                if(retryAllowed) {

                    this.logger.error('Retrying in 15 seconds!');
                    return this.retry(caller, args);
                    
                }
            }

        }else{

            this.logger.debug(callerName + ': poloniex API Call Result (Substring)!');
            this.logger.debug(JSON.stringify(result).substring(0,99));

        }

        handler(parsedError, result);

    }.bind(this);

};

exchange.prototype.postOrder = function(retry, orderinfo, cb) {

    var args = arguments;
    var wrapper = function(finished) {

        var handler = function(err, data) {
            if (!err) {
                if(!data.error){
                    cb(null, data.orderNumber);
                }else{
                    cb(data.error, null);
                }
            } else {
                cb(err, null);
            }
        };
        
        var parameters = {
            currencyPair: orderinfo.pair,
            rate: orderinfo.price,
            amount: orderinfo.size,
            immediateOrCancel : 1
        };
        if(orderinfo.result === 'BUY'){
            this.poloniex.buy(parameters, this.errorHandler(this.postOrder, args, retry, 'postOrder', handler, finished));
        }else{
            this.poloniex.sell(parameters, this.errorHandler(this.postOrder, args, retry, 'postOrder', handler, finished));
        }
    }.bind(this);
    this.q.push({name: 'postOrder', func: wrapper});

};

exchange.prototype.getExecution = function(retry, executioninfo, cb) {

    var args = arguments;

    var wrapper = function(finished) {

        var handler = function(err, data) {
            if (!err) {
                if(!data.error){
                    var size_exec = 0;
                    var commission = 0;
                    var price_exec = 0;
                    var amount = 0;
                    var i = 0;
                    var status;
                    var complete = 'complete'; //poloniexの場合、IOCなので即時約定する前提
                    _.each(data,function(execlist,key){
                        size_exec = (Number(size_exec) * 100000000 + Number(execlist.amount) * 100000000) / 100000000;
                        commission = Number(commission) + Number(execlist.fee);
                        price_exec = Number(price_exec) + Number(execlist.rate);
                        amount = amount + tools.floor(execlist.total, 8);
                        i = i + 1;
                    });
                    size_exec = tools.round(size_exec,7);
                    
                    //loop 数分で平均の金額を算出
                    price_exec = i === 0 ? 0 : price_exec / i;
                    
                    if(Number(size_exec) !== 0 && Number(executioninfo.size) <= Number(size_exec)){
                        status = 'closed';
                    }else if(Number(size_exec) !== 0 && Number(executioninfo.size) !== Number(size_exec)){
                        status = 'partclosed';
                    }else{
                        status = 'canceled';
                    }
                    //結果をobjectに変更
                    var result = {
                        size_exec: size_exec,
                        commission : commission,
                        status : status,
                        complete : complete,
                        price_exec : price_exec,
                        amount : amount
                    };
                }else{
                    var result = {
                        size_exec: 0,
                        commission : 0,
                        status : 'canceled',
                        complete : 'complete',
                        price_exec : 0,
                        amount : 0
                    };
                }
                cb(null, result)
            } else {
                cb(err, null);
            }
        };
        this.poloniex.returnOrderTrades(executioninfo.orderId, this.errorHandler(this.getExecution, args, retry, 'getExecution', handler, finished));
    }.bind(this);
    this.q.push({name: 'getExecution', func: wrapper});

};


module.exports = exchange;
