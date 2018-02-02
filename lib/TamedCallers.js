'use strict';

/* globals Promise */
const request = require('request')
;

let requester;

requester = (process.env.NODE_ENV === 'production') ?
  request.defaults({useQuerystring: true}) :
  require('requestpeeper')
;

class TamedCaller {
  constructor(params = {}) {
    this._params = params;
    this._resolve = null;
    this._reject = null;
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }
  run() { throw 'Not implemented for this class type'; }
  getPromise() { return this._promise; }

  _treatNodeBack(err, ...returnedData) {
    if (err) {
      returnedData.unshift(err);
      return this._reject(returnedData);
    }
    return this._resolve(returnedData);
  }
}


class TamedURLCaller extends TamedCaller {
  constructor(method, tURL, params = {}) {
    params.method = method;
    params.url = tURL;
    super(params);
  }
  run() {
    let f = this._treatNodeBack.bind(this);
    requester(this._params, f, 'TamedURLCaller');
  }
}


class TamedFuncCaller extends TamedCaller {
  constructor(func, params = []) {
    super();
    let useParams = params.slice(0);

    let n = useParams.length, param, found = false;
    for (; n--;) {
      param = useParams[n];
      if (param === 'cb_nodeback') {
        found = true;
        useParams[n] = this._treatNodeBack.bind(this);
        break;
      }
    }
    if (!found) { throw 'Could not find a callback'; }

    this._func = func;
    this._params = useParams;
  }
  run() {
    this._func(...this._params);
    return this._promise;
  }
}

module.exports = {
  'url': TamedURLCaller,
  'func': TamedFuncCaller
};
