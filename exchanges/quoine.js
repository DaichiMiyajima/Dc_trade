var _ = require('underscore');
var async = require('async');
var moment = require("moment");
var tools = require(__dirname + '/../util/tools.js');
var quoine = require(__dirname + '/../library/quoine.js');

var exchange = function(config, logger, firebase, setting) {

    this.quoine = new quoine(config.quoine.apiKey, config.quoine.secret);
    
    this.q = async.queue(function (task, callback) {
        this.logger.debug('Added ' + task.name + ' API call to the queue.');
        this.logger.debug('There are currently ' + this.q.running() + ' running jobs and ' + this.q.length() + ' jobs in queue.');
        task.func(function() { setTimeout(callback, 100); });
    }.bind(this), 1);

    this.logger = logger;
    this.firebase = firebase;

    _.bindAll(this, 
        'retry', 
        'errorHandler', 
        'postOrder',
        'getExecution',
        'cancelOrder'
    );
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
    }, 100);
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

                this.logger.error(callerName + ': quoine API returned Unknown asset pair error, exiting!');
                return process.exit();

            } else {

                if(retryAllowed) {

                    this.logger.error('Retrying in 31 seconds!');
                    return this.retry(caller, args);
                    
                }
            }

        }else{

            this.logger.debug(callerName + ': quoine API Call Result (Substring)!');
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
    
    var orderinfo_quoine = {
        'order' : {
            order_type: 'limit',
            product_id: orderinfo.pair,
            side: type,
            quantity: orderinfo.size,
            price: orderinfo.price
        }
    };

    var wrapper = function(finished) {
        var handler = function(err, data) {
            if (!err) {
                cb(null, data.id);
            } else {
                cb(err, null);
            }
        };
        this.quoine.api('postorder', null, null, JSON.stringify(orderinfo_quoine), this.errorHandler(this.postOrder, args, retry, 'postOrder', handler, finished));
    }.bind(this);
    this.q.push({name: 'postOrder', func: wrapper});

};

exchange.prototype.getExecution = function(retry, executioninfo, cb) {

    var args = arguments;

    var wrapper = function(finished) {
        var txid = executioninfo.orderId;

        var handler = function(err, data) {
            console.log("quoine-----------");
            console.log(err);
            console.log(data);
            if (!err) {
                var complete = 'notcomplete';
                if(!data.errors){
                    var execinfo = data;
                    var status = "open";
                    console.log(execinfo.status);
                    if(execinfo.status === 'filled' || execinfo.status === 'partially_filled' || execinfo.status === 'cancelled'){
                        complete = 'complete';
                        if(execinfo.status === 'filled'){
                            status = 'closed';
                        }
                    }else{
                        status = execinfo.status;
                    }
                    var price_exec = 0;
                    var i = 0;
                    _.each(data.executions,function(execlist,key){
                        price_exec = Number(price_exec) + Number(execlist.rate);
                        i = i + 1;
                    });
                    //loop 数分で平均の金額を算出
                    price_exec = i === 0 ? 0 : price_exec / i;
                    var amount = tools.round(Number(price_exec) * Number(execinfo.filled_quantity), 6);

                    var result = {
                        size_exec: Number(execinfo.filled_quantity),
                        commission : Number(execinfo.order_fee),
                        status : status,
                        complete : complete,
                        price_exec : Number(execinfo.price),
                        amount : amount
                    };
                    //cancel order of ot
                    if(execinfo.status === 'live' || execinfo.status === 'partially_filled'){
                        var datatime = moment().format("YYYY-MM-DD HH:mm:ss");
                        if(executioninfo.ordertime && moment(datatime) > moment(executioninfo.ordertime).add(3, "minutes")){
                            this.cancelOrder(false, executioninfo, function(err,data){
                                console.log(err);
                                console.log(data);
                                if (err) {
                                    this.firebase.lineNotification('Order Cancel失敗(err)' + '\n' + JSON.stringify(err,undefined,4));
                                    cb(err, result);
                                } else {
                                    if(data.status === 'cancelled'){
                                        this.firebase.lineNotification('Order Cancel' + '\n' + JSON.stringify(data,undefined,4));
                                        result.status = 'cancelled';
                                        result.complete = 'complete';
                                        cb(err, result);
                                    }else{
                                        this.firebase.lineNotification('Order Cancel失敗' + '\n' + JSON.stringify(data,undefined,4));
                                        cb(err, result);
                                    }
                                }
                            }.bind(this));
                        }else{
                            cb(err, result);
                        }
                    }else{
                        cb(err, result);
                    }
                }
            } else {
                cb(err, null);
            }
        }.bind(this);
        this.quoine.api('getExecution', {eachid:executioninfo.orderId}, null, null, this.errorHandler(this.getBoard, args, retry, 'getExecution', handler, finished));
    }.bind(this);
    this.q.push({name: 'getExecution', func: wrapper});

};

exchange.prototype.cancelOrder = function(retry, orderinfo, cb) {

    var args = arguments;

    var wrapper = function(finished) {
        var handler = function(err, data) {
            if (!err) {
                cb(null, data);
            } else {
                cb(err, null);
            }
        };
        this.quoine.api('cancelorder', {eachid:orderinfo.orderId}, null, null, this.errorHandler(this.postOrder, args, retry, 'cancelOrder', handler, finished));
    }.bind(this);
    this.q.push({name: 'cancelOrder', func: wrapper});

};

module.exports = exchange;
