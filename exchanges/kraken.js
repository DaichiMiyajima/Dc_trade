var _ = require('underscore');
var async = require('async');
var Kraken = require(__dirname + '/../library/kraken.js');
var tools = require(__dirname + '/../util/tools.js');

var exchange = function(config, logger) {

    this.kraken = new Kraken(config.kraken.apiKey, config.kraken.secret);

    this.q = async.queue(function (task, callback) {
        this.logger.debug('Added ' + task.name + ' API call to the queue.');
        this.logger.debug('There are currently ' + this.q.running() + ' running jobs and ' + this.q.length() + ' jobs in queue.');
        task.func(function() { setTimeout(callback, 1000); });
    }.bind(this), 5);

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
    }, 1000 * 1);
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

                this.logger.error(callerName + ': Kraken API returned Unknown asset pair error, exiting!');
                return process.exit();

            } else {

                this.logger.error(callerName + ': Kraken API returned the following error:');
                this.logger.error(parsedError.substring(0,99));

                if(retryAllowed) {

                    this.logger.error('Retrying in 15 seconds!');
                    return this.retry(caller, args);
                    
                }
            }

        }else{

            this.logger.debug(callerName + ': Kraken API Call Result (Substring)!');
            this.logger.debug(JSON.stringify(result).substring(0,99));

        }

        handler(parsedError, result);

    }.bind(this);

};

exchange.prototype.postOrder = function(retry, orderinfo, cb) {

    var args = arguments;

    /*
    * orderinfoの整形を追加
    */
    var type;
    if(orderinfo.result === 'BUY'){
        type = 'buy'
    }else if(orderinfo.result === 'SELL'){
        type = 'sell'
    }else{
        type = orderinfo.result
    }
    
    var orderinfo_kraken = {
        pair: orderinfo.pair,
        type: type,
        ordertype: 'limit',
        price: orderinfo.price,
        volume: orderinfo.size,
        expiretm: "+5"
    };
    var nonce = new Date() * 1000; // spoof microsecond
    orderinfo_kraken.nonce = nonce;

    var wrapper = function(finished) {
        var handler = function(err, data) {
            if (!err) {
                //txid:注文のトランザクションIDの配列（注文が正常に追加された場合）
                cb(null, data.result.txid[0]);
            } else {
                cb(err, null);
            }
        };
        this.kraken.api('AddOrder', orderinfo_kraken, this.errorHandler(this.postOrder, args, retry, 'postOrder', handler, finished));
    }.bind(this);
    this.q.push({name: 'postOrder', func: wrapper});

};

exchange.prototype.getExecution = function(retry, executioninfo, cb) {

    var args = arguments;

    var wrapper = function(finished) {
        var txid = executioninfo.orderId;

        var handler = function(err, data) {
            console.log(err);
            if (!err) {
                var complete = 'notcomplete';
                _.each(data.result,function(execinfo,key){
                    if(execinfo.status === 'closed' || execinfo.status === 'canceled' || execinfo.status === 'failed' || execinfo.status === 'expired'){
                        complete = 'complete';
                    }
                    var amount = tools.round(Number(execinfo.price) * Number(execinfo.vol_exec), 6);
                    var result = {
                        size_exec: Number(execinfo.vol_exec),
                        commission : Number(execinfo.fee),
                        status : execinfo.status,
                        complete : complete,
                        price_exec : Number(execinfo.price),
                        amount : amount
                    };
                    cb(err, result);
                });
            } else {
                cb(err, null);
            }
        };
        this.kraken.api('QueryOrders', {"txid":executioninfo.orderId}, this.errorHandler(this.getExecution, args, retry, 'getExecution', handler, finished));
    }.bind(this);
    this.q.push({name: 'getExecution', func: wrapper});

};


module.exports = exchange;
