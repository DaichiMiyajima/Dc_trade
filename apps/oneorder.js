
var _ = require('underscore');
var parseError = require('parse-error');

var firebaseService = require(__dirname + '/../services/firebase.js');
var orderService = require(__dirname + '/../services/order.js');
var loggingservice = require(__dirname + '/../services/loggingservice.js');
var exchangeapiService = require(__dirname + '/../services/exchangeapi.js');
var configfile = require(__dirname + '/../config.js');
var config = configfile.init();
var setting = require('../setting.js');

var logger = new loggingservice('oneorder');
var firebase = new firebaseService(config,logger,setting);
var exchangeapi = new exchangeapiService(config,logger,firebase, setting);
var order = new orderService(config,exchangeapi,firebase,logger,setting);

var oneorder = function(){

    //firebaseからデータ(未注文)取得後firebase.orderApiを呼び出す
    firebase.on('getIdentifiedUnfinishedOrder', function(orderinfo){
        order.oneorderApi(orderinfo);
    });

    //orderApiが成功後firebase.orderCompleteを呼び出す
    order.on('orderComplete', function(updateinfo){
        var passFrom = setting.notyetpass;
        var passTo   = setting.finishedpass;
        firebase.moveObject(updateinfo, passFrom, passTo, updateinfo.key, function(){
            if(updateinfo.orderfailkey){
                firebase.removeObject(setting.orderFailedPass, updateinfo.orderfailkey, function(){
                    process.exit(0);
                });
            }else{
                process.exit(0);
            }
        });
    });

    //オーダー失敗：firebase.orderfailed
    order.on('orderfailed', function(object){
        if( object.size >= setting.minimumtrade[object.exchange]){
            firebase.setObject(object, setting.orderFailedPass, function(){
                if(object.orderfailkey){
                    firebase.removeObject(setting.orderFailedPass, object.orderfailkey,function(){
                        firebase.removeObject(setting.notyetpass, object.key, function(){
                            process.exit(0);
                        });
                    });
                }
            });
        }else{
            firebase.lineNotification('Order失敗：Orderのsizeが0.01未満であるため、再orderは実施しません。' + '\n' + 'orderinfo.size:' + object.size);
            logger.debug('Order失敗：Orderのsizeが0.01未満であるため、再orderは実施しません。' + '\n' + 'orderinfo.size:' + object.size);
            if(object.orderfailkey){
                firebase.removeObject(setting.orderFailedPass, object.orderfailkey, function(){
                    process.exit(0);
                });
            }
        }
    });

    //Error catch
    process.on('uncaughtException', function (err) {
        var errorparse = parseError(err);
        firebase.lineNotification("予期しないエラーが発生しました。" + "¥n" + JSON.stringify(errorparse,undefined,4));
        logger.debug("予期しないエラーが発生しました。" + "¥n" + JSON.stringify(errorparse,undefined,4));
    }.bind(this));

    _.bindAll(this, 'start');

}

oneorder.prototype.start = function(datakey) {

    firebase.lineNotification("Candy_Trade(１件注文:"+ datakey + ")を開始します。");
    firebase.referArray(setting.notyetpass, function(array){
        _.each(array,function(orderinfo,orderinfokey){
            if(!orderinfo.orderId && datakey === orderinfokey){
                orderinfo.key = orderinfokey;
                firebase.emit("getIdentifiedUnfinishedOrder", orderinfo);
            }else{
                firebase.lineNotification("条件に合致しません：!orderinfo.orderId && datakey === orderinfokey");
            }
        }.bind(this));
    });

};


//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(oneorder, EventEmitter);
//---EventEmitter Setup



var oneorderApp = new oneorder();

module.exports = oneorderApp;
