const EventEmitter = require('events')
, TamedURLCaller = require('./TamedCallers').url
, TamedPoller = require('./TamedPoller')
//, utils = require('simpleutils') //debug-only
;

class CallerDom extends EventEmitter {
  constructor(name, interval = 1, concurrency = 1, cacheExpiration = false) {
    super();

    this._name = name;
    this._interval = interval;
    this._concurrency = concurrency; //not used currently
    this._cacheExpiration = cacheExpiration;

    this._queue = [];
    this._timer = null;

    this._polls = {};
  }

  _callURL(tURL, method = 'get', params = {}, priority = false) {
    let caller = new TamedURLCaller(method, tURL, params);
    this._registerCall(caller, priority);
    return caller.getPromise();
  }
  call(tURL, method, params) { return this._callURL(tURL, method, params); }
  callFirst(tURL, method, params) { return this._callURL(tURL, method, params, 'priority'); }

  // force(tURL, method = 'get', params = {}) { //figure out how not to trigger "aftercall"
  //   let caller = new TamedURLCaller(tURL); caller.run();
  // }

  _registerCall(caller, priority = false) {
    if (priority) {
      this._queue.unshift(caller);
    } else {
      this._queue.push(caller);
    }
    return this._checkQueue();
  }
  _checkQueue() {
    if (this._running) { return false; }
    if (!this._queue.length) { return false; }
    return this._runNextCall();
  }
  _runNextCall() {
    this._running = true;
    let caller = this._queue.shift();
    //utils.print.debug('['+ this._name +'] Running next call (still '+ this._queue.length +' to go)...');

    //scheduling next queue check
    caller.run().then(() => {
      process.nextTick(this._afterCall.bind(this));
    }).catch(() => {
      process.nextTick(this._afterCall.bind(this));
    });
    return true;
  }
  _afterCall() {
    if (!this._interval) { return this._afterInterval(); }
    setTimeout(this._afterInterval.bind(this), this._interval *1000);
    return true;
  }
  _afterInterval() {
    this._running = false;
    if (this._queue.length) {
      return this._checkQueue();
    }
    return true;
  }

  poll(name, interval, tURL, method = 'get', params = {}) {
    return this._createPoll(name, interval, 'url', [method, tURL, params]);
  }
  pollExternal(name, interval, tFunction, thisObject, params = ['nodeback']) {
    return this._createPoll(
      name, interval, 'external', [tFunction, thisObject, params]
    );
  }

  _createPoll(name, interval, tType, callData) {
    //check if name exists first
    let existingPoll = this._polls[name];
    if (existingPoll) {
      //let existingInterval = existingPoll.getInterval();
      //if (interval < existingInterval) {
      //  existingPoll.setInterval(interval);
      //}
    } else {
      this._polls[name] = new TamedPoller(this, name, interval, tType, callData);
    }
    return name;
  }
  _pollResult(name, ...result) {
    //utils.print.debug('['+ this._name +'] ===== POLL RESULT ---- '+ name);
    this.emit(name, ...result);
  }
  _pollError(name, ...errData) {
    //utils.print.debug('['+ this._name +'] ===== POLL ERROR ---- '+ name);
    console.log(errData);
    this.emit('ERR_'+ name, ...errData);
  }

  getCachedData(name) {
    return this._cache[name] || false;
  }
}


let _ = {
  'queue': {},

  'createQueue': function (name, interval, concurrency, cacheExpiration) {
    _.queue[name] = new CallerDom(
      name, interval, concurrency, cacheExpiration
    );
    return _.queue[name];
  },
  'getQueue': function (name) { return _.queue[name] || false; },

  'getCachedData': function (qName, cacheName) {
    let q = _.getQueue(qName);
    return q.getCachedData(cacheName);
  }
};

module.exports = _;
