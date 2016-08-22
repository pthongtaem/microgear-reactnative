/**
 * NetPIE microgear Library for React Native
 * https://github.com/pthongtaem/microgear-reactnative
*/

import OAuth from 'oauth';
import crypto from 'crypto';
import path from 'path';
import events from 'events';
import mqtt from 'mqtt';
import fs from 'fs';
import https from 'https';
import http from 'http';
import url from 'url';

/**
 * General API Endpoint
 */
const GEARAPIADDRESS = 'ga.netpie.io';
const GEARAPIPORT = '8080';
const GEARAPISECUREPORT = '8081';
const GBPORT = '1883';
const GBSPORT = '8883';

/**
 * Microgear API version
 */
const MGREV = 'NJS1b';

/**
 * Constants
 */
const DEBUGMODE = false;
const MINTOKDELAYTIME = 100;
const MAXTOKDELAYTIME = 30000;
const RETRYCONNECTIONINTERVAL = 5000;

let topModule = module;
while (topModule.parent) {
  topModule = topModule.parent;
}

const appdir = path.dirname(topModule.filename);
const ps = {
  p: 'online',
  a: 'offline',
  n: 'aliased',
  u: 'unaliased',
};

/**
 * Create MicroGear client
 * @param  {object} param client parameter
 * @return {object}       microgear client
 */
function create(param) {
  let httpclient = null;
  // let oauth;

  const microgear = function (gearkey, gearsecret, gearalias) {
    this.securemode = false;
    this.debugmode = DEBUGMODE;
    this.gearkey = gearkey;
    this.gearsecret = gearsecret;
    this.gearalias = gearalias ? gearalias.substring(0, 16) : null;
    this.appid = null;
    this.gearname = null;
    this.accesstoken = null;
    this.requesttoken = null;
    this.client = null;
    this.scope = '';
    this.gearexaddress = null;
    this.gearexport = null;
    this.subscriptions = [];
    this.options = {};
    this.toktime = MINTOKDELAYTIME;
    this.microgearcache = `microgear-${this.gearkey}.cache`;
  };

  microgear.prototype = new events.EventEmitter();

  microgear.prototype.cache = {
    getItem: (key) => {
      try {
        const val = fs.readFileSync(`${appdir}/${key}`);
        if (typeof (val) !== 'undefined') {
          const jsonobj = JSON.parse(val);
          return jsonobj._;
        }

        return null;
      } catch (e) {
        return null;
      }
    },
    setItem: (key, val) => {
      fs.writeFileSync(`${appdir}/${key}`, JSON.stringify({ _: val }));
    },
  };

  /**
   * Override cache file path
   * @param  {string} path cache file path
   */
  microgear.prototype.setCachePath = function (cachePath) {
    this.microgearcache = cachePath;
  };

  /**
   * Override cache file path
   * @param  {string} path cache file path
   */
  microgear.prototype.useTLS = function (usetls) {
    this.securemode = usetls;
  };

  /**
   * Cache getter
   * @param  {string} key key name
   * @return {String}     value
   */
  microgear.prototype.getGearCacheValue = function (key) {
    const c = this.cache.getItem(this.microgearcache);
    if (c == null) return null;
    return c[key];
  };

  /**
   * Cache setter
   * @param {String} key   key name
   * @param {String} value value
   */
  microgear.prototype.setGearCacheValue = function (key, value) {
    let c = this.cache.getItem(this.microgearcache);
    if (c == null) c = {};
    c[key] = value;
    this.cache.setItem(this.microgearcache, c);
  };

  /**
   * Clear cache
   * @param {String} key   key name
   */
  microgear.prototype.clearGearCache = function (key) {
    const c = this.cache.getItem(this.microgearcache);
    if (c == null) return;

    if (key) {
      c[key] = null;
      this.cache.setItem(this.microgearcache, c);
    } else {
      this.cache.setItem(this.microgearcache, null);
    }
  };

  /**
   * Helper function to obtain access token
   * @param  {Function} callback Callback
   */
  microgear.prototype.gettoken = function (callback) {
    const self = this;

    httpclient = this.securemode ? https : http;

    if (this.debugmode) console.log('Check stored token');

    const cachekey = this.getGearCacheValue('key');
    if (cachekey && cachekey !== this.gearkey) {
      self.resettoken();
      self.clearGearCache();
    }
    this.setGearCacheValue('key', this.gearkey);
    if (!this.accesstoken) {
      this.accesstoken = this.getGearCacheValue('accesstoken');
    }
    if (this.accesstoken) {
      if (this.accesstoken.endpoint !== '') {
        const endpoint = url.parse(this.accesstoken.endpoint);
        this.gearexaddress = endpoint.hostname;
        this.gearexport = endpoint.port;
        if (typeof (callback) === 'function') callback(3);
      } else {
        let opt;
        if (this.securemode) {
          opt = {
            host: GEARAPIADDRESS,
            path: `/api/endpoint/${this.gearkey}`,
            port: GEARAPISECUREPORT,
            method: 'GET',
          };
        } else {
          opt = {
            host: GEARAPIADDRESS,
            path: `/api/endpoint/${this.gearkey}`,
            port: GEARAPIPORT,
            method: 'GET',
          };
        }
        const rq = httpclient.request(opt, (res) => {
          let buff = '';
          res.on('data', (chunk) => {
            buff += chunk;
          });
          res.on('end', () => {
            if (buff) {
              self.accesstoken.endpoint = buff;
              self.setGearCacheValue('accesstoken', self.accesstoken);
              if (typeof (callback) === 'function') callback(3);
            }
            if (typeof (callback) === 'function') callback(2);
          });
        });
        rq.on('error', (e) => {
          if (typeof (callback) === 'function') callback(2);
        });
        rq.end();
      }
    } else {
      if (!this.requesttoken) {
        this.requesttoken = this.getGearCacheValue('requesttoken');
      }
      if (this.requesttoken) {
        /* send requesttoken to obtain accesstoken*/

        if (self.debugmode) {
          console.log('already has request token');
          console.dir(this.requesttoken);
          console.log('Requesting an access token.');
        }

        let oauthurl;
        if (this.securemode) oauthurl = `https://${GEARAPIADDRESS}:${GEARAPISECUREPORT}/api/atoken`;
        else oauthurl = `http://${GEARAPIADDRESS}:${GEARAPIPORT}/api/atoken`;

        const oauth = new OAuth.OAuth(
          null,
          oauthurl,
          this.gearkey,
          this.gearsecret,
          '1.0',
          '',
          'HMAC-SHA1'
        );

        oauth.getOAuthAccessToken(
          this.requesttoken.token,
          this.requesttoken.secret,
          this.requesttoken.verifier,
          (err, oauth_token, oauth_token_secret, results) => {
            if (!err) {
              const hkey = `${oauth_token_secret}&${self.gearsecret}`;
              const revokecode = crypto.createHmac('sha1', hkey).update(oauth_token).digest('base64').replace(/\//g, '_');

              self.accesstoken = {
                token: oauth_token,
                secret: oauth_token_secret,
                appkey: results.appkey,
                endpoint: results.endpoint,
                revokecode,
              };

              if (results.flag !== 'S') {
                self.setGearCacheValue('accesstoken', self.accesstoken);
                self.setGearCacheValue('requesttoken', null);
              } else {
                self.clearGearCache();
              }
              if (typeof (callback) === 'function') callback(2);
            } else {
              switch (err.statusCode) {
                case 401:   // not authorized yet
                  if (typeof (callback) === 'function') callback(1);
                  break;
                case 500:   // eg. 500 request token not found
                default :
                  self.emit('rejected', 'Request token rejected');
                  if (typeof (callback) === 'function') callback(1);
                  break;
              }
            }
          }
        );
      } else {
        if (self.debugmode) {
          console.log('Requesting a request token.');
        }

        const verifier = this.gearalias ? this.gearalias : MGREV;

        if (!this.scope) this.scope = '';

        let oauthurl;
        if (this.securemode) oauthurl = `https://${GEARAPIADDRESS}:${GEARAPISECUREPORT}/api/rtoken`;
        else oauthurl = `http://${GEARAPIADDRESS}:${GEARAPIPORT}/api/rtoken`;

        const oauth = new OAuth.OAuth(
          oauthurl,
          null,
          this.gearkey,
          this.gearsecret,
          '1.0',
          `scope=${this.scope}&appid=${this.appid}&mgrev=${MGREV}&verifier=${verifier}`,
          'HMAC-SHA1'
        );

        oauth.getOAuthRequestToken({}, (err, oauth_token, oauth_token_secret, results) => {
          if (!err) {
            self.requesttoken = {
              token: oauth_token,
              secret: oauth_token_secret,
              verifier,
            };

            self.setGearCacheValue('requesttoken', self.requesttoken);
            if (typeof (callback) === 'function') callback(1);
          } else if (typeof (callback) === 'function') callback(0);
        });
      }
    }
  };

  /**
   * Authenticate with broker using a current access token
   * @param  {Function} callback Callback
   */
  microgear.prototype.brokerConnect = function (callback) {
    const self = this;

    const hkey = `${this.accesstoken.secret}&${this.gearsecret}`;
    const mqttuser = `${this.gearkey}%${Math.floor(Date.now() / 1000)}`;
    const mqttpassword = crypto.createHmac('sha1', hkey).update(
      `${this.accesstoken.token}%${mqttuser}`).digest('base64'
    );
    const mqttclientid = this.accesstoken.token;

    if (this.debugmode) {
      console.log('mqttuser     : ' + mqttuser);
      console.log('mqttpassword : ' + mqttpassword);
    }

    this.clientid = mqttclientid;

    if (this.securemode) {
      this.client = mqtt.connect(
        `mqtts://${this.gearexaddress}`,
        {
          port: GBSPORT,
          username: mqttuser,
          password: mqttpassword,
          clientId: mqttclientid,
          protocolVersion: 3,
          keepalive: 10,
          will: this.options ? this.options.will : {},
        }
      );
    } else {
      this.client = mqtt.connect(
        `mqtt://${this.gearexaddress}`,
        {
          port: GBPORT,
          username: mqttuser,
          password: mqttpassword,
          clientId: mqttclientid,
          protocolVersion: 3,
          keepalive: 10,
          will: this.options ? this.options.will : {},
        }
      );
    }

    if (this.client) {
      /* subscribe for control messages */
      this.client.subscribe(`/&id/${this.clientid}/#`);
      if (typeof (callback) === 'function') callback(null);
    } else {
      if (typeof (callback) === 'function') callback('error');
      return;
    }

    this.client.on('error', (err) => {
      switch (err.toString()) {
        case 'Error: Connection refused: Bad username or password' : // code 4
          // token may be nolonger valid, try to request a new one
          self.emit('info', 'invalid token, requesting a new one');

          self.clearGearCache();
          self.requesttoken = null;
          self.accesstoken = null;

          self.client.end();
          setTimeout(() => {
            self.initiateConnection(() => {
              if (self.debugmode) console.log('auto reconnect');
            });
          }, RETRYCONNECTIONINTERVAL);
          break;
        case 'Error: Connection refused: Not authorized' : // code 5
          self.emit('warning', 'microgear unauthorized');

          self.client.end();
          setTimeout(() => {
            self.initiateConnection(() => {
              if (self.debugmode) console.log('auto reconnect');
            });
          }, RETRYCONNECTIONINTERVAL);
          break;
        default:
          break;
      }
    });

    this.client.on('message', (topic, message) => {
      const plen = self.appid.length + 1;
      const rtop = topic.substr(plen, topic.length - plen);

      if (rtop.substr(0, 2) === '/&') {
        const p = (`${rtop.substr(1, rtop.length - 1)}/`).indexOf('/');
        const ctop = rtop.substr(2, p);

        switch (ctop) {
          case 'present':
          case 'absent': {
            let pm;
            try {
              pm = JSON.parse(message.toString());
            } catch (e) {
              pm = message.toString();
            }
            self.emit(ctop, pm);
            break;
          }
          case 'resetendpoint' :
            if (self.accesstoken && self.accesstoken.endpoint) {
              self.accesstoken.endpoint = '';
              self.setGearCacheValue('accesstoken', self.accesstoken);
              self.emit('info', 'endpoint reset');
            }
            break;
          default:
            break;
        }
      } else {
        self.emit('message', topic, message);
      }
    });

    this.client.on('close', () => {
      if (self.debugmode) console.log('client close');
      self.emit('disconnected');
    });

    this.client.on('connect', (pack) => {
      for (let i = 0; i < self.subscriptions.length; i++) {
        if (self.debugmode) console.log('auto subscribe ' + self.subscriptions[i]);
        self.client.subscribe(self.subscriptions[i]);
      }

      if (self.listeners('present')) {
        self.client.subscribe(`/${self.appid}/&present`);
      }
      if (self.listeners('absent')) {
        self.client.subscribe(`/${self.appid}/&absent`);
      }

      if (self.gearalias) {
        self.setalias(self.gearalias);
      }

      self.emit('connected');
    });

    this.client.on('end', () => {
      self.emit('pieclosed');
      self.emit('closed');
    });
  };

  /**
   * Initalize a connection to NETPIE
   * @param  {object} callback function
   */
  microgear.prototype.initiateConnection = function (done) {
    const self = this;

    this.gettoken((state) => {
      switch (state) {
        case 0 :    // No token issue
          console.log('Error: request token is not issued, please check your key and secret.');
          throw new Error('Error: request token is not issued, please check your key and secret.');
          return;
        case 1 :    // Request token issued or prepare to request request token again
          setTimeout(() => {
            if (self.toktime < MAXTOKDELAYTIME) self.toktime *= 2;
            self.initiateConnection(done);
          }, self.toktime);
          return;
        case 2 :    // Access token issued
          self.initiateConnection(done);
          self.toktime = 1;
          return;
        case 3 :    // Has access token ready for connecting broker
          self.toktime = 1;
          self.brokerConnect(() => {
            if (typeof (done) === 'function') done();
          });
          return;
        default:
          return;
      }
    });
  };

  /**
   * Do NetPIE connection
   * @param  {String}   appid appid
   * @param  {Function} done  Callback
   */
  microgear.prototype.doConnect = function (arg1, arg2) {
    let done = null;
    if (typeof (arg1) === 'function') {
      done = arg1;
    } else {
      // TODO check bug arg1 when obejct
      if (typeof (arg1) === 'object') {
        this.options = arg1;
        if (this.options && this.options.will && this.options.will.topic) {
          this.options.will.topic = `/${this.appid}${this.options.will.topic}`;
        }
      }
      if (typeof (arg2) === 'function') done = arg2;
    }
    this.initiateConnection(done);
  };

  /**
   * Initiate NetPIE connection
   * @param  {String}   appid appid
   * @param  {Function} done  Callback
   */
  microgear.prototype.connect = function (appid, arg1, arg2) {
    this.appid = appid;
    this.doConnect(arg1, arg2);
  };

  /*
    * Get instance of the microgear
    * @return {Object} microgear instance
    */
  microgear.prototype.getinstance = function () {
    return this;
  };

  /**
   * Close connection
   * @param  {Function} done Callback
   */
  microgear.prototype.disconnect = function (done) {
    this.client.end();
    this.emit('disconnected');
  };

  /**
   * Subscribe topic
   * @param  {String}   topic    Topic string of the form /my/topic
   * @param  {Function} callback Callback
   */
  microgear.prototype.subscribe = function (topic, callback) {
    const self = this;

    if (this.client.connected) {
      this.client.subscribe(`/${this.appid}${topic}`, (err, granted) => {
        if (granted && granted[0]) {
          if (self.subscriptions.indexOf(`/${self.appid}${topic}`)) {
            self.subscriptions.push(`/${self.appid}${topic}`);
          }
        }

        // TODO check bug for if
        if (typeof (callback) === 'function') {
          if (err) {
            callback(0);
          } else if (granted && granted[0] &&
            (granted[0].qos === 0 || granted[0].qos === 1 || granted[0].qos === 2)) {
            callback(1);
          } else {
            callback(0);
          }
        }
      });
    } else {
      self.emit('error', 'microgear is disconnected, cannot subscribe.');
    }
  };

  /**
   * Unscribe topic
   * @param  {String}   topic    Topic string
   * @param  {Function} callback Callback
   */
  microgear.prototype.unsubscribe = function (topic, callback) {
    const self = this;

    if (this.debugmode) {
      console.log(this.subscriptions.indexOf(`/${this.appid}${topic}`));
      console.log(this.subscriptions);
    }

    this.client.unsubscribe(`/${this.appid}${topic}`, () => {
      self.subscriptions.splice(self.subscriptions.indexOf(`/${self.appid}${topic}`));
      if (self.debugmode) console.log(self.subscriptions);
      if (typeof (callback) === 'function') callback();
    });
  };

  /**
   * Deprecated
   * Name this instance of microgear
   * @param  {String}   gearname Gear name
   * @param  {Function} callback Callback
   */
  microgear.prototype.setname = function (gearname, callback) {
    const self = this;

    if (this.gearname) this.unsubscribe(`/gearname/${this.gearname}`);
    this.subscribe(`/gearname/${gearname}`, () => {
      self.gearname = gearname;
      if (typeof (callback) === 'function') callback();
    });
  };

  /**
   * Set alias on this instance
   * @param  {String}   gearname Gear name
   * @param  {Function} callback Callback
   */
  microgear.prototype.setalias = function (newalias, callback) {
    const self = this;

    this.publish(`/@setalias/${newalias}`, '', {}, () => {
      self.gearalias = newalias;
      if (typeof (callback) === 'function') callback();
    });
  };

  /**
   * Reset name of this instance
   * @param  {Function} callback Callback
   */
  microgear.prototype.unsetname = function (callback) {
    const self = this;
    if (this.gearname != null) {
      this.unsubscribe(`/gearname/${this.gearname}`, () => {
        self.gearname = null;
        if (typeof (callback) === 'function') callback();
      });
    }
  };

  /**
   * Publish message
   * @param  {String}   topic    Topic string
   * @param  {String}   message  Message
   * @param  {Object} param Publish Parameters
   */
  microgear.prototype.publish = function (topic, message, param, callback) {
    const self = this;
    let options;

    switch (typeof (param)) {
      case 'object':
        options = param;
        break;
      case 'boolean':
        options = { retain: param };
        break;
      default:
        options = {};
    }

    if (this.client.connected) {
      this.client.publish(`/${this.appid}${topic}`, message, options, callback);
    } else {
      self.emit('error', 'microgear is disconnected, cannot publish.');
    }
  };

  /**
   * Send message to a microgear addressed by @gearname
   * @param  {String}   gearname The name of the gear to send message to
   * @param  {String}   message  Message
   * @param  {Function} callback
   */
  microgear.prototype.chat = function (gearname, message, options) {
    this.publish(`/gearname/${gearname}`, message, options);
  };

  /**
   * call api request on stream data, this method is available only for api tester at the moment
   * @param  {String}   stream The name of stream
   * @param  {String}   filter  Query condition
   */
  microgear.prototype.readstream = function (stream, filter) {
    this.publish(`/@readstream/${stream}`, `{"filter":"${filter}"}`);
  };

  /**
   * call api request to record stream data, this method is available only for api tester at the moment
   * @param  {String}   stream The name of stream
   * @param  {String}   data  Stream data
   */
  microgear.prototype.writestream = function (stream, data) {
    this.publish(`/@writestream/${stream}`, `{"data":${data}}`);
  };

  /**
   * read data from a specific postbox. data will be pushed through the topic /@readpostbox/<box>
   * @param  {String}   box The name of the postbox
   */
  microgear.prototype.readpostbox = function (box) {
    this.publish(`/@readpostbox/${box}`);
  };

  /**
   * put data to a specific postbox
   * @param  {String}   box The name of the postbox
   * @param  {String}   data  the text data to be stored
   */
  microgear.prototype.writepostbox = function (box, data) {
    this.publish(`/@writepostbox/${box}`, data);
  };

  /**
   * Revoke and remove token from cache
   * @param  {Function} callback Callabck
   */
  microgear.prototype.resettoken = function (callback) {
    const self = this;

    httpclient = this.securemode ? https : http;

    this.accesstoken = this.getGearCacheValue('accesstoken');
    if (this.accesstoken) {
      let opt;
      const revokecode = this.accesstoken.revokecode.replace(/\//g, '_');

      if (this.securemode) {
        opt = {
          host: GEARAPIADDRESS,
          path: `/api/revoke/${this.accesstoken.token}/${revokecode}`,
          port: GEARAPISECUREPORT,
          method: 'GET',
        };
      } else {
        opt = {
          host: GEARAPIADDRESS,
          path: `/api/revoke/${this.accesstoken.token}/${revokecode}`,
          port: GEARAPIPORT,
          method: 'GET',
        };
      }

      const rq = httpclient.request(opt, (res) => {
        let result = '';
        res.on('data', (chunk) => {
          result += chunk;
        });
        res.on('end', () => {
          if (result !== 'FAILED') {
            self.clearGearCache();
            if (typeof (callback) === 'function') callback(null);
          } else if (typeof (callback) === 'function') {
            callback(result);
          }
        });
      });
      rq.on('error', (e) => {
        self.emit('error', `Reset token error : ${e.message}`);
        if (typeof (callback) === 'function') callback(e.message);
      });
      rq.end();
    } else if (typeof (callback) === 'function') {
      callback(null);
    }
  };

  process.on('uncaughtException', function (err) {
    this.emit(err);
  });

  microgear.prototype.secureConnect = microgear.prototype.secureconnect;
  microgear.prototype.setName = microgear.prototype.setname;
  microgear.prototype.unsetName = microgear.prototype.unsetname;
  microgear.prototype.setAlias = microgear.prototype.setalias;
  microgear.prototype.resetToken = microgear.prototype.resettoken;

  const gkey = param.key || param.gearkey || '';
  const gsecret = param.secret || param.gearsecret || '';
  const galias = param.alias || param.gearalias || '';

  if (!param) return;

  const scope = param.scope;

  if (gkey && gsecret) {
    const mg = new microgear(gkey, gsecret, galias);
    mg.scope = param.scope;
    mg.on('newListener', function (event, listener) {
      switch (event) {
        case 'present' :
          if (this.client) {
            if (this.client.connected) {
              this.subscribe('/&present');
            }
          }
          break;
        case 'absent' :
          if (this.client) {
            if (this.client.connected) {
              this.subscribe('/&absent');
            }
          }
          break;
        default:
          break;
      }
    });
    return mg;
  }

  return null;
}

module.exports.create = create;
