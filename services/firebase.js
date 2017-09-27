var _ = require('underscore');
var moment = require("moment");

var firebase = function(config, logger, setting){

    var admin = require("firebase-admin");
    this.admin = admin;
    var serviceAccount = require(__dirname + "/../config/digitalcurrency-72f17-firebase-adminsdk-fu9sz-cb367e2a26.json");

    //to check if Firebase has already been initialized.
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: config.databaseURL
        });
    }

    // As an admin, the app has access to read and write all data, regardless of Security Rules
    this.FirebaseAccess = admin.database().ref();

    this.logger = logger;
    this.setting = setting;

    _.bindAll(this,
        'lineNotification',
        'childAdded',
        'referArray',
        'referObject',
        'getRunning',
        'setObject',
        'updateObject',
        'removeObject',
        'moveObject',
        'detachOrder',
        'disconnect',
        'completeCollback'
    );

};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(firebase, EventEmitter);
//---EventEmitter Setup


firebase.prototype.getRunning = function(){
    this.FirebaseAccess.child(this.setting.runningpass).on("value", function(snapshot) {
        var data = snapshot.val();
        this.emit("systemStream", data);
    }.bind(this), function (errorObject) {
        console.log("The read failed: " + errorObject.code);
    });
}

firebase.prototype.lineNotification = function(message,cb){
    var args = arguments;
    var newLine = this.FirebaseAccess.child(this.setting.linepass).push();
    newLine.set({
        "system" : "candy_trade",
        "message" : message,
        "time" : moment().format("YYYY-MM-DD HH:mm:ss")
    },this.completeCollback('lineNotification',args,cb))
}

/* 参照系 */
    /* common */
    firebase.prototype.childAdded = function(pass, cb){
        this.FirebaseAccess.child(pass).on("child_added", function(snapshot) {
            var object = snapshot.val();
            object.key = snapshot.key;
            if(cb){
                cb(object);
            }
        })
    }
    firebase.prototype.referArray = function(pass, cb){
        this.FirebaseAccess.child(pass).once("value").then(function(snapshot) {
            var array = snapshot.val();
            if(cb){
                cb(array);
            }
        }.bind(this), function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
    }
    firebase.prototype.referObject = function(pass, key, cb){
        this.FirebaseAccess.child(pass).child(key).once("value").then(function(snapshot) {
            var object = snapshot.val();
            object.key = key;
            if(cb){
                cb(object);
            }
        }.bind(this), function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
    }
/* 参照系 */

/* 更新系 */
    firebase.prototype.setObject = function(object, pass, cb){
        var args = arguments;
        var setObject = this.FirebaseAccess.child(pass).push();
        setObject.set(object, this.completeCollback('setObject',args, cb));
    };
    
    firebase.prototype.updateObject = function(object, pass, key, cb){
        var args = arguments;
        this.FirebaseAccess.child(pass).child(key).update(object, this.completeCollback('updateObject',args, cb));
    };
    
    firebase.prototype.removeObject = function(pass,key, cb){
        var args = arguments;
        this.FirebaseAccess.child(pass).child(key).remove(this.completeCollback('removeObject',args, cb));
    };
    
    firebase.prototype.moveObject = function(object, passFrom, passTo, key, cb){
        var args = arguments;
        this.FirebaseAccess.child(passTo).child(key).set(
            object,
            this.completeCollback('moveObject(set)',args,function(){
                this.FirebaseAccess.child(passFrom).child(key).remove(
                    this.completeCollback('moveObject(remove)',args, cb)
                )
            }.bind(this))
        );
    };
/* 更新系 */

firebase.prototype.detachOrder = function(pass){
    this.FirebaseAccess.child(pass).off();
};

firebase.prototype.disconnect = function(){
    this.admin.app().delete();
};

/*
** firebaseのコールバックの処理の共通化
*/
firebase.prototype.completeCollback = function(taskname,args,cb){
    return function(err){
        if(err){
            this.logger.error('Error(Firebase.js) :' + taskname + ':' + JSON.stringify(args));
            this.lineNotification("[Error(Firebase.js)] :\n" + "*on this job, error happened:" + args.taskname + "\n\n" + "Args:" + JSON.stringify(args));
        }else{
            this.logger.debug('Success(Firebase.js) :' + taskname);
            if(cb){
                cb();
            }
        }
    }.bind(this)
};

module.exports = firebase;
