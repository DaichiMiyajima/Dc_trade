var _ = require('underscore');
var async = require('async');
var bitflyer = require(__dirname + '/../library/bitflyer.js');
var tools = require(__dirname + '/../util/tools.js');

var exchange = function(config, logger, firebase, setting) {

    this.bitflyer = new bitflyer(config.bitflyer.apiKey, config.bitflyer.secret);
    this.currencyPair = {
        product_code: 'ETH_BTC',
        currency: 'BTC',
        asset: 'ETH'
    };
    this.q = async.queue(function (task, callback) {
        this.logger.debug('Added ' + task.name + ' API call to the queue.');
        this.logger.debug('There are currently ' + this.q.running() + ' running jobs and ' + this.q.length() + ' jobs in queue.');
        task.func(function() { setTimeout(callback, 200); });
    }.bind(this), 10);

    this.logger = logger;
    this.firebase = firebase;

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

exchange.prototype.errorHandler = function(caller, receivedArgs, retlyAllowed, callerName, handler, finished){
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

                this.logger.error(callerName + ': bitflyer API returned Unknown asset pair error, exiting!');
                return process.exit();

            } else {

                this.logger.error(callerName + ': bitflyer API returned the following error:');
                this.logger.error(parsedError.substring(0,99));

                if(retlyAllowed) {

                    this.logger.error('Retrying in 15 seconds!');
                    return this.retry(caller, args);
                    
                }
            }

        }else{

            this.logger.debug(callerName + ': bitflyer API Call Result (Substring)!');
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
    var orderinfo_bitflyer = JSON.stringify({
        "product_code": orderinfo.pair,
        "child_order_type": 'LIMIT',
        "side": orderinfo.result,
        "price": orderinfo.price,
        "size": orderinfo.size,
        "minute_to_expire": 1,
        "time_in_force": 'IOC'
    });

    var wrapper = function(finished) {

        var handler = function(err, data) {
            if (!err) {
                //child_order_acceptance_id: API の受付 ID 
                cb(null, data.child_order_acceptance_id);
            } else {
                cb(err, null);
            }
        };

        this.bitflyer.api('sendchildorder', null, orderinfo_bitflyer, this.errorHandler(this.postOrder, args, retry, 'postOrder', handler, finished));
    }.bind(this);
    this.q.push({name: 'postOrder', func: wrapper});

};


exchange.prototype.getExecution = function(retry, executioninfo, cb) {

    var args = arguments;
    var wrapper = function(finished) {
        var pair = executioninfo.pair;
        var child_order_acceptance_id = executioninfo.orderId;

                var handler = function(err, data) {
            if (!err) {
                var datatime = moment().format("YYYY-MM-DD HH:mm:ss");
                var complete;
                var size_exec = 0;
                var commission = 0;
                var price_exec = 0;
                var amount = 0;
                var i = 0;
                var status;
                var result;
                if(data.length != 0){
                    complete = 'complete';
                    _.each(data,function(execlist,key){
                        size_exec = (Number(size_exec) + Number(execlist.size));
                        commission = Number(commission) + Number(execlist.commission);
                        price_exec = Number(price_exec) + Number(execlist.price);
                        amount = amount + tools.floor((Number(execlist.price) * Number(execlist.size)), 8);
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
                }else{
                    if(executioninfo.ordertime && moment(datatime) < moment(executioninfo.ordertime).add(10, "minutes")){
                        complete = 'open';
                        status = 'open';
                    }else{
                        complete = 'complete';
                        status = 'canceled';
                    }
                }
                result = {
                    size_exec: size_exec,
                    commission : commission,
                    status : status,
                    complete : complete,
                    price_exec : price_exec,
                    amount : amount
                };
                cb(null, result)
            } else {
                cb(err, null);
            }
        };

        this.bitflyer.api('getexecutions', {"product_code": pair, "count": 10000, "child_order_acceptance_id": child_order_acceptance_id}, null, this.errorHandler(this.getExecution, args, retry, 'getExecution', handler, finished));
    }.bind(this);
    this.q.push({name: 'getExecution', func: wrapper});

};

module.exports = exchange;
