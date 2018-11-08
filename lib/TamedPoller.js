'use strict';

const TamedURLCaller = require('./TamedCallers').url
, TamedFuncCaller = require('./TamedCallers').func
;

class TamedPoller {
  constructor(callerDom, name, interval, tType, callData) {
    this._callerDom = callerDom;
    this._name = name;
    this._interval = interval;
    this._timeout = null;

    const classToUse = (tType === 'url') ?
      TamedURLCaller :
      TamedFuncCaller;

    callData.unshift(classToUse);
    this._bindedCreator = Function.prototype.bind.apply(classToUse, callData);

    this._running = false;
    this._inCall = false;
    this.resume();
  }

  setInterval(interval) { this._interval = interval; }
  resume() {
    this._running = true;
    return this._registerCall();
  }
  pause() {
    this._running = false;
    clearTimeout(this._timeout);
  }
  forceRun() {
    this.pause();
    return this.resume();
  }
  updateInterval(newInterval) {
    if (newInterval === this._interval) { return true; }
    //console.log('### $$$ Updated interval of '+ this._name +' to '+ newInterval);
    this.pause();
    this._interval = newInterval;
    return this.resume();
  }

  _kill() {
    this.pause();
    this._callerDom = null;
    this._name = null;
    this._interval = null;
    this._timeout = null;
    this._bindedCreator = null;
  }

  _registerCall() {
    if (!this._running) { return false; } //paused. abort.
    if (this._inCall) { return false; } //already running call. abort.

    this._inCall = true;
    const caller = new this._bindedCreator();
    this._callerDom._registerCall(caller);
    return caller.getPromise().then((returnedData) => {
      this._callerDom._pollResult(this._name, returnedData);
      process.nextTick(this._afterCall.bind(this));
    }).catch((errData) => {
      if (!Array.isArray(errData)) { errData = [errData]; }
      const err = errData.shift();
      this._callerDom._pollError(this._name, err, errData);
      process.nextTick(this._afterCall.bind(this));
    });
  }
  _afterCall() {
    if (!this._running) { return false; } //paused
    this._inCall = false;
    //no interval between calls
    if (!this._interval) { return this._afterInterval(); }

    //wait for the interval before registering next
    this._timeout = setTimeout(
      this._afterInterval.bind(this), this._interval *1000
    );
    return true;
  }
  _afterInterval() {
    // Probably not necessary as the timer will be killed on _kill(), but...
    if (!this._running) { return false; }

    return this._registerCall();
  }
}

module.exports = TamedPoller;
