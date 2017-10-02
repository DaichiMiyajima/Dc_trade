var request	= require('request');
var crypto = require('crypto');
var jwt = require('jwt-simple');
var querystring	= require('querystring');
var nodeurl = require('url');

/**
 * quoineClient connects to the quoine.jp API
 * @param {String} key    API Key
 * @param {String} secret API Secret
 * @param {String} [otp]  Two-factor password (optional) (also, doesn't work)
 */

function quoineClient(key, secret, otp){
    var self = this;

    var config = {
        url: {
            protocol : 'https',
            slashes : true,
            host : 'api.quoine.com'
        },
        version: 'v2',
        key: key,
        secret: secret,
        otp: otp,
        timeoutMS: 5000
    };

    /**
     * This method makes a public or private API request.
     * @param  {String}   method   The API method (public or private)
     * @param  {Object}   params   Arguments to pass to the api call
     * @param  {Function} callback A callback function to be executed when the request is complete
     * @return {Object}            The request object
     */

    function api(method, queryid , query, body, callback) {
        var id = 0;
        if(queryid){
            id = queryid.eachid;
        }
        var httpdmethod = 'GET';
        if(method === 'postorder'){
            httpdmethod = 'POST'
        }
        if(method === 'cancelorder'){
            httpdmethod = 'PUT'
        }
        var path = {
            getproduct : '/products/' + id,
            getBalance : '/accounts/balance',
            getboard : '/products/' + id + '/price_levels',
            postorder : '/orders/',
            getExecution : '/orders/' + id,
            cancelorder : '/orders/' + id + '/cancel'
        }
        return privateMethod(method, path[method], query, body, httpdmethod, callback);
    }

    /*
     * This method makes a private API request.
     * @param  {String}   method   The API method (public or private)
     * @param  {Object}   params   Arguments to pass to the api call
     * @param  {Function} callback A callback function to be executed when the request is complete
     * @return {Object}            The request object
     */

    function privateMethod(method, path, query, body, httpmethod, callback) {

        query = query || {};
        body = body || null;
        var timestamp = Date.now().toString();
        var url = config.url;
        url.pathname = path;
        url.query = query;
        url = nodeurl.format(url);
        var signature = getMessageSignature(timestamp, path, httpmethod, body);

        var headers = {
            'X-Quoine-API-Version': '2',
            'X-Quoine-Auth': signature,
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
        var token_id = config.key
        var user_secret = config.secret
        var auth_payload = {
            path: path,
            nonce: Date.now().toString(),
            token_id: token_id
        }
        var hmac_digest = jwt.encode(auth_payload, user_secret, 'HS256');
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

       if(httpmethod == 'GET' || httpmethod == 'PUT'){
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
        console.log(options);

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

                if(response.headers.status.indexOf("200") !== -1) {
                    return callback.call(self, null, data);
                }else{
                    return callback.call(self, new Error('Status is ' + response.headers.status), null);
                }

            }
        });

        return req;
    }

    
    self.api = api;
    self.privateMethod = privateMethod;

}

module.exports = quoineClient;
