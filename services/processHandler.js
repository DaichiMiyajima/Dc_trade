var _ = require('underscore');
var execSync = require('child_process').execSync;

var processHandler = function(config, exchangeapi, firebase, logger, execution, setting){

    this.config = config;
    this.exchangeapi = exchangeapi;
    this.firebase = firebase;
    this.logger = logger;
    this.execution = execution;
    this.setting = setting;

    _.bindAll(this,
        'stopApplication'
    );
};

processHandler.prototype.stopApplication = function(){
    this.logger.debug("緊急停止を試みます");
    this.firebase.lineNotification("緊急停止を試みます");
    this.firebase.detachOrder(this.setting.notyetpass);
    this.execution.stopconfirmExec();
    var stopprocess = setInterval(function(){ 
        this.exchangeapi.getQueue(function(result){
            if(result === 0){
                this.logger.debug("緊急停止成功しました");
                this.firebase.lineNotification("緊急停止成功しました",this.firebase.disconnect);
                clearInterval(stopprocess);
                var result =  execSync('forever stop trade.js');
            }else{
                this.logger.debug("スレッド継続中:" + result + "件");
                this.firebase.lineNotification("スレッド継続中:" + result + "件");
            }
        }.bind(this)); 
    }.bind(this),10000);
};


module.exports = processHandler;