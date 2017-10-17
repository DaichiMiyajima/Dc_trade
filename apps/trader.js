var _ = require('underscore');
var parseError = require('parse-error');

var firebaseService = require(__dirname + '/../services/firebase.js');
var orderService = require(__dirname + '/../services/order.js');
var executionService = require(__dirname + '/../services/execution.js');
var loggingservice = require(__dirname + '/../services/loggingservice.js');
var exchangeapiService = require(__dirname + '/../services/exchangeapi.js');
var processHandlerService = require(__dirname + '/../services/processHandler.js');
var monitortradeService = require(__dirname + '/../services/monitortrade.js');
var configfile = require(__dirname + '/../config.js');
var config = configfile.init();
var setting = require('../setting.js');

var logger = new loggingservice('trader',setting);
var firebase = new firebaseService(config,logger,setting);
var exchangeapi = new exchangeapiService(config,logger,firebase, setting);
var order = new orderService(config,exchangeapi,firebase,logger,setting);
var execution = new executionService(config,exchangeapi,firebase,logger,setting);
var processHandler = new processHandlerService(config,exchangeapi,firebase,logger,execution,setting);
var monitortrade = new monitortradeService(config,firebase,logger,setting);

var trader = function(){

    firebase.on('systemStream',function(system){
        if(system == 'stop'){
            firebase.lineNotification("緊急停止が選択されました。システムを停止します", function(){
                processHandler.stopApplication();
            });
        }else if(system == 'running'){
            firebase.lineNotification("取引を開始します", function(){
                //Orderを監視
                firebase.childAdded(setting.notyetpass, function(object){
                    //orderIdがブランク,undefinedのデータのみ抽出 = 未注文
                    if(!object.orderId){
                        firebase.emit("getUnfinishedOrder", object);
                    }
                });
                execution.confirmExec();
            });
        }else{
            throw "不正なモードが選択されています";
        }
    });

    firebase.on('getUnfinishedOrder', function(orderinfo){
        order.orderApi(orderinfo);
    });

    execution.on('getAlreadyfinishedOrder', function(finishedOrderinfo){
        execution.executionApi(finishedOrderinfo);
    });

    order.on('orderbackup', function(orderbackup){
        firebase.referObject(setting.systempass, setting.tradestatus, function(object){
            var passBackup = setting.orderbackuppass + '/' + object.time + '/' + orderbackup.orderpairkey + '/';
            if(orderbackup.orderfailkey){
                passBackup = passBackup + 'orderfailed';
            }else{
                passBackup = passBackup + 'normal';
            }
            firebase.updateObject(orderbackup, passBackup, orderbackup.key);
        });
    });

    order.on('orderComplete', function(updateinfo){
        var passFrom = setting.notyetpass;
        var passTo   = setting.finishedpass;
        firebase.moveObject(updateinfo, passFrom, passTo, updateinfo.key, function(){
            setTimeout(function(){
                firebase.referObject(passTo, updateinfo.key, function(object){
                    firebase.emit("getAlreadyfinishedOrder", object);
                });
            }, 5.1 * 1000);
            if(updateinfo.orderfailkey){
                firebase.removeObject(setting.orderFailedPass, updateinfo.orderfailkey);
            }
        });
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
        firebase.lineNotification(message + "\n" + JSON.stringify(object, undefined, 4));
    });

    //オーダー失敗：firebase.orderfailed
    order.on('orderfailed', function(object){
        if( object.size >= setting.minimumtrade[object.exchange]){
            firebase.setObject(object, setting.orderFailedPass, function(){
                if(object.orderfailkey){
                    firebase.removeObject(setting.orderFailedPass, object.orderfailkey);
                }
            });
            firebase.removeObject(setting.notyetpass, object.key);
        }else{
            firebase.lineNotification('Order失敗：Orderのsizeが0.01未満であるため、再orderは実施しません。' + '\n' + 'orderinfo.size:' + object.size);
            logger.debug('Order失敗：Orderのsizeが0.01未満であるため、再orderは実施しません。' + '\n' + 'orderinfo.size:' + object.size);
            if(object.orderfailkey){
                firebase.removeObject(setting.orderFailedPass, object.orderfailkey);
            }
        }
    });

    //firebase.orderUpdateFromFinishedToCompletedを呼び出す
    execution.on('orderUpdateFromFinishedToCompleted', function(execInfo,key){
        var passFrom = setting.finishedpass;
        var passTo   = setting.completedpass;
        firebase.moveObject(execInfo, passFrom, passTo, key, function(){
            monitortrade.monitorfinish(execInfo);
        });
        if(execInfo.status === 'closed'){
            firebase.lineNotification('約定しました。' + "\n" + JSON.stringify(execInfo, undefined, 4));
        }
    });

    //Error catch
    process.on('uncaughtException', function (err) {
        var errorparse = parseError(err);
        firebase.lineNotification("予期しないエラーが発生しました。" + "¥n" + JSON.stringify(errorparse,undefined,4));
        logger.debug("予期しないエラーが発生しました。" + "¥n" + JSON.stringify(errorparse,undefined,4));
        processHandler.stopApplication();
    }.bind(this));

    _.bindAll(this, 'start');
}

trader.prototype.start = function() {

    firebase.getRunning();

};


//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(trader, EventEmitter);
//---EventEmitter Setup



var traderApp = new trader();

module.exports = traderApp;
