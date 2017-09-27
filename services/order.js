var _ = require('underscore');
var moment = require("moment");
var tools = require(__dirname + '/../util/tools.js');

var order = function(config,exchangeapi,firebase,logger,setting){

    this.config = config;
    this.exchangeapi = exchangeapi;
    this.logger = logger;
    this.firebase = firebase;
    this.setting = setting;

    _.bindAll(this,
        'orderApi', 'oneorderApi','orderComplete'
    );
};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(order, EventEmitter);
//---EventEmitter Setup


order.prototype.orderApi = function(orderinfo){
    //For production
    if(this.setting.runningmode === 'production'){
        var datatime = moment().format("YYYY-MM-DD HH:mm:ss");
        //3分以内のデータのみ抽出
        if(orderinfo.time && moment(datatime) < moment(orderinfo.time).add(3, "minutes")){
            this.emit('orderbackup', orderinfo);
            orderinfo.size = tools.round(orderinfo.size, 7);
            //this.exchangeapi.postOrder(false, orderinfo, this.orderComplete(orderinfo));
        }
    }else{
        this.emit('orderbackup', orderinfo);
        var callOrderComplete = this.orderComplete(orderinfo);
        var random = Math.floor( Math.random() * 11 );
        if(random < 10){
            var result = 'OrderId' + Math.floor( Math.random() * 10000001 );
            callOrderComplete(null, result);
        }else{
            callOrderComplete('error', null);
        }
    }
};

order.prototype.oneorderApi = function(orderinfo){
    if(this.setting.runningmode === 'production'){
        orderinfo.size = tools.round(orderinfo.size, 7);
        this.exchangeapi.postOrder(false, orderinfo, this.orderComplete(orderinfo));
    }
};

order.prototype.orderComplete = function(orderinfo){
    return function(err, result){
        if(err){
            this.logger.error('Order失敗' + '\n' + 'Error(order.js) \n' + 'Error' + JSON.stringify(err,undefined,4) + '\n\n' + 'Arg:' + JSON.stringify(orderinfo,undefined,4));
            this.firebase.lineNotification('Order失敗' + '\n' + 'Error' + JSON.stringify(err,undefined,4));
            orderinfo.size_exec = 0;
            orderinfo.status = 'orderfail';
            this.emit('orderfailed', orderinfo);
        }else{
            var updateinfo = orderinfo;
            updateinfo.orderId = result;
            this.logger.debug('Orderが成功しました。' + '\n\n' + 'Arg:' + JSON.stringify(orderinfo,undefined,4));
            updateinfo.status = "open";
            updateinfo.ordertime = moment().format("YYYY-MM-DD HH:mm:ss");
            this.emit('orderComplete', updateinfo);
        }
    }.bind(this)
};


module.exports = order;
