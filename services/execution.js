var _ = require('underscore');
var moment = require("moment");
var tools = require(__dirname + '/../util/tools.js');

var execution = function(config, exchangeapi, firebase, logger, setting){

    this.config = config;
    this.exchangeapi = exchangeapi;
    this.logger = logger;
    this.firebase = firebase;
    this.setting = setting;

    _.bindAll(this,
        'executionApi',
        'execConfirm',
        'confirmExec',
        'stopconfirmExec'
    );
};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(execution, EventEmitter);
//---EventEmitter Setup

execution.prototype.executionApi = function(finishedOrderinfo){
    //For production
    if(this.setting.runningmode === 'production'){
        this.exchangeapi.getExecution(false, finishedOrderinfo, this.execConfirm(finishedOrderinfo, finishedOrderinfo.key));
    //For test
    }else{
        var callExecConfirm = this.execConfirm(finishedOrderinfo, finishedOrderinfo.key);
        var max = 1;
        var min = 10;
        var random = Math.floor( Math.random() * (max + 1 - min) ) + min;
        var result;
        if(random < 4){
            //完全約定
            result = {
                size_exec: finishedOrderinfo.size,
                commission : finishedOrderinfo.commission_key_pre,
                status : 'closed',
                complete : 'complete',
                price_exec : finishedOrderinfo.price,
                amount : tools.floor(finishedOrderinfo.size * finishedOrderinfo.price, 7)
            };
            callExecConfirm(null, result);
        }else if(random < 6){
            //一部約定
            result = {
                size_exec: tools.floor(Number(finishedOrderinfo.size * random * 0.1), 7),
                commission : finishedOrderinfo.commission_key_pre,
                status : 'partclosed',
                complete : 'complete',
                price_exec : finishedOrderinfo.price,
                amount : tools.floor(tools.floor(Number(finishedOrderinfo.size * random * 0.1), 7) * finishedOrderinfo.price, 7)
            };
            callExecConfirm(null, result);
        }else if(random < 9){
            //0size
            result = {
                size_exec: 0,
                commission : 0,
                status : 'canceled',
                complete : 'complete',
                price_exec : 0,
                amount : 0
            };
            callExecConfirm(null, result);
        }else{
            callExecConfirm('error',null);
        }
    }
};

execution.prototype.execConfirm = function(finishedOrder, primarykey){
    return function(err, result){
        var finishExec = function(execInfo){
            if(execInfo.complete === 'complete'){
                execInfo.closetime = moment().format("YYYY-MM-DD HH:mm:ss");
                if(execInfo.status !== 'closed'){
                    if( tools.floor(execInfo.size - execInfo.size_exec, 7) >= 0.01){
                        this.emit('orderfailed', execInfo);
                    }else{
                        this.firebase.lineNotification('約定失敗：Orderのsize - size_execが0.01未満であるため、再orderは実施しません。' + '\n' + 'execInfo.size:' + execInfo.size + '\n' + 'execInfo.size_exec:' + execInfo.size_exec);
                        this.logger.debug('約定失敗：Orderのsize - size_execが0.01未満であるため、再orderは実施しません。' + '\n' + 'execInfo.size:' + execInfo.size + '\n' + 'execInfo.size_exec:' + execInfo.size_exec);
                    }
                }
                this.emit('orderUpdateFromFinishedToCompleted', execInfo, primarykey);
            }else{
                this.emit('orderUpdateFinished', execInfo, primarykey);
            }
        }.bind(this)

        if(err){
            this.logger.error('Error(execution.js) \n' + 'Error' + JSON.stringify(err,undefined,4));
            this.firebase.lineNotification('Error(execution.js) \n' + 'Error' + JSON.stringify(err,undefined,4));
        }else{
            var execInfo = _.extend(finishedOrder, result);
            var needfiatChange = _.where(this.setting.needfiatChange, {pair: execInfo.pair, formatedpair: execInfo.formatedpair})[0];
            if(needfiatChange){
                this.exchangeapi.getFiatRate(true, function(fiatRate){
                    var target = _.find(fiatRate.quotes, function(fiat){
                        return fiat.currencyPairCode == "USDJPY";
                    });
                    execInfo.formatedprice_exec = tools.floor(execInfo.price_exec / target["ask"], 7);
                    finishExec(execInfo);
                });
            }else{
                execInfo.formatedprice_exec = execInfo.price_exec;
                finishExec(execInfo);
            }
        }
    }.bind(this)
};


execution.prototype.confirmExec = function(cb){
    this.executionInterval = setInterval(function(){
        this.exchangeapi.getQueue(function(result){
            if(result === 0){
                this.firebase.referArray(this.setting.finishedpass, function(array){
                    if(array !== null && array !== undefined){
                        _.each(array,function(finishedOrder,key){
                            if(finishedOrder){
                                finishedOrder.pair = finishedOrder.pair;
                                finishedOrder.key = key;
                                setTimeout(function(){
                                    this.emit("getAlreadyfinishedOrder", finishedOrder);
                                }.bind(this), 10);
                            }
                        }.bind(this))
                    }else{
                        if(cb){
                            cb();
                        }
                    }
                }.bind(this))
            }
        }.bind(this))
    }.bind(this), 1000 * 33 * 1);
};

execution.prototype.stopconfirmExec = function(){
    clearInterval(this.executionInterval);
};

module.exports = execution;