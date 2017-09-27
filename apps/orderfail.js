var _ = require('underscore');

var firebaseService = require(__dirname + '/../services/firebase.js');
var loggingservice = require(__dirname + '/../services/loggingservice.js');
var configfile = require(__dirname + '/../config.js');
var config = configfile.init();
var setting = require('../setting.js');

var logger = new loggingservice('orderfail');
var firebase = new firebaseService(config,logger,setting);

var orderfail = function(){

    _.bindAll(this, 'start');

}

orderfail.prototype.start = function(datakey) {

    firebase.lineNotification("Candy_Trade(orderfail再import)を開始します。");
    firebase.referArray(setting.orderFailedPass, function(array){
        firebase.removeObject(setting.tradepass, 'orderfailed' , function(){
            firebase.updateObject(array, setting.tradepass, 'orderfailed', function(){
                firebase.lineNotification("Candy_Trade(orderfail再import)は正常に終了しました。",function(){
                    process.exit(0);
                })
            });
        })
    });

};

var orderfailApp = new orderfail();

module.exports = orderfailApp;
