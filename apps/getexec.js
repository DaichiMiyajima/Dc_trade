var _ = require('underscore');

var firebaseService = require(__dirname + '/../services/firebase.js');
var executionService = require(__dirname + '/../services/execution.js');
var loggingservice = require(__dirname + '/../services/loggingservice.js');
var exchangeapiService = require(__dirname + '/../services/exchangeapi.js');
var monitortradeService = require(__dirname + '/../services/monitortrade.js');
var configfile = require(__dirname + '/../config.js');
var config = configfile.init();
var setting = require('../setting.js');

var logger = new loggingservice('trader');
var firebase = new firebaseService(config,logger,setting);
var exchangeapi = new exchangeapiService(config,logger);
var execution = new executionService(config,exchangeapi,firebase,logger,setting);
var monitortrade = new monitortradeService(config,firebase,logger,setting);

var trader = function(){

    execution.on('getAlreadyfinishedOrder', function(finishedOrderinfo){
        execution.executionApi(finishedOrderinfo);
    });

    execution.on('orderUpdateFinished', function(execInfo, key){
        var updatepass = setting.finishedpass;
        firebase.updateObject(execInfo, updatepass, key);
    });

    execution.on('orderfailed', function(object){
        if(object.status === 'partclosed'){
            var message = '一部約定しました。再オーダーのデータを作成します。';
        }else{
            var message = '約定が失敗しました。再オーダーのデータを作成します。';
        }
        firebase.setObject(object, setting.orderFailedPass);
        firebase.lineNotification(message + "¥n" + JSON.stringify({
            exchange: object.exchange,
            price: object.price,
            size : object.size - object.size_exec,
            result : object.result
        },undefined,4));
    });

    execution.on('orderUpdateFromFinishedToCompleted', function(execInfo,primarykey){
        var passFrom = setting.finishedpass;
        var passTo   = setting.completedpass;
        firebase.moveObject(execInfo, passFrom, passTo, primarykey,function(){
            monitortrade.monitorfinish(execInfo);
        });
    });
    _.bindAll(this, 'start');

}

trader.prototype.start = function() {
    firebase.lineNotification("Candy_Trade(getexecモード)を開始します。");
    execution.confirmExec(function(){
        firebase.lineNotification("Candy_Trade(getexecモード)は正常に終了しました。", function(){
            process.exit(0);
        })
    });
};


//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(trader, EventEmitter);
//---EventEmitter Setup



var traderApp = new trader();

module.exports = traderApp;
