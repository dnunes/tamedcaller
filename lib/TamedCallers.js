'use strict';

/* globals Promise */
const request = require('requestpeeper')
;

class TamedCaller {
  constructor(params = {}, timeout = false) {
    this._timeout = timeout;
    this._timer = null;
    this._params = params;
    this._resolve = null;
    this._reject = null;
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }
  getPromise() { return this._promise; }
  run() {
    if (this._timeout) {
      this._timer = setTimeout(this._timedout.bind(this), this._timeout);
    }
    return this._run();
  }
  _run() { throw new Error('Not implemented for this class type'); }
  _timedout() {
    let err = new Error('Request timeout');
    err.code = 'ETIMEDOUT';
    return this._reject([err, this._params]);
  }

  _treatNodeBack(err, ...returnedData) {
    clearTimeout(this._timer);
    this._timer = null;

    if (err) {
      returnedData.unshift(err);
      return this._reject(returnedData);
    }
    return this._resolve(returnedData);
  }
}


class TamedURLCaller extends TamedCaller {
  constructor(method, tURL, params = {}, timeout = false) {
    params.method = method;
    params.url = tURL;
    if (!params.timeout && timeout) { params.timeout = timeout; }

    super(params, timeout);
    this._r = null;
  }
  _run() {
    console.log('going to run!');
    let f = this._treatNodeBack.bind(this);
    this._r = request(this._params, f, 'TamedURLCaller');
    return this._promise;
  }
  _timedout() {
    super._timedout();
    this._r.abort();
  }
}


class TamedFuncCaller extends TamedCaller {
  constructor(func, params = [], timeout = false) {
    super({}, timeout);
    let useParams = params.slice(0);

    let param, n = useParams.length, found = false;
    for (; n--;) {
      param = useParams[n];
      if (param === 'cb_nodeback') {
        found = true;
        useParams[n] = this._treatNodeBack.bind(this);
        break;
      }
    }
    if (!found) { throw 'Could not find a callback while evaluating params'; }

    this._func = func;
    this._params = useParams;
  }
  _run() {
    this._func(...this._params);
    return this._promise;
  }
}

module.exports = {
  'url': TamedURLCaller,
  'func': TamedFuncCaller
};
