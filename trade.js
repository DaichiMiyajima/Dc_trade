/*
 * Main entry point for our app
 * "start" method gets called when the project get started
 * I always have underscore.js everwhere
 */

var _ = require('underscore');
var loggingservice = require(__dirname + '/services/loggingservice.js');

var app = function(){
 
    _.bindAll(this, 'launchTrader', 'oneorder', 'getexec', 'orderfail', 'start');
    
};

/*
* 通常
*/
app.prototype.launchTrader = function(){
    this.app = require(__dirname + '/apps/trader.js');
    this.app.start();
}

/*
* 1件のみオーダー
*/
app.prototype.oneorder = function(){
    this.app = require(__dirname + '/apps/oneorder.js');
    this.app.start(process.argv[3]);
}

/*
* 約定apiのみ
*/
app.prototype.getexec = function(){
    this.app = require(__dirname + '/apps/getexec.js');
    this.app.start(process.argv[3]);
}

/*
* orderfailの再import
*/
app.prototype.orderfail = function(){
    this.app = require(__dirname + '/apps/orderfail.js');
    this.app.start();
}

app.prototype.start = function(){
    var argument = process.argv[2];

    if(argument === '-all'){
        this.appName = 'trader';
        this.run = this.launchTrader;
    }else if(argument === '-oneorder'){
        if(process.argv[3]){
            this.run = this.oneorder;
        }else{
            console.log("第3引数にデータのkeyを指定してください。")
            this.run = null;
        }
    }else if(argument === '-getexec'){
        this.run = this.getexec;
    }else if(argument === '-orderfail'){
        this.run = this.orderfail;
    }else{
        console.log("引数に-all or -oneorder or -getexec or -orderfail を指定してください。")
        this.appName = 'app';
        run = null;
    }

    if(this.run) {
        this.run();
    }
}

var dcTrade = new app();
dcTrade.start();
