'use strict';

const TamedURLCaller = require('./TamedCallers').url
, TamedFuncCaller = require('./TamedCallers').func
;

class TamedPoller {
  constructor(fetcher, name, interval, tType, callData) {
    this._fetcher = fetcher;
    this._name = name;
    this._interval = interval;
    this._timer = null;

    let classToUse = (tType === 'url') ?
      TamedURLCaller :
      TamedFuncCaller;

    callData.unshift(classToUse);
    this._bindedCreator = Function.prototype.bind.apply(classToUse, callData);

    this._registerCall();
  }

  _registerCall() {
    let caller = new this._bindedCreator();
    this._fetcher._registerCall(caller);
    return caller.getPromise().then((...results) => {
      this._fetcher._pollResult(this._name, results);
      process.nextTick(this._afterCall.bind(this));
    }).catch((err) => {
      this._fetcher._pollError(this._name, err);
      process.nextTick(this._afterCall.bind(this));
    });
  }
  _afterCall() {
    if (!this._interval) { return this._afterInterval(); }
    setTimeout(this._afterInterval.bind(this), this._interval *1000);
    return true;
  }
  _afterInterval() {
    return this._registerCall();
  }
}

module.exports = TamedPoller;
