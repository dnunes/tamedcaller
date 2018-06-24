'use strict';

const EventEmitter = require('events')
, TamedURLCaller = require('./TamedCallers').url
, TamedFuncCaller = require('./TamedCallers').func
, TamedPoller = require('./TamedPoller')
;

let _defaultLogCallback = function() {};
class CallerDom extends EventEmitter {
  constructor(name, interval = 1, runIntervalAfterReturn = true, callsTimeout = 10) {
    super();

    this._name = name;
    this._interval = interval;
    this._intervalAfterReturn = runIntervalAfterReturn;
    this._callsTimeout = callsTimeout;

    this._queue = [];
    this._timer = false;

    this._polls = {};

    this._logCallback = _defaultLogCallback;
  }

  setLogCallback(newObj) { this._logCallback = newObj; }

  _callURL(tURL, method = 'get', params = {}, priority = false) {
    let caller = new TamedURLCaller(method, tURL, params);
    this._registerCall(caller, priority);
    return caller.getPromise();
  }
  _callFunc(tFunc, params = {}, priority = false) {
    let caller = new TamedFuncCaller(tFunc, params);
    this._registerCall(caller, priority);
    return caller.getPromise();
  }
  call(tURL, method, params) { return this._callURL(tURL, method, params); }
  callFirst(tURL, method, params) { return this._callURL(tURL, method, params, 'priority'); }
  callExternal(tFunc, params) { return this._callFunc(tFunc, params); }
  callExternalFirst(tFunc, params) { return this._callFunc(tFunc, params, 'priority'); }

  // force(tURL, method = 'get', params = {}) { //figure out how not to trigger "aftercall"
  //   let caller = new TamedURLCaller(tURL); caller.run();
  // }

  _registerCall(caller, priority = false) {
    this._queue[priority ? 'unshift' : 'push'](caller);
    if (!this._timer) {
      this._timer = setTimeout(this._checkQueue.bind(this), 0);
    }
  }
  _checkQueue() {
    this._timer = false;
    if (this._running) { return false; }
    if (!this._queue.length) { return false; }
    return this._runNextCall();
  }
  _runNextCall() {
    this._running = true;
    //if (this._name !== '_immediate') {
    //  console.log('%%%% Checando Queue '+ this._name +'... length: '+ this._queue.length);
    //}
    let caller = this._queue.shift();
    //if (this._queue.length > 0) {
    //  console.log('['+ this._name +'] Call running but still '+ this._queue.length +' itens left in queue.');
    //}

    //check next in queue
    let promise = caller.run();
    if (!this._intervalAfterReturn) { //start next cycle immediately
      process.nextTick(this._afterCall.bind(this));

    } else { //schedule next cycle for after getting response
      promise.then(() => {
        process.nextTick(this._afterCall.bind(this));
      }).catch(() => {
        process.nextTick(this._afterCall.bind(this));
      });
    }
    return true;
  }
  _afterCall() {
    //if (this._name !== '_immediate') {
    //  console.log('%%%% ['+ this._name +'] returned. Next in '+ this._interval);
    //}
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
  pollExternal(name, interval, tFunction, params = ['cb_nodeback']) {
    return this._createPoll(
      name, interval, 'external', [tFunction, params]
    );
  }
  stopPoll(name) {
    let existingPoll = this._polls[name];
    if (!existingPoll) { return false; }
    existingPoll._kill();
    delete this._polls[name];
    return true;
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
      this._polls[name] = new TamedPoller(this,
        name, interval, tType, callData
      );
    }
    return name;
  }
  _pollResult(name, resultArray) {
    //console.log('['+ this._name +'] ===== POLL RESULT ---- '+ name +' ('+ resultArray.length +' itens)');
    this.emit(name, ...resultArray);
  }
  _pollError(name, err, resultArray) {
    this._logCallback('error',
      'Poll error',
      {'poll': this._name},
      {'err': err, 'errData': resultArray}
    );
    this.emit('ERR_'+ name, err, ...resultArray);
  }

  getCachedData(name) {
    return this._cache[name] || false;
  }
}


let _immediate = null;
let _getImmediate = function () {
  if (!_immediate) { _immediate = new CallerDom('_immediate', 0, false); }
  return _immediate;
};
let _ = {
  'queue': {},

  'setDefaultLogCallback': function (newCB) { _defaultLogCallback = newCB; },

  'createQueue': function (name, interval, runIntervalAfterReturn, callsTimeout) {
    _.queue[name] = new CallerDom(
      name, interval, runIntervalAfterReturn, callsTimeout
    );
    return _.queue[name];
  },
  'getQueue': function (name) { return _.queue[name] || false; },

  'getImmediate': function () { return _getImmediate(); },
  'call': function (...params) { return _getImmediate().call(...params); },

  'getCachedData': function (qName, cacheName) {
    let q = _.getQueue(qName);
    return q.getCachedData(cacheName);
  }
};

module.exports = _;
