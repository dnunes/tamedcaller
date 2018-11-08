'use strict';

const EventEmitter = require('events')
, TamedURLCaller = require('./TamedCallers').url
, TamedFuncCaller = require('./TamedCallers').func
, TamedPoller = require('./TamedPoller')
;

let _defaultLogCallback = function() {};
class CallerDom extends EventEmitter {
  constructor(name, interval, runIntervalAfterReturn, callsTimeout = 10) {
    super();

    this._name = name;
    this._interval = interval;
    this._intervalAfterReturn = runIntervalAfterReturn;
    this._callsTimeout = callsTimeout && callsTimeout *1000;

    this._queue = [];
    this._timer = false;

    this._polls = {};

    this._logCallback = _defaultLogCallback;
  }

  setLogCallback(newObj) { this._logCallback = newObj; }

  _callURL(
    tURL, method = 'get', params = {}, priority = false, forceTimeout = false
  ) {
    const caller = new TamedURLCaller(
      method, tURL, params, forceTimeout || this._callsTimeout
    );
    this._registerCall(caller, priority);
    return caller.getPromise();
  }
  _callFunc(tFunc, params = {}, priority = false, forceTimeout = false) {
    const caller = new TamedFuncCaller(
      tFunc, params, forceTimeout || this._callsTimeout
    );
    this._registerCall(caller, priority);
    return caller.getPromise();
  }
  call(tURL, method, params, forceTimeout = false) {
    return this._callURL(tURL, method, params, false, forceTimeout);
  }
  callFirst(tURL, method, params, forceTimeout = false) {
    return this._callURL(tURL, method, params, 'priority', forceTimeout);
  }
  callExternal(tFunc, params) {
    return this._callFunc(tFunc, params);
  }
  callExternalFirst(tFunc, params) {
    return this._callFunc(tFunc, params, 'priority');
  }

  _registerCall(caller, priority = false) {
    this._queue[priority ? 'unshift' : 'push'](caller);
    if (!this._timer) {
      this._timer = process.nextTick(this._checkQueue.bind(this));
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
    const caller = this._queue.shift();
    //if (this._queue.length > 0) {
    //  console.log('['+ this._name +'] Call running but still '+ this._queue.length +' itens left in queue.');
    //}

    //check next in queue
    const promise = caller.run();
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
    if (!this._interval) {
      return process.nextTick(this._afterInterval.bind(this));
    }
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
    const callerParams = [method, tURL, params, this._callsTimeout];
    return this._createPoll(name, interval, 'url', callerParams);
  }
  pollExternal(name, interval, tFunction, params = ['cb_nodeback']) {
    const callerParams = [tFunction, params, this._callsTimeout];
    return this._createPoll(name, interval, 'external', callerParams);
  }
  getPoll(name) { return this._polls[name] || false; }
  setPollInterval(name, interval) {
    const existingPoll = this._polls[name];
    if (!existingPoll) { return false; }
    return existingPoll.setInterval(interval);
  }
  stopPoll(name) {
    const existingPoll = this._polls[name];
    if (!existingPoll) { return false; }
    existingPoll._kill();
    delete this._polls[name];
    return true;
  }

  _createPoll(name, interval, tType, callData) {
    //check if name exists first
    const existingPoll = this._polls[name];
    if (existingPoll) {
      existingPoll.updateInterval(interval);
      return false;
    }
    this._polls[name] = new TamedPoller(this,
      name, interval, tType, callData
    );
    return true;
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
    this.emit('ERR_'+ name, err, resultArray);
  }

  getCachedData(name) {
    return this._cache[name] || false;
  }
}


let _immediate = null;
const _getImmediate = function () {
  if (!_immediate) { _immediate = new CallerDom('_immediate', 0, false); }
  return _immediate;
};
const _ = {
  'queue': {},

  'setDefaultLogCallback': function (newCB) { _defaultLogCallback = newCB; },

  'createQueue': function (
    name, interval = 1, runIntervalAfterReturn = true, callsTimeout = 10
  ) {
    _.queue[name] = new CallerDom(
      name, interval, runIntervalAfterReturn, callsTimeout
    );
    return _.queue[name];
  },
  'getQueue': function (name) { return _.queue[name] || false; },

  'getImmediate': function () { return _getImmediate(); },
  'call': function (...params) { return _getImmediate().call(...params); },

  'getCachedData': function (qName, cacheName) {
    const q = _.getQueue(qName);
    return q.getCachedData(cacheName);
  }
};

module.exports = _;
