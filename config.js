var config = {};

config.init = function () {
    var filename = __dirname+"/config/config.json";
    var text = require("fs").readFileSync(filename);
    if(!text) {
        throw new Error("Couldn't read config file "+filename);
    }
    var obj = JSON.parse(text);
    return obj;
}

module.exports = config;
