var request	= require('request');
var crypto = require('crypto');
var querystring	= require('querystring');
var nodeurl = require('url');

/**
 * bitflyerClient connects to the bitflyer.jp API
 * @param {String} key    API Key
 * @param {String} secret API Secret
 * @param {String} [otp]  Two-factor password (optional) (also, doesn't work)
 */

function bitflyerClient(key, secret, otp){
    var self = this;

    var config = {
        url: {
            protocol : 'https',
            slashes : true,
            host : 'api.bitflyer.jp'
        },
        version: 'v1',
        key: key,
        secret: secret,
        otp: otp,
        timeoutMS: 180000
    };

    /**
     * This method makes a public or private API request.
     * @param  {String}   method   The API method (public or private)
     * @param  {Object}   params   Arguments to pass to the api call
     * @param  {Function} callback A callback function to be executed when the request is complete
     * @return {Object}            The request object
     */

    function api(method, query, body, callback) {
        var methods = {
            get_public: [],
            post_public: [],
            get_private: ['getbalance','gettradingcommission','getexecutions'],
            post_private: ['sendchildorder']
        };

        if(methods.get_public.indexOf(method) !== -1) {
            return publicMethod(method, query, body, 'GET', callback);
        }
        else if(methods.post_public.indexOf(method) !== -1) {
            return publicMethod(method, query, body, 'POST', callback);
        }
        else if(methods.get_private.indexOf(method) !== -1) {
            return privateMethod(method, query, body, 'GET', callback);
        }
        else if(methods.post_private.indexOf(method) !== -1) {
            return privateMethod(method, query, body, 'POST', callback);
        }
        else {
            throw new Error(methods + ' is not a valid API method.');
        }
    }

    /**
     * This method makes a public API request.
     * @param  {String}   method   The API method (public or private)
     * @param  {Object}   params   Arguments to pass to the api call
     * @param  {Function} callback A callback function to be executed when the request is complete
     * @return {Object}            The request object
     */

    function publicMethod(method, query, body, httpmethod, callback) {
        query = query || {};
        body = body || null;

        var url = config.url;
        url.pathname = '/' + config.version + '/public/' + method;
        url.query = query;
        url = nodeurl.format(url);

        return rawRequest(url, {}, body, httpmethod, callback);
    }


    /*
     * This method makes a private API request.
     * @param  {String}   method   The API method (public or private)
     * @param  {Object}   params   Arguments to pass to the api call
     * @param  {Function} callback A callback function to be executed when the request is complete
     * @return {Object}            The request object
     */

    function privateMethod(method, query, body, httpmethod, callback) {
        query = query || {};
        body = body || null;
        var timestamp = Date.now().toString();
        var url = config.url;
        url.pathname = '/' + config.version + '/me/' + method;
        url.query = query;
        url = nodeurl.format(url);
        var signature = getMessageSignature(timestamp, nodeurl.parse(url).path, httpmethod, body);

        var headers = {
            'ACCESS-KEY': config.key,
            'ACCESS-TIMESTAMP': timestamp,
            'ACCESS-SIGN': signature,
            'Content-Type': 'application/json'
        };
        return rawRequest(url, headers, body, httpmethod, callback);
    }

    /**
     * This method returns a signature for a request as a Base64-encoded string
     * @param  {String}  path    The relative URL path for the request
     * @param  {Object}  request The POST body
     * @param  {Integer} nonce   A unique, incrementing integer
     * @return {String}          The request signature
     */
    function getMessageSignature(timestamp, path, httpmethod, body) {

        var method = httpmethod;
        var secret = config.secret;
        var text = (httpmethod == 'GET') ? timestamp + method + path : timestamp + method + path + body;
        var hmac_digest = crypto.createHmac('sha256', secret).update(text).digest('hex');

        return hmac_digest;
    }
    
    /**
     * This method sends the actual HTTP request
     * @param  {String}   url      The URL to make the request
     * @param  {Object}   headers  Request headers
     * @param  {Object}   params   POST body
     * @param  {Function} callback A callback function to call when the request is complete
     * @return {Object}            The request object
     */

    function rawRequest(url, headers, body, httpmethod, callback){
        // Set custom User-Agent string
        // headers['User-Agent'] = 'Bitflyer Javascript API Client';
        if(httpmethod == 'GET'){
            var options = {
                url: url,
                method: httpmethod,
                headers: headers 
            };
        }else{
            var options = {
                url: url,
                method: httpmethod,
                body: body,
                headers: headers 
            };
        }
        var req = request(options, function(error, response, body){
            if(typeof callback === 'function'){
                var data;

                if(error){
                    return callback.call(self, new Error('Error in server response: ' + JSON.stringify(error)), null);
                }
                try {
                    data = JSON.parse(body);
                }
                catch(e) {
                    return callback.call(self, new Error('Could not understand response from server: ' + body), null);
                }
                //If any errors occured, Bitflyer will give back error status 
                //https://bitflyer.jp/ja/corporate/echo/api
                if(data.status <= -100){
                    return callback.call(self, new Error('Bitflyer API returned error: ' + data.status + ':' + data.error_message), null);
                }
                else {
                    return callback.call(self, null, data);
                }
            }
        });

        return req;
    }

    
    self.api = api;
    self.publicMethod = publicMethod;
    self.privateMethod = privateMethod;

}

module.exports = bitflyerClient;
