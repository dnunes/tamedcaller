'use strict';

const TamedURLCaller = require('./TamedCallers').url
, TamedFuncCaller = require('./TamedCallers').func
;

class TamedPoller {
  constructor(callerDom, name, interval, tType, callData) {
    this._callerDom = callerDom;
    this._name = name;
    this._interval = interval;
    this._timer = null;

    //console.log('Criando poller tipo "'+ tType +'"...');
    let classToUse = (tType === 'url') ?
      TamedURLCaller :
      TamedFuncCaller;

    callData.unshift(classToUse);
    this._bindedCreator = Function.prototype.bind.apply(classToUse, callData);

    this._registerCall();
  }

  _registerCall() {
    let caller = new this._bindedCreator();
    this._callerDom._registerCall(caller);
    return caller.getPromise().then((returnedData) => {
      this._callerDom._pollResult(this._name, returnedData);
      process.nextTick(this._afterCall.bind(this));
    }).catch((errData) => {
      if (!Array.isArray(errData)) { errData = [errData]; }
      let err = errData.shift();
      this._callerDom._pollError(this._name, err, errData);
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
