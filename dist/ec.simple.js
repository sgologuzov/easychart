/**
 * easychart - Easychart is a graphical user interface, built on top of the stunning Highcharts-javascript library
 * @version v3.0.0
 * @link 
 * @license MIT
 */
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Standalone extraction of Backbone.Events, no external dependency required.
 * Degrades nicely when Backone/underscore are already available in the current
 * global context.
 *
 * Note that docs suggest to use underscore's `_.extend()` method to add Events
 * support to some given object. A `mixin()` method has been added to the Events
 * prototype to avoid using underscore for that sole purpose:
 *
 *     var myEventEmitter = BackboneEvents.mixin({});
 *
 * Or for a function constructor:
 *
 *     function MyConstructor(){}
 *     MyConstructor.prototype.foo = function(){}
 *     BackboneEvents.mixin(MyConstructor.prototype);
 *
 * (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
 * (c) 2013 Nicolas Perriault
 */
/* global exports:true, define, module */
(function() {
  var root = this,
      nativeForEach = Array.prototype.forEach,
      hasOwnProperty = Object.prototype.hasOwnProperty,
      slice = Array.prototype.slice,
      idCounter = 0;

  // Returns a partial implementation matching the minimal API subset required
  // by Backbone.Events
  function miniscore() {
    return {
      keys: Object.keys || function (obj) {
        if (typeof obj !== "object" && typeof obj !== "function" || obj === null) {
          throw new TypeError("keys() called on a non-object");
        }
        var key, keys = [];
        for (key in obj) {
          if (obj.hasOwnProperty(key)) {
            keys[keys.length] = key;
          }
        }
        return keys;
      },

      uniqueId: function(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
      },

      has: function(obj, key) {
        return hasOwnProperty.call(obj, key);
      },

      each: function(obj, iterator, context) {
        if (obj == null) return;
        if (nativeForEach && obj.forEach === nativeForEach) {
          obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
          for (var i = 0, l = obj.length; i < l; i++) {
            iterator.call(context, obj[i], i, obj);
          }
        } else {
          for (var key in obj) {
            if (this.has(obj, key)) {
              iterator.call(context, obj[key], key, obj);
            }
          }
        }
      },

      once: function(func) {
        var ran = false, memo;
        return function() {
          if (ran) return memo;
          ran = true;
          memo = func.apply(this, arguments);
          func = null;
          return memo;
        };
      }
    };
  }

  var _ = miniscore(), Events;

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function(name, callback, context) {
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once: function(name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = _.once(function() {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
      if (!name && !callback && !context) {
        this._events = {};
        return this;
      }

      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if (events = this._events[name]) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                  (context && context !== ev.context)) {
                retain.push(ev);
              }
            }
          }
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening: function(obj, name, callback) {
      var listeners = this._listeners;
      if (!listeners) return this;
      var deleteListener = !name && !callback;
      if (typeof name === 'object') callback = this;
      if (obj) (listeners = {})[obj._listenerId] = obj;
      for (var id in listeners) {
        listeners[id].off(name, callback, this);
        if (deleteListener) delete this._listeners[id];
      }
      return this;
    }

  };

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{change: action}`
  // in terms of the existing API.
  var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, l = names.length; i < l; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
    }
  };

  var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  _.each(listenMethods, function(implementation, method) {
    Events[method] = function(obj, name, callback) {
      var listeners = this._listeners || (this._listeners = {});
      var id = obj._listenerId || (obj._listenerId = _.uniqueId('l'));
      listeners[id] = obj;
      if (typeof name === 'object') callback = this;
      obj[implementation](name, callback, this);
      return this;
    };
  });

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Mixin utility
  Events.mixin = function(proto) {
    var exports = ['on', 'once', 'off', 'trigger', 'stopListening', 'listenTo',
                   'listenToOnce', 'bind', 'unbind'];
    _.each(exports, function(name) {
      proto[name] = this[name];
    }, this);
    return proto;
  };

  // Export Events as BackboneEvents depending on current context
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Events;
    }
    exports.BackboneEvents = Events;
  }else if (typeof define === "function"  && typeof define.amd == "object") {
    define(function() {
      return Events;
    });
  } else {
    root.BackboneEvents = Events;
  }
})(this);

},{}],2:[function(require,module,exports){
module.exports = require('./backbone-events-standalone');

},{"./backbone-events-standalone":1}],3:[function(require,module,exports){

},{}],4:[function(require,module,exports){
/*!
 * Cross-Browser Split 1.1.1
 * Copyright 2007-2012 Steven Levithan <stevenlevithan.com>
 * Available under the MIT License
 * ECMAScript compliant, uniform cross-browser split method
 */

/**
 * Splits a string into an array of strings using a regex or string separator. Matches of the
 * separator are not included in the result array. However, if `separator` is a regex that contains
 * capturing groups, backreferences are spliced into the result each time `separator` is matched.
 * Fixes browser bugs compared to the native `String.prototype.split` and can be used reliably
 * cross-browser.
 * @param {String} str String to split.
 * @param {RegExp|String} separator Regex or string to use for separating the string.
 * @param {Number} [limit] Maximum number of items to include in the result array.
 * @returns {Array} Array of substrings.
 * @example
 *
 * // Basic use
 * split('a b c d', ' ');
 * // -> ['a', 'b', 'c', 'd']
 *
 * // With limit
 * split('a b c d', ' ', 2);
 * // -> ['a', 'b']
 *
 * // Backreferences in result array
 * split('..word1 word2..', /([a-z]+)(\d+)/i);
 * // -> ['..', 'word', '1', ' ', 'word', '2', '..']
 */
module.exports = (function split(undef) {

  var nativeSplit = String.prototype.split,
    compliantExecNpcg = /()??/.exec("")[1] === undef,
    // NPCG: nonparticipating capturing group
    self;

  self = function(str, separator, limit) {
    // If `separator` is not a regex, use `nativeSplit`
    if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
      return nativeSplit.call(str, separator, limit);
    }
    var output = [],
      flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "") + (separator.extended ? "x" : "") + // Proposed for ES6
      (separator.sticky ? "y" : ""),
      // Firefox 3+
      lastLastIndex = 0,
      // Make `global` and avoid `lastIndex` issues by working with a copy
      separator = new RegExp(separator.source, flags + "g"),
      separator2, match, lastIndex, lastLength;
    str += ""; // Type-convert
    if (!compliantExecNpcg) {
      // Doesn't need flags gy, but they don't hurt
      separator2 = new RegExp("^" + separator.source + "$(?!\\s)", flags);
    }
    /* Values for `limit`, per the spec:
     * If undefined: 4294967295 // Math.pow(2, 32) - 1
     * If 0, Infinity, or NaN: 0
     * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
     * If negative number: 4294967296 - Math.floor(Math.abs(limit))
     * If other: Type-convert, then use the above rules
     */
    limit = limit === undef ? -1 >>> 0 : // Math.pow(2, 32) - 1
    limit >>> 0; // ToUint32(limit)
    while (match = separator.exec(str)) {
      // `separator.lastIndex` is not reliable cross-browser
      lastIndex = match.index + match[0].length;
      if (lastIndex > lastLastIndex) {
        output.push(str.slice(lastLastIndex, match.index));
        // Fix browsers whose `exec` methods don't consistently return `undefined` for
        // nonparticipating capturing groups
        if (!compliantExecNpcg && match.length > 1) {
          match[0].replace(separator2, function() {
            for (var i = 1; i < arguments.length - 2; i++) {
              if (arguments[i] === undef) {
                match[i] = undef;
              }
            }
          });
        }
        if (match.length > 1 && match.index < str.length) {
          Array.prototype.push.apply(output, match.slice(1));
        }
        lastLength = match[0].length;
        lastLastIndex = lastIndex;
        if (output.length >= limit) {
          break;
        }
      }
      if (separator.lastIndex === match.index) {
        separator.lastIndex++; // Avoid an infinite loop
      }
    }
    if (lastLastIndex === str.length) {
      if (lastLength || !separator.test("")) {
        output.push("");
      }
    } else {
      output.push(str.slice(lastLastIndex));
    }
    return output.length > limit ? output.slice(0, limit) : output;
  };

  return self;
})();

},{}],5:[function(require,module,exports){
'use strict';
// For more information about browser field, check out the browser field at https://github.com/substack/browserify-handbook#browser-field.

module.exports = {
    // Create a <link> tag with optional data attributes
    createLink: function(href, attributes) {
        var head = document.head || document.getElementsByTagName('head')[0];
        var link = document.createElement('link');

        link.href = href;
        link.rel = 'stylesheet';

        for (var key in attributes) {
            if ( ! attributes.hasOwnProperty(key)) {
                continue;
            }
            var value = attributes[key];
            link.setAttribute('data-' + key, value);
        }

        head.appendChild(link);
    },
    // Create a <style> tag with optional data attributes
    createStyle: function(cssText, attributes) {
        var head = document.head || document.getElementsByTagName('head')[0],
            style = document.createElement('style');

        style.type = 'text/css';

        for (var key in attributes) {
            if ( ! attributes.hasOwnProperty(key)) {
                continue;
            }
            var value = attributes[key];
            style.setAttribute('data-' + key, value);
        }
        
        if (style.sheet) { // for jsdom and IE9+
            style.innerHTML = cssText;
            style.sheet.cssText = cssText;
            head.appendChild(style);
        } else if (style.styleSheet) { // for IE8 and below
            head.appendChild(style);
            style.styleSheet.cssText = cssText;
        } else { // for Chrome, Firefox, and Safari
            style.appendChild(document.createTextNode(cssText));
            head.appendChild(style);
        }
    }
};

},{}],6:[function(require,module,exports){
arguments[4][3][0].apply(exports,arguments)
},{"dup":3}],7:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],8:[function(require,module,exports){
module.exports = function(obj) {
    if (typeof obj === 'string') return camelCase(obj);
    return walk(obj);
};

function walk (obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (isDate(obj) || isRegex(obj)) return obj;
    if (isArray(obj)) return map(obj, walk);
    return reduce(objectKeys(obj), function (acc, key) {
        var camel = camelCase(key);
        acc[camel] = walk(obj[key]);
        return acc;
    }, {});
}

function camelCase(str) {
    return str.replace(/[_.-](\w|$)/g, function (_,x) {
        return x.toUpperCase();
    });
}

var isArray = Array.isArray || function (obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
};

var isDate = function (obj) {
    return Object.prototype.toString.call(obj) === '[object Date]';
};

var isRegex = function (obj) {
    return Object.prototype.toString.call(obj) === '[object RegExp]';
};

var has = Object.prototype.hasOwnProperty;
var objectKeys = Object.keys || function (obj) {
    var keys = [];
    for (var key in obj) {
        if (has.call(obj, key)) keys.push(key);
    }
    return keys;
};

function map (xs, f) {
    if (xs.map) return xs.map(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        res.push(f(xs[i], i));
    }
    return res;
}

function reduce (xs, f, acc) {
    if (xs.reduce) return xs.reduce(f, acc);
    for (var i = 0; i < xs.length; i++) {
        acc = f(acc, xs[i], i);
    }
    return acc;
}

},{}],9:[function(require,module,exports){
/**
 * cuid.js
 * Collision-resistant UID generator for browsers and node.
 * Sequential for fast db lookups and recency sorting.
 * Safe for element IDs and server-side lookups.
 *
 * Extracted from CLCTR
 *
 * Copyright (c) Eric Elliott 2012
 * MIT License
 */

/*global window, navigator, document, require, process, module */
(function (app) {
  'use strict';
  var namespace = 'cuid',
    c = 0,
    blockSize = 4,
    base = 36,
    discreteValues = Math.pow(base, blockSize),

    pad = function pad(num, size) {
      var s = "000000000" + num;
      return s.substr(s.length-size);
    },

    randomBlock = function randomBlock() {
      return pad((Math.random() *
            discreteValues << 0)
            .toString(base), blockSize);
    },

    safeCounter = function () {
      c = (c < discreteValues) ? c : 0;
      c++; // this is not subliminal
      return c - 1;
    },

    api = function cuid() {
      // Starting with a lowercase letter makes
      // it HTML element ID friendly.
      var letter = 'c', // hard-coded allows for sequential access

        // timestamp
        // warning: this exposes the exact date and time
        // that the uid was created.
        timestamp = (new Date().getTime()).toString(base),

        // Prevent same-machine collisions.
        counter,

        // A few chars to generate distinct ids for different
        // clients (so different computers are far less
        // likely to generate the same id)
        fingerprint = api.fingerprint(),

        // Grab some more chars from Math.random()
        random = randomBlock() + randomBlock();

        counter = pad(safeCounter().toString(base), blockSize);

      return  (letter + timestamp + counter + fingerprint + random);
    };

  api.slug = function slug() {
    var date = new Date().getTime().toString(36),
      counter,
      print = api.fingerprint().slice(0,1) +
        api.fingerprint().slice(-1),
      random = randomBlock().slice(-2);

      counter = safeCounter().toString(36).slice(-4);

    return date.slice(-2) +
      counter + print + random;
  };

  api.globalCount = function globalCount() {
    // We want to cache the results of this
    var cache = (function calc() {
        var i,
          count = 0;

        for (i in window) {
          count++;
        }

        return count;
      }());

    api.globalCount = function () { return cache; };
    return cache;
  };

  api.fingerprint = function browserPrint() {
    return pad((navigator.mimeTypes.length +
      navigator.userAgent.length).toString(36) +
      api.globalCount().toString(36), 4);
  };

  // don't change anything from here down.
  if (app.register) {
    app.register(namespace, api);
  } else if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    app[namespace] = api;
  }

}(this.applitude || this));

},{}],10:[function(require,module,exports){
var EvStore = require("ev-store")

module.exports = addEvent

function addEvent(target, type, handler) {
    var events = EvStore(target)
    var event = events[type]

    if (!event) {
        events[type] = handler
    } else if (Array.isArray(event)) {
        if (event.indexOf(handler) === -1) {
            event.push(handler)
        }
    } else if (event !== handler) {
        events[type] = [event, handler]
    }
}

},{"ev-store":17}],11:[function(require,module,exports){
var globalDocument = require("global/document")
var EvStore = require("ev-store")
var createStore = require("weakmap-shim/create-store")

var addEvent = require("./add-event.js")
var removeEvent = require("./remove-event.js")
var ProxyEvent = require("./proxy-event.js")

var HANDLER_STORE = createStore()

module.exports = DOMDelegator

function DOMDelegator(document) {
    if (!(this instanceof DOMDelegator)) {
        return new DOMDelegator(document);
    }

    document = document || globalDocument

    this.target = document.documentElement
    this.events = {}
    this.rawEventListeners = {}
    this.globalListeners = {}
}

DOMDelegator.prototype.addEventListener = addEvent
DOMDelegator.prototype.removeEventListener = removeEvent

DOMDelegator.allocateHandle =
    function allocateHandle(func) {
        var handle = new Handle()

        HANDLER_STORE(handle).func = func;

        return handle
    }

DOMDelegator.transformHandle =
    function transformHandle(handle, broadcast) {
        var func = HANDLER_STORE(handle).func

        return this.allocateHandle(function (ev) {
            broadcast(ev, func);
        })
    }

DOMDelegator.prototype.addGlobalEventListener =
    function addGlobalEventListener(eventName, fn) {
        var listeners = this.globalListeners[eventName] || [];
        if (listeners.indexOf(fn) === -1) {
            listeners.push(fn)
        }

        this.globalListeners[eventName] = listeners;
    }

DOMDelegator.prototype.removeGlobalEventListener =
    function removeGlobalEventListener(eventName, fn) {
        var listeners = this.globalListeners[eventName] || [];

        var index = listeners.indexOf(fn)
        if (index !== -1) {
            listeners.splice(index, 1)
        }
    }

DOMDelegator.prototype.listenTo = function listenTo(eventName) {
    if (!(eventName in this.events)) {
        this.events[eventName] = 0;
    }

    this.events[eventName]++;

    if (this.events[eventName] !== 1) {
        return
    }

    var listener = this.rawEventListeners[eventName]
    if (!listener) {
        listener = this.rawEventListeners[eventName] =
            createHandler(eventName, this)
    }

    this.target.addEventListener(eventName, listener, true)
}

DOMDelegator.prototype.unlistenTo = function unlistenTo(eventName) {
    if (!(eventName in this.events)) {
        this.events[eventName] = 0;
    }

    if (this.events[eventName] === 0) {
        throw new Error("already unlistened to event.");
    }

    this.events[eventName]--;

    if (this.events[eventName] !== 0) {
        return
    }

    var listener = this.rawEventListeners[eventName]

    if (!listener) {
        throw new Error("dom-delegator#unlistenTo: cannot " +
            "unlisten to " + eventName)
    }

    this.target.removeEventListener(eventName, listener, true)
}

function createHandler(eventName, delegator) {
    var globalListeners = delegator.globalListeners;
    var delegatorTarget = delegator.target;

    return handler

    function handler(ev) {
        var globalHandlers = globalListeners[eventName] || []

        if (globalHandlers.length > 0) {
            var globalEvent = new ProxyEvent(ev);
            globalEvent.currentTarget = delegatorTarget;
            callListeners(globalHandlers, globalEvent)
        }

        findAndInvokeListeners(ev.target, ev, eventName)
    }
}

function findAndInvokeListeners(elem, ev, eventName) {
    var listener = getListener(elem, eventName)

    if (listener && listener.handlers.length > 0) {
        var listenerEvent = new ProxyEvent(ev);
        listenerEvent.currentTarget = listener.currentTarget
        callListeners(listener.handlers, listenerEvent)

        if (listenerEvent._bubbles) {
            var nextTarget = listener.currentTarget.parentNode
            findAndInvokeListeners(nextTarget, ev, eventName)
        }
    }
}

function getListener(target, type) {
    // terminate recursion if parent is `null`
    if (target === null || typeof target === "undefined") {
        return null
    }

    var events = EvStore(target)
    // fetch list of handler fns for this event
    var handler = events[type]
    var allHandler = events.event

    if (!handler && !allHandler) {
        return getListener(target.parentNode, type)
    }

    var handlers = [].concat(handler || [], allHandler || [])
    return new Listener(target, handlers)
}

function callListeners(handlers, ev) {
    handlers.forEach(function (handler) {
        if (typeof handler === "function") {
            handler(ev)
        } else if (typeof handler.handleEvent === "function") {
            handler.handleEvent(ev)
        } else if (handler.type === "dom-delegator-handle") {
            HANDLER_STORE(handler).func(ev)
        } else {
            throw new Error("dom-delegator: unknown handler " +
                "found: " + JSON.stringify(handlers));
        }
    })
}

function Listener(target, handlers) {
    this.currentTarget = target
    this.handlers = handlers
}

function Handle() {
    this.type = "dom-delegator-handle"
}

},{"./add-event.js":10,"./proxy-event.js":13,"./remove-event.js":14,"ev-store":17,"global/document":22,"weakmap-shim/create-store":105}],12:[function(require,module,exports){
var Individual = require("individual")
var cuid = require("cuid")
var globalDocument = require("global/document")

var DOMDelegator = require("./dom-delegator.js")

var versionKey = "13"
var cacheKey = "__DOM_DELEGATOR_CACHE@" + versionKey
var cacheTokenKey = "__DOM_DELEGATOR_CACHE_TOKEN@" + versionKey
var delegatorCache = Individual(cacheKey, {
    delegators: {}
})
var commonEvents = [
    "blur", "change", "click",  "contextmenu", "dblclick",
    "error","focus", "focusin", "focusout", "input", "keydown",
    "keypress", "keyup", "load", "mousedown", "mouseup",
    "resize", "select", "submit", "touchcancel",
    "touchend", "touchstart", "unload"
]

/*  Delegator is a thin wrapper around a singleton `DOMDelegator`
        instance.

    Only one DOMDelegator should exist because we do not want
        duplicate event listeners bound to the DOM.

    `Delegator` will also `listenTo()` all events unless
        every caller opts out of it
*/
module.exports = Delegator

function Delegator(opts) {
    opts = opts || {}
    var document = opts.document || globalDocument

    var cacheKey = document[cacheTokenKey]

    if (!cacheKey) {
        cacheKey =
            document[cacheTokenKey] = cuid()
    }

    var delegator = delegatorCache.delegators[cacheKey]

    if (!delegator) {
        delegator = delegatorCache.delegators[cacheKey] =
            new DOMDelegator(document)
    }

    if (opts.defaultEvents !== false) {
        for (var i = 0; i < commonEvents.length; i++) {
            delegator.listenTo(commonEvents[i])
        }
    }

    return delegator
}

Delegator.allocateHandle = DOMDelegator.allocateHandle;
Delegator.transformHandle = DOMDelegator.transformHandle;

},{"./dom-delegator.js":11,"cuid":9,"global/document":22,"individual":24}],13:[function(require,module,exports){
var inherits = require("inherits")

var ALL_PROPS = [
    "altKey", "bubbles", "cancelable", "ctrlKey",
    "eventPhase", "metaKey", "relatedTarget", "shiftKey",
    "target", "timeStamp", "type", "view", "which"
]
var KEY_PROPS = ["char", "charCode", "key", "keyCode"]
var MOUSE_PROPS = [
    "button", "buttons", "clientX", "clientY", "layerX",
    "layerY", "offsetX", "offsetY", "pageX", "pageY",
    "screenX", "screenY", "toElement"
]

var rkeyEvent = /^key|input/
var rmouseEvent = /^(?:mouse|pointer|contextmenu)|click/

module.exports = ProxyEvent

function ProxyEvent(ev) {
    if (!(this instanceof ProxyEvent)) {
        return new ProxyEvent(ev)
    }

    if (rkeyEvent.test(ev.type)) {
        return new KeyEvent(ev)
    } else if (rmouseEvent.test(ev.type)) {
        return new MouseEvent(ev)
    }

    for (var i = 0; i < ALL_PROPS.length; i++) {
        var propKey = ALL_PROPS[i]
        this[propKey] = ev[propKey]
    }

    this._rawEvent = ev
    this._bubbles = false;
}

ProxyEvent.prototype.preventDefault = function () {
    this._rawEvent.preventDefault()
}

ProxyEvent.prototype.startPropagation = function () {
    this._bubbles = true;
}

function MouseEvent(ev) {
    for (var i = 0; i < ALL_PROPS.length; i++) {
        var propKey = ALL_PROPS[i]
        this[propKey] = ev[propKey]
    }

    for (var j = 0; j < MOUSE_PROPS.length; j++) {
        var mousePropKey = MOUSE_PROPS[j]
        this[mousePropKey] = ev[mousePropKey]
    }

    this._rawEvent = ev
}

inherits(MouseEvent, ProxyEvent)

function KeyEvent(ev) {
    for (var i = 0; i < ALL_PROPS.length; i++) {
        var propKey = ALL_PROPS[i]
        this[propKey] = ev[propKey]
    }

    for (var j = 0; j < KEY_PROPS.length; j++) {
        var keyPropKey = KEY_PROPS[j]
        this[keyPropKey] = ev[keyPropKey]
    }

    this._rawEvent = ev
}

inherits(KeyEvent, ProxyEvent)

},{"inherits":25}],14:[function(require,module,exports){
var EvStore = require("ev-store")

module.exports = removeEvent

function removeEvent(target, type, handler) {
    var events = EvStore(target)
    var event = events[type]

    if (!event) {
        return
    } else if (Array.isArray(event)) {
        var index = event.indexOf(handler)
        if (index !== -1) {
            event.splice(index, 1)
        }
    } else if (event === handler) {
        events[type] = null
    }
}

},{"ev-store":17}],15:[function(require,module,exports){
module.exports = dragDrop

var flatten = require('flatten')
var parallel = require('run-parallel')

function dragDrop (elem, listeners) {
  if (typeof elem === 'string') elem = window.document.querySelector(elem)
  if (typeof listeners === 'function') listeners = { onDrop: listeners }

  var onDragOver = makeOnDragOver(elem, listeners.onDragOver)
  var onDragLeave = makeOnDragLeave(elem, listeners.onDragLeave)
  var onDrop = makeOnDrop(elem, listeners.onDrop, listeners.onDragLeave)

  elem.addEventListener('dragenter', stopEvent, false)
  elem.addEventListener('dragover', onDragOver, false)
  elem.addEventListener('dragleave', onDragLeave, false)
  elem.addEventListener('drop', onDrop, false)

  // Function to remove drag-drop listeners
  return function remove () {
    if (elem instanceof window.Element) elem.classList.remove('drag')
    elem.removeEventListener('dragenter', stopEvent, false)
    elem.removeEventListener('dragover', onDragOver, false)
    elem.removeEventListener('dragleave', onDragLeave, false)
    elem.removeEventListener('drop', onDrop, false)
  }
}

function stopEvent (e) {
  e.stopPropagation()
  e.preventDefault()
  return false
}

function makeOnDragOver (elem, ondragover) {
  return function (e) {
    e.stopPropagation()
    e.preventDefault()
    if (e.dataTransfer.items) {
      // Only add "drag" class when `items` contains a file
      var items = toArray(e.dataTransfer.items).filter(function (item) {
        return item.kind === 'file'
      })
      if (items.length === 0) return
    }

    if (elem instanceof window.Element) elem.classList.add('drag')
    e.dataTransfer.dropEffect = 'copy'
    if (ondragover) ondragover(e)
    return false
  }
}

function makeOnDragLeave (elem, ondragleave) {
  return function (e) {
    if (e.target !== elem) return
    e.stopPropagation()
    e.preventDefault()
    if (ondragleave) ondragleave(e)
    if (elem instanceof window.Element) elem.classList.remove('drag')
    return false
  }
}

function makeOnDrop (elem, ondrop, ondragleave) {
  return function (e) {
    e.stopPropagation()
    e.preventDefault()
    if (ondragleave) ondragleave(e)
    if (elem instanceof window.Element) elem.classList.remove('drag')
    var pos = { x: e.clientX, y: e.clientY }
    if (e.dataTransfer.items) {
      // Handle directories in Chrome using the proprietary FileSystem API
      var items = toArray(e.dataTransfer.items).filter(function (item) {
        return item.kind === 'file'
      })
      if (items.length === 0) return
      parallel(items.map(function (item) {
        return function (cb) {
          processEntry(item.webkitGetAsEntry(), cb)
        }
      }), function (err, results) {
        // There should never be an error in production code. This catches permission
        // errors with file:// in Chrome.
        if (err) throw err
        ondrop(flatten(results), pos)
      })
    } else {
      var files = toArray(e.dataTransfer.files)
      if (files.length === 0) return
      files.forEach(function (file) {
        file.fullPath = '/' + file.name
      })
      ondrop(files, pos)
    }

    return false
  }
}

function processEntry (entry, cb) {
  var entries = []

  if (entry.isFile) {
    entry.file(function (file) {
      file.fullPath = entry.fullPath  // preserve pathing for consumer
      cb(null, file)
    }, function (err) {
      cb(err)
    })
  } else if (entry.isDirectory) {
    var reader = entry.createReader()
    readEntries()
  }

  function readEntries () {
    reader.readEntries(function (entries_) {
      if (entries_.length > 0) {
        entries = entries.concat(toArray(entries_))
        readEntries() // continue reading entries until `readEntries` returns no more
      } else {
        doneEntries()
      }
    })
  }

  function doneEntries () {
    parallel(entries.map(function (entry) {
      return function (cb) {
        processEntry(entry, cb)
      }
    }), cb)
  }
}

function toArray (list) {
  return Array.prototype.slice.call(list || [], 0)
}

},{"flatten":20,"run-parallel":74}],16:[function(require,module,exports){
var camelize = require("camelize")
var template = require("string-template")
var extend = require("xtend/mutable")

module.exports = TypedError

function TypedError(args) {
    if (!args) {
        throw new Error("args is required");
    }
    if (!args.type) {
        throw new Error("args.type is required");
    }
    if (!args.message) {
        throw new Error("args.message is required");
    }

    var message = args.message

    if (args.type && !args.name) {
        var errorName = camelize(args.type) + "Error"
        args.name = errorName[0].toUpperCase() + errorName.substr(1)
    }

    extend(createError, args);
    createError._name = args.name;

    return createError;

    function createError(opts) {
        var result = new Error()

        Object.defineProperty(result, "type", {
            value: result.type,
            enumerable: true,
            writable: true,
            configurable: true
        })

        var options = extend({}, args, opts)

        extend(result, options)
        result.message = template(message, options)

        return result
    }
}


},{"camelize":8,"string-template":75,"xtend/mutable":111}],17:[function(require,module,exports){
'use strict';

var OneVersionConstraint = require('individual/one-version');

var MY_VERSION = '7';
OneVersionConstraint('ev-store', MY_VERSION);

var hashKey = '__EV_STORE_KEY@' + MY_VERSION;

module.exports = EvStore;

function EvStore(elem) {
    var hash = elem[hashKey];

    if (!hash) {
        hash = elem[hashKey] = {};
    }

    return hash;
}

},{"individual/one-version":19}],18:[function(require,module,exports){
(function (global){
'use strict';

/*global window, global*/

var root = typeof window !== 'undefined' ?
    window : typeof global !== 'undefined' ?
    global : {};

module.exports = Individual;

function Individual(key, value) {
    if (key in root) {
        return root[key];
    }

    root[key] = value;

    return value;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],19:[function(require,module,exports){
'use strict';

var Individual = require('./index.js');

module.exports = OneVersion;

function OneVersion(moduleName, version, defaultValue) {
    var key = '__INDIVIDUAL_ONE_VERSION_' + moduleName;
    var enforceKey = key + '_ENFORCE_SINGLETON';

    var versionValue = Individual(enforceKey, version);

    if (versionValue !== version) {
        throw new Error('Can only have one copy of ' +
            moduleName + '.\n' +
            'You already have version ' + versionValue +
            ' installed.\n' +
            'This means you cannot install version ' + version);
    }

    return Individual(key, defaultValue);
}

},{"./index.js":18}],20:[function(require,module,exports){
module.exports = function flatten(list, depth) {
  depth = (typeof depth == 'number') ? depth : Infinity;

  if (!depth) {
    if (Array.isArray(list)) {
      return list.map(function(i) { return i; });
    }
    return list;
  }

  return _flatten(list, 1);

  function _flatten(list, d) {
    return list.reduce(function (acc, item) {
      if (Array.isArray(item) && d < depth) {
        return acc.concat(_flatten(item, d + 1));
      }
      else {
        return acc.concat(item);
      }
    }, []);
  }
};

},{}],21:[function(require,module,exports){
var isFunction = require('is-function')

module.exports = forEach

var toString = Object.prototype.toString
var hasOwnProperty = Object.prototype.hasOwnProperty

function forEach(list, iterator, context) {
    if (!isFunction(iterator)) {
        throw new TypeError('iterator must be a function')
    }

    if (arguments.length < 3) {
        context = this
    }
    
    if (toString.call(list) === '[object Array]')
        forEachArray(list, iterator, context)
    else if (typeof list === 'string')
        forEachString(list, iterator, context)
    else
        forEachObject(list, iterator, context)
}

function forEachArray(array, iterator, context) {
    for (var i = 0, len = array.length; i < len; i++) {
        if (hasOwnProperty.call(array, i)) {
            iterator.call(context, array[i], i, array)
        }
    }
}

function forEachString(string, iterator, context) {
    for (var i = 0, len = string.length; i < len; i++) {
        // no such thing as a sparse string.
        iterator.call(context, string.charAt(i), i, string)
    }
}

function forEachObject(object, iterator, context) {
    for (var k in object) {
        if (hasOwnProperty.call(object, k)) {
            iterator.call(context, object[k], k, object)
        }
    }
}

},{"is-function":26}],22:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"min-document":3}],23:[function(require,module,exports){
(function (global){
if (typeof window !== "undefined") {
    module.exports = window;
} else if (typeof global !== "undefined") {
    module.exports = global;
} else if (typeof self !== "undefined"){
    module.exports = self;
} else {
    module.exports = {};
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],24:[function(require,module,exports){
(function (global){
var root = typeof window !== 'undefined' ?
    window : typeof global !== 'undefined' ?
    global : {};

module.exports = Individual

function Individual(key, value) {
    if (root[key]) {
        return root[key]
    }

    Object.defineProperty(root, key, {
        value: value
        , configurable: true
    })

    return value
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],25:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],26:[function(require,module,exports){
module.exports = isFunction

var toString = Object.prototype.toString

function isFunction (fn) {
  var string = toString.call(fn)
  return string === '[object Function]' ||
    (typeof fn === 'function' && string !== '[object RegExp]') ||
    (typeof window !== 'undefined' &&
     // IE8 and below
     (fn === window.setTimeout ||
      fn === window.alert ||
      fn === window.confirm ||
      fn === window.prompt))
};

},{}],27:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],28:[function(require,module,exports){
(function (global){
/**
 * lodash 4.5.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to match `RegExp` [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns). */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to match `RegExp` flags from their coerced string values. */
var reFlags = /\w*$/;

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Used to identify `toStringTag` values supported by `_.clone`. */
var cloneableTags = {};
cloneableTags[argsTag] = cloneableTags[arrayTag] =
cloneableTags[arrayBufferTag] = cloneableTags[boolTag] =
cloneableTags[dateTag] = cloneableTags[float32Tag] =
cloneableTags[float64Tag] = cloneableTags[int8Tag] =
cloneableTags[int16Tag] = cloneableTags[int32Tag] =
cloneableTags[mapTag] = cloneableTags[numberTag] =
cloneableTags[objectTag] = cloneableTags[regexpTag] =
cloneableTags[setTag] = cloneableTags[stringTag] =
cloneableTags[symbolTag] = cloneableTags[uint8Tag] =
cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] =
cloneableTags[uint32Tag] = true;
cloneableTags[errorTag] = cloneableTags[funcTag] =
cloneableTags[weakMapTag] = false;

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = (freeModule && freeModule.exports === freeExports)
  ? freeExports
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Adds the key-value `pair` to `map`.
 *
 * @private
 * @param {Object} map The map to modify.
 * @param {Array} pair The key-value pair to add.
 * @returns {Object} Returns `map`.
 */
function addMapEntry(map, pair) {
  map.set(pair[0], pair[1]);
  return map;
}

/**
 * Adds `value` to `set`.
 *
 * @private
 * @param {Object} set The set to modify.
 * @param {*} value The value to add.
 * @returns {Object} Returns `set`.
 */
function addSetEntry(set, value) {
  set.add(value);
  return set;
}

/**
 * A specialized version of `_.forEach` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns `array`.
 */
function arrayEach(array, iteratee) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}

/**
 * A specialized version of `_.reduce` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {*} [accumulator] The initial value.
 * @param {boolean} [initAccum] Specify using the first element of `array` as the initial value.
 * @returns {*} Returns the accumulated value.
 */
function arrayReduce(array, iteratee, accumulator, initAccum) {
  var index = -1,
      length = array.length;

  if (initAccum && length) {
    accumulator = array[++index];
  }
  while (++index < length) {
    accumulator = iteratee(accumulator, array[index], index, array);
  }
  return accumulator;
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Converts `map` to an array.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the converted array.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/**
 * Converts `set` to an array.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the converted array.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined,
    Symbol = root.Symbol,
    Uint8Array = root.Uint8Array,
    getPrototypeOf = Object.getPrototypeOf,
    getOwnPropertySymbols = Object.getOwnPropertySymbols,
    objectCreate = Object.create,
    propertyIsEnumerable = objectProto.propertyIsEnumerable,
    splice = arrayProto.splice;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = Object.keys;

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map'),
    Set = getNative(root, 'Set'),
    WeakMap = getNative(root, 'WeakMap'),
    nativeCreate = getNative(Object, 'create');

/** Used to detect maps, sets, and weakmaps. */
var mapCtorString = Map ? funcToString.call(Map) : '',
    setCtorString = Set ? funcToString.call(Set) : '',
    weakMapCtorString = WeakMap ? funcToString.call(WeakMap) : '';

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = Symbol ? symbolProto.valueOf : undefined;

/**
 * Creates an hash object.
 *
 * @private
 * @constructor
 * @returns {Object} Returns the new hash object.
 */
function Hash() {}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(hash, key) {
  return hashHas(hash, key) && delete hash[key];
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(hash, key) {
  if (nativeCreate) {
    var result = hash[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(hash, key) ? hash[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(hash, key) {
  return nativeCreate ? hash[key] !== undefined : hasOwnProperty.call(hash, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function hashSet(hash, key, value) {
  hash[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
}

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function MapCache(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapClear() {
  this.__data__ = {
    'hash': new Hash,
    'map': Map ? new Map : [],
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapDelete(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashDelete(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map['delete'](key) : assocDelete(data.map, key);
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapGet(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashGet(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.get(key) : assocGet(data.map, key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapHas(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashHas(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.has(key) : assocHas(data.map, key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache object.
 */
function mapSet(key, value) {
  var data = this.__data__;
  if (isKeyable(key)) {
    hashSet(typeof key == 'string' ? data.string : data.hash, key, value);
  } else if (Map) {
    data.map.set(key, value);
  } else {
    assocSet(data.map, key, value);
  }
  return this;
}

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function Stack(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = { 'array': [], 'map': null };
}

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocDelete(array, key) : data.map['delete'](key);
}

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocGet(array, key) : data.map.get(key);
}

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocHas(array, key) : data.map.has(key);
}

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache object.
 */
function stackSet(key, value) {
  var data = this.__data__,
      array = data.array;

  if (array) {
    if (array.length < (LARGE_ARRAY_SIZE - 1)) {
      assocSet(array, key, value);
    } else {
      data.array = null;
      data.map = new MapCache(array);
    }
  }
  var map = data.map;
  if (map) {
    map.set(key, value);
  }
  return this;
}

/**
 * Removes `key` and its value from the associative array.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function assocDelete(array, key) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    return false;
  }
  var lastIndex = array.length - 1;
  if (index == lastIndex) {
    array.pop();
  } else {
    splice.call(array, index, 1);
  }
  return true;
}

/**
 * Gets the associative array value for `key`.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function assocGet(array, key) {
  var index = assocIndexOf(array, key);
  return index < 0 ? undefined : array[index][1];
}

/**
 * Checks if an associative array value for `key` exists.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function assocHas(array, key) {
  return assocIndexOf(array, key) > -1;
}

/**
 * Gets the index at which the first occurrence of `key` is found in `array`
 * of key-value pairs.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * Sets the associative array `key` to `value`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function assocSet(array, key, value) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    array.push([key, value]);
  } else {
    array[index][1] = value;
  }
}

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if ((!eq(objValue, value) ||
        (eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key))) ||
      (value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * The base implementation of `_.assign` without support for multiple sources
 * or `customizer` functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @returns {Object} Returns `object`.
 */
function baseAssign(object, source) {
  return object && copyObject(source, keys(source), object);
}

/**
 * The base implementation of `_.clone` and `_.cloneDeep` which tracks
 * traversed objects.
 *
 * @private
 * @param {*} value The value to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @param {Function} [customizer] The function to customize cloning.
 * @param {string} [key] The key of `value`.
 * @param {Object} [object] The parent object of `value`.
 * @param {Object} [stack] Tracks traversed objects and their clone counterparts.
 * @returns {*} Returns the cloned value.
 */
function baseClone(value, isDeep, customizer, key, object, stack) {
  var result;
  if (customizer) {
    result = object ? customizer(value, key, object, stack) : customizer(value);
  }
  if (result !== undefined) {
    return result;
  }
  if (!isObject(value)) {
    return value;
  }
  var isArr = isArray(value);
  if (isArr) {
    result = initCloneArray(value);
    if (!isDeep) {
      return copyArray(value, result);
    }
  } else {
    var tag = getTag(value),
        isFunc = tag == funcTag || tag == genTag;

    if (isBuffer(value)) {
      return cloneBuffer(value, isDeep);
    }
    if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
      if (isHostObject(value)) {
        return object ? value : {};
      }
      result = initCloneObject(isFunc ? {} : value);
      if (!isDeep) {
        return copySymbols(value, baseAssign(result, value));
      }
    } else {
      if (!cloneableTags[tag]) {
        return object ? value : {};
      }
      result = initCloneByTag(value, tag, isDeep);
    }
  }
  // Check for circular references and return its corresponding clone.
  stack || (stack = new Stack);
  var stacked = stack.get(value);
  if (stacked) {
    return stacked;
  }
  stack.set(value, result);

  // Recursively populate clone (susceptible to call stack limits).
  (isArr ? arrayEach : baseForOwn)(value, function(subValue, key) {
    assignValue(result, key, baseClone(subValue, isDeep, customizer, key, value, stack));
  });
  return isArr ? result : copySymbols(value, result);
}

/**
 * The base implementation of `_.create` without support for assigning
 * properties to the created object.
 *
 * @private
 * @param {Object} prototype The object to inherit from.
 * @returns {Object} Returns the new object.
 */
function baseCreate(proto) {
  return isObject(proto) ? objectCreate(proto) : {};
}

/**
 * The base implementation of `baseForIn` and `baseForOwn` which iterates
 * over `object` properties returned by `keysFunc` invoking `iteratee` for
 * each property. Iteratee functions may exit iteration early by explicitly
 * returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = createBaseFor();

/**
 * The base implementation of `_.forOwn` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForOwn(object, iteratee) {
  return object && baseFor(object, iteratee, keys);
}

/**
 * The base implementation of `_.has` without support for deep paths.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHas(object, key) {
  // Avoid a bug in IE 10-11 where objects with a [[Prototype]] of `null`,
  // that are composed entirely of index properties, return `false` for
  // `hasOwnProperty` checks of them.
  return hasOwnProperty.call(object, key) ||
    (typeof object == 'object' && key in object && getPrototypeOf(object) === null);
}

/**
 * The base implementation of `_.keys` which doesn't skip the constructor
 * property of prototypes or treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  return nativeKeys(Object(object));
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Creates a clone of  `buffer`.
 *
 * @private
 * @param {Buffer} buffer The buffer to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Buffer} Returns the cloned buffer.
 */
function cloneBuffer(buffer, isDeep) {
  if (isDeep) {
    return buffer.slice();
  }
  var Ctor = buffer.constructor,
      result = new Ctor(buffer.length);

  buffer.copy(result);
  return result;
}

/**
 * Creates a clone of `arrayBuffer`.
 *
 * @private
 * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
 * @returns {ArrayBuffer} Returns the cloned array buffer.
 */
function cloneArrayBuffer(arrayBuffer) {
  var Ctor = arrayBuffer.constructor,
      result = new Ctor(arrayBuffer.byteLength),
      view = new Uint8Array(result);

  view.set(new Uint8Array(arrayBuffer));
  return result;
}

/**
 * Creates a clone of `map`.
 *
 * @private
 * @param {Object} map The map to clone.
 * @returns {Object} Returns the cloned map.
 */
function cloneMap(map) {
  var Ctor = map.constructor;
  return arrayReduce(mapToArray(map), addMapEntry, new Ctor);
}

/**
 * Creates a clone of `regexp`.
 *
 * @private
 * @param {Object} regexp The regexp to clone.
 * @returns {Object} Returns the cloned regexp.
 */
function cloneRegExp(regexp) {
  var Ctor = regexp.constructor,
      result = new Ctor(regexp.source, reFlags.exec(regexp));

  result.lastIndex = regexp.lastIndex;
  return result;
}

/**
 * Creates a clone of `set`.
 *
 * @private
 * @param {Object} set The set to clone.
 * @returns {Object} Returns the cloned set.
 */
function cloneSet(set) {
  var Ctor = set.constructor;
  return arrayReduce(setToArray(set), addSetEntry, new Ctor);
}

/**
 * Creates a clone of the `symbol` object.
 *
 * @private
 * @param {Object} symbol The symbol object to clone.
 * @returns {Object} Returns the cloned symbol object.
 */
function cloneSymbol(symbol) {
  return Symbol ? Object(symbolValueOf.call(symbol)) : {};
}

/**
 * Creates a clone of `typedArray`.
 *
 * @private
 * @param {Object} typedArray The typed array to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned typed array.
 */
function cloneTypedArray(typedArray, isDeep) {
  var arrayBuffer = typedArray.buffer,
      buffer = isDeep ? cloneArrayBuffer(arrayBuffer) : arrayBuffer,
      Ctor = typedArray.constructor;

  return new Ctor(buffer, typedArray.byteOffset, typedArray.length);
}

/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function copyArray(source, array) {
  var index = -1,
      length = source.length;

  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object) {
  return copyObjectWith(source, props, object);
}

/**
 * This function is like `copyObject` except that it accepts a function to
 * customize copied values.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObjectWith(source, props, object, customizer) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : source[key];

    assignValue(object, key, newValue);
  }
  return object;
}

/**
 * Copies own symbol properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy symbols from.
 * @param {Object} [object={}] The object to copy symbols to.
 * @returns {Object} Returns `object`.
 */
function copySymbols(source, object) {
  return copyObject(source, getSymbols(source), object);
}

/**
 * Creates a base function for methods like `_.forIn`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var index = -1,
        iterable = Object(object),
        props = keysFunc(object),
        length = props.length;

    while (length--) {
      var key = props[fromRight ? length : ++index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Creates an array of the own symbol properties of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
var getSymbols = getOwnPropertySymbols || function() {
  return [];
};

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function getTag(value) {
  return objectToString.call(value);
}

// Fallback for IE 11 providing `toStringTag` values for maps, sets, and weakmaps.
if ((Map && getTag(new Map) != mapTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = objectToString.call(value),
        Ctor = result == objectTag ? value.constructor : null,
        ctorString = typeof Ctor == 'function' ? funcToString.call(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case mapCtorString: return mapTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

/**
 * Initializes an array clone.
 *
 * @private
 * @param {Array} array The array to clone.
 * @returns {Array} Returns the initialized clone.
 */
function initCloneArray(array) {
  var length = array.length,
      result = array.constructor(length);

  // Add properties assigned by `RegExp#exec`.
  if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
    result.index = array.index;
    result.input = array.input;
  }
  return result;
}

/**
 * Initializes an object clone.
 *
 * @private
 * @param {Object} object The object to clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneObject(object) {
  if (isPrototype(object)) {
    return {};
  }
  var Ctor = object.constructor;
  return baseCreate(isFunction(Ctor) ? Ctor.prototype : undefined);
}

/**
 * Initializes an object clone based on its `toStringTag`.
 *
 * **Note:** This function only supports cloning values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to clone.
 * @param {string} tag The `toStringTag` of the object to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneByTag(object, tag, isDeep) {
  var Ctor = object.constructor;
  switch (tag) {
    case arrayBufferTag:
      return cloneArrayBuffer(object);

    case boolTag:
    case dateTag:
      return new Ctor(+object);

    case float32Tag: case float64Tag:
    case int8Tag: case int16Tag: case int32Tag:
    case uint8Tag: case uint8ClampedTag: case uint16Tag: case uint32Tag:
      return cloneTypedArray(object, isDeep);

    case mapTag:
      return cloneMap(object);

    case numberTag:
    case stringTag:
      return new Ctor(object);

    case regexpTag:
      return cloneRegExp(object);

    case setTag:
      return cloneSet(object);

    case symbolTag:
      return cloneSymbol(object);
  }
}

/**
 * Creates an array of index keys for `object` values of arrays,
 * `arguments` objects, and strings, otherwise `null` is returned.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array|null} Returns index keys, else `null`.
 */
function indexKeys(object) {
  var length = object ? object.length : undefined;
  if (isLength(length) &&
      (isArray(object) || isString(object) || isArguments(object))) {
    return baseTimes(length, String);
  }
  return null;
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return type == 'number' || type == 'boolean' ||
    (type == 'string' && value != '__proto__') || value == null;
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = !Buffer ? constant(false) : function(value) {
  return value instanceof Buffer;
};

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(funcToString.call(value));
  }
  return isObjectLike(value) &&
    (isHostObject(value) ? reIsNative : reIsHostCtor).test(value);
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  var isProto = isPrototype(object);
  if (!(isProto || isArrayLike(object))) {
    return baseKeys(object);
  }
  var indexes = indexKeys(object),
      skipIndexes = !!indexes,
      result = indexes || [],
      length = result.length;

  for (var key in object) {
    if (baseHas(object, key) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length))) &&
        !(isProto && key == 'constructor')) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Creates a function that returns `value`.
 *
 * @static
 * @memberOf _
 * @category Util
 * @param {*} value The value to return from the new function.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var getter = _.constant(object);
 *
 * getter() === object;
 * // => true
 */
function constant(value) {
  return function() {
    return value;
  };
}

// Avoid inheriting from `Object.prototype` when possible.
Hash.prototype = nativeCreate ? nativeCreate(null) : objectProto;

// Add functions to the `MapCache`.
MapCache.prototype.clear = mapClear;
MapCache.prototype['delete'] = mapDelete;
MapCache.prototype.get = mapGet;
MapCache.prototype.has = mapHas;
MapCache.prototype.set = mapSet;

// Add functions to the `Stack` cache.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

module.exports = baseClone;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],29:[function(require,module,exports){
/**
 * lodash 4.0.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var keys = require('lodash.keys');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * The base implementation of `_.forEach` without support for iteratee shorthands.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array|Object} Returns `collection`.
 */
var baseEach = createBaseEach(baseForOwn);

/**
 * The base implementation of `baseForIn` and `baseForOwn` which iterates
 * over `object` properties returned by `keysFunc` invoking `iteratee` for
 * each property. Iteratee functions may exit iteration early by explicitly
 * returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = createBaseFor();

/**
 * The base implementation of `_.forOwn` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForOwn(object, iteratee) {
  return object && baseFor(object, iteratee, keys);
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Creates a `baseEach` or `baseEachRight` function.
 *
 * @private
 * @param {Function} eachFunc The function to iterate over a collection.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseEach(eachFunc, fromRight) {
  return function(collection, iteratee) {
    if (collection == null) {
      return collection;
    }
    if (!isArrayLike(collection)) {
      return eachFunc(collection, iteratee);
    }
    var length = collection.length,
        index = fromRight ? length : -1,
        iterable = Object(collection);

    while ((fromRight ? index-- : ++index < length)) {
      if (iteratee(iterable[index], index, iterable) === false) {
        break;
      }
    }
    return collection;
  };
}

/**
 * Creates a base function for methods like `_.forIn`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var index = -1,
        iterable = Object(object),
        props = keysFunc(object),
        length = props.length;

    while (length--) {
      var key = props[fromRight ? length : ++index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = baseEach;

},{"lodash.keys":30}],30:[function(require,module,exports){
/**
 * lodash 4.0.3 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    stringTag = '[object String]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var getPrototypeOf = Object.getPrototypeOf,
    propertyIsEnumerable = objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = Object.keys;

/**
 * The base implementation of `_.has` without support for deep paths.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHas(object, key) {
  // Avoid a bug in IE 10-11 where objects with a [[Prototype]] of `null`,
  // that are composed entirely of index properties, return `false` for
  // `hasOwnProperty` checks of them.
  return hasOwnProperty.call(object, key) ||
    (typeof object == 'object' && key in object && getPrototypeOf(object) === null);
}

/**
 * The base implementation of `_.keys` which doesn't skip the constructor
 * property of prototypes or treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  return nativeKeys(Object(object));
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Creates an array of index keys for `object` values of arrays,
 * `arguments` objects, and strings, otherwise `null` is returned.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array|null} Returns index keys, else `null`.
 */
function indexKeys(object) {
  var length = object ? object.length : undefined;
  if (isLength(length) &&
      (isArray(object) || isString(object) || isArguments(object))) {
    return baseTimes(length, String);
  }
  return null;
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  var isProto = isPrototype(object);
  if (!(isProto || isArrayLike(object))) {
    return baseKeys(object);
  }
  var indexes = indexKeys(object),
      skipIndexes = !!indexes,
      result = indexes || [],
      length = result.length;

  for (var key in object) {
    if (baseHas(object, key) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length))) &&
        !(isProto && key == 'constructor')) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keys;

},{}],31:[function(require,module,exports){
/**
 * lodash 3.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.7.0 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * The base implementation of `_.find`, `_.findLast`, `_.findKey`, and `_.findLastKey`,
 * without support for callback shorthands and `this` binding, which iterates
 * over `collection` using the provided `eachFunc`.
 *
 * @private
 * @param {Array|Object|string} collection The collection to search.
 * @param {Function} predicate The function invoked per iteration.
 * @param {Function} eachFunc The function to iterate over `collection`.
 * @param {boolean} [retKey] Specify returning the key of the found element
 *  instead of the element itself.
 * @returns {*} Returns the found element or its key, else `undefined`.
 */
function baseFind(collection, predicate, eachFunc, retKey) {
  var result;
  eachFunc(collection, function(value, key, collection) {
    if (predicate(value, key, collection)) {
      result = retKey ? key : value;
      return false;
    }
  });
  return result;
}

module.exports = baseFind;

},{}],32:[function(require,module,exports){
/**
 * lodash 3.6.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * The base implementation of `_.findIndex` and `_.findLastIndex` without
 * support for callback shorthands and `this` binding.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {Function} predicate The function invoked per iteration.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseFindIndex(array, predicate, fromRight) {
  var length = array.length,
      index = fromRight ? length : -1;

  while ((fromRight ? index-- : ++index < length)) {
    if (predicate(array[index], index, array)) {
      return index;
    }
  }
  return -1;
}

module.exports = baseFindIndex;

},{}],33:[function(require,module,exports){
/**
 * lodash 4.1.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * The base implementation of `_.flatten` with support for restricting flattening.
 *
 * @private
 * @param {Array} array The array to flatten.
 * @param {number} depth The maximum recursion depth.
 * @param {boolean} [isStrict] Restrict flattening to arrays-like objects.
 * @param {Array} [result=[]] The initial result value.
 * @returns {Array} Returns the new flattened array.
 */
function baseFlatten(array, depth, isStrict, result) {
  result || (result = []);

  var index = -1,
      length = array.length;

  while (++index < length) {
    var value = array[index];
    if (depth > 0 && isArrayLikeObject(value) &&
        (isStrict || isArray(value) || isArguments(value))) {
      if (depth > 1) {
        // Recursively flatten arrays (susceptible to call stack limits).
        baseFlatten(value, depth - 1, isStrict, result);
      } else {
        arrayPush(result, value);
      }
    } else if (!isStrict) {
      result[result.length] = value;
    }
  }
  return result;
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = baseFlatten;

},{}],34:[function(require,module,exports){
(function (global){
/**
 * lodash 4.5.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used to compose bitmasks for comparison styles. */
var UNORDERED_COMPARE_FLAG = 1,
    PARTIAL_COMPARE_FLAG = 2;

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/,
    rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]/g;

/** Used to match `RegExp` [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns). */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dateTag] = typedArrayTags[errorTag] =
typedArrayTags[funcTag] = typedArrayTags[mapTag] =
typedArrayTags[numberTag] = typedArrayTags[objectTag] =
typedArrayTags[regexpTag] = typedArrayTags[setTag] =
typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array.length,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check, else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * The base implementation of `_.toPairs` and `_.toPairsIn` which creates an array
 * of key-value pairs for `object` corresponding to the property names of `props`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array} props The property names to get values for.
 * @returns {Object} Returns the new array of key-value pairs.
 */
function baseToPairs(object, props) {
  return arrayMap(props, function(key) {
    return [key, object[key]];
  });
}

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Converts `map` to an array.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the converted array.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/**
 * Converts `set` to an array.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the converted array.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var Symbol = root.Symbol,
    Uint8Array = root.Uint8Array,
    getPrototypeOf = Object.getPrototypeOf,
    propertyIsEnumerable = objectProto.propertyIsEnumerable,
    splice = arrayProto.splice;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = Object.keys;

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map'),
    Set = getNative(root, 'Set'),
    WeakMap = getNative(root, 'WeakMap'),
    nativeCreate = getNative(Object, 'create');

/** Used to detect maps, sets, and weakmaps. */
var mapCtorString = Map ? funcToString.call(Map) : '',
    setCtorString = Set ? funcToString.call(Set) : '',
    weakMapCtorString = WeakMap ? funcToString.call(WeakMap) : '';

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = Symbol ? symbolProto.valueOf : undefined,
    symbolToString = Symbol ? symbolProto.toString : undefined;

/**
 * Creates an hash object.
 *
 * @private
 * @constructor
 * @returns {Object} Returns the new hash object.
 */
function Hash() {}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(hash, key) {
  return hashHas(hash, key) && delete hash[key];
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(hash, key) {
  if (nativeCreate) {
    var result = hash[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(hash, key) ? hash[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(hash, key) {
  return nativeCreate ? hash[key] !== undefined : hasOwnProperty.call(hash, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function hashSet(hash, key, value) {
  hash[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
}

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function MapCache(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapClear() {
  this.__data__ = {
    'hash': new Hash,
    'map': Map ? new Map : [],
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapDelete(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashDelete(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map['delete'](key) : assocDelete(data.map, key);
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapGet(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashGet(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.get(key) : assocGet(data.map, key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapHas(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashHas(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.has(key) : assocHas(data.map, key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache object.
 */
function mapSet(key, value) {
  var data = this.__data__;
  if (isKeyable(key)) {
    hashSet(typeof key == 'string' ? data.string : data.hash, key, value);
  } else if (Map) {
    data.map.set(key, value);
  } else {
    assocSet(data.map, key, value);
  }
  return this;
}

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function Stack(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = { 'array': [], 'map': null };
}

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocDelete(array, key) : data.map['delete'](key);
}

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocGet(array, key) : data.map.get(key);
}

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocHas(array, key) : data.map.has(key);
}

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache object.
 */
function stackSet(key, value) {
  var data = this.__data__,
      array = data.array;

  if (array) {
    if (array.length < (LARGE_ARRAY_SIZE - 1)) {
      assocSet(array, key, value);
    } else {
      data.array = null;
      data.map = new MapCache(array);
    }
  }
  var map = data.map;
  if (map) {
    map.set(key, value);
  }
  return this;
}

/**
 * Removes `key` and its value from the associative array.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function assocDelete(array, key) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    return false;
  }
  var lastIndex = array.length - 1;
  if (index == lastIndex) {
    array.pop();
  } else {
    splice.call(array, index, 1);
  }
  return true;
}

/**
 * Gets the associative array value for `key`.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function assocGet(array, key) {
  var index = assocIndexOf(array, key);
  return index < 0 ? undefined : array[index][1];
}

/**
 * Checks if an associative array value for `key` exists.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function assocHas(array, key) {
  return assocIndexOf(array, key) > -1;
}

/**
 * Gets the index at which the first occurrence of `key` is found in `array`
 * of key-value pairs.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * Sets the associative array `key` to `value`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function assocSet(array, key, value) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    array.push([key, value]);
  } else {
    array[index][1] = value;
  }
}

/**
 * Casts `value` to a path array if it's not one.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {Array} Returns the cast property path array.
 */
function baseCastPath(value) {
  return isArray(value) ? value : stringToPath(value);
}

/**
 * The base implementation of `_.get` without support for default values.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @returns {*} Returns the resolved value.
 */
function baseGet(object, path) {
  path = isKey(path, object) ? [path + ''] : baseCastPath(path);

  var index = 0,
      length = path.length;

  while (object != null && index < length) {
    object = object[path[index++]];
  }
  return (index && index == length) ? object : undefined;
}

/**
 * The base implementation of `_.has` without support for deep paths.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHas(object, key) {
  // Avoid a bug in IE 10-11 where objects with a [[Prototype]] of `null`,
  // that are composed entirely of index properties, return `false` for
  // `hasOwnProperty` checks of them.
  return hasOwnProperty.call(object, key) ||
    (typeof object == 'object' && key in object && getPrototypeOf(object) === null);
}

/**
 * The base implementation of `_.hasIn` without support for deep paths.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHasIn(object, key) {
  return key in Object(object);
}

/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {boolean} [bitmask] The bitmask of comparison flags.
 *  The bitmask may be composed of the following flags:
 *     1 - Unordered comparison
 *     2 - Partial comparison
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, customizer, bitmask, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObject(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, baseIsEqual, customizer, bitmask, stack);
}

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, equalFunc, customizer, bitmask, stack) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = arrayTag,
      othTag = arrayTag;

  if (!objIsArr) {
    objTag = getTag(object);
    if (objTag == argsTag) {
      objTag = objectTag;
    } else if (objTag != objectTag) {
      objIsArr = isTypedArray(object);
    }
  }
  if (!othIsArr) {
    othTag = getTag(other);
    if (othTag == argsTag) {
      othTag = objectTag;
    } else if (othTag != objectTag) {
      othIsArr = isTypedArray(other);
    }
  }
  var objIsObj = objTag == objectTag && !isHostObject(object),
      othIsObj = othTag == objectTag && !isHostObject(other),
      isSameTag = objTag == othTag;

  if (isSameTag && !(objIsArr || objIsObj)) {
    return equalByTag(object, other, objTag, equalFunc, customizer, bitmask);
  }
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG;
  if (!isPartial) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      return equalFunc(objIsWrapped ? object.value() : object, othIsWrapped ? other.value() : other, customizer, bitmask, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new Stack);
  return (objIsArr ? equalArrays : equalObjects)(object, other, equalFunc, customizer, bitmask, stack);
}

/**
 * The base implementation of `_.isMatch` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to inspect.
 * @param {Object} source The object of property values to match.
 * @param {Array} matchData The property names, values, and compare flags to match.
 * @param {Function} [customizer] The function to customize comparisons.
 * @returns {boolean} Returns `true` if `object` is a match, else `false`.
 */
function baseIsMatch(object, source, matchData, customizer) {
  var index = matchData.length,
      length = index,
      noCustomizer = !customizer;

  if (object == null) {
    return !length;
  }
  object = Object(object);
  while (index--) {
    var data = matchData[index];
    if ((noCustomizer && data[2])
          ? data[1] !== object[data[0]]
          : !(data[0] in object)
        ) {
      return false;
    }
  }
  while (++index < length) {
    data = matchData[index];
    var key = data[0],
        objValue = object[key],
        srcValue = data[1];

    if (noCustomizer && data[2]) {
      if (objValue === undefined && !(key in object)) {
        return false;
      }
    } else {
      var stack = new Stack,
          result = customizer ? customizer(objValue, srcValue, key, object, source, stack) : undefined;

      if (!(result === undefined
            ? baseIsEqual(srcValue, objValue, customizer, UNORDERED_COMPARE_FLAG | PARTIAL_COMPARE_FLAG, stack)
            : result
          )) {
        return false;
      }
    }
  }
  return true;
}

/**
 * The base implementation of `_.iteratee`.
 *
 * @private
 * @param {*} [value=_.identity] The value to convert to an iteratee.
 * @returns {Function} Returns the iteratee.
 */
function baseIteratee(value) {
  var type = typeof value;
  if (type == 'function') {
    return value;
  }
  if (value == null) {
    return identity;
  }
  if (type == 'object') {
    return isArray(value)
      ? baseMatchesProperty(value[0], value[1])
      : baseMatches(value);
  }
  return property(value);
}

/**
 * The base implementation of `_.keys` which doesn't skip the constructor
 * property of prototypes or treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  return nativeKeys(Object(object));
}

/**
 * The base implementation of `_.matches` which doesn't clone `source`.
 *
 * @private
 * @param {Object} source The object of property values to match.
 * @returns {Function} Returns the new function.
 */
function baseMatches(source) {
  var matchData = getMatchData(source);
  if (matchData.length == 1 && matchData[0][2]) {
    var key = matchData[0][0],
        value = matchData[0][1];

    return function(object) {
      if (object == null) {
        return false;
      }
      return object[key] === value &&
        (value !== undefined || (key in Object(object)));
    };
  }
  return function(object) {
    return object === source || baseIsMatch(object, source, matchData);
  };
}

/**
 * The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
 *
 * @private
 * @param {string} path The path of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new function.
 */
function baseMatchesProperty(path, srcValue) {
  return function(object) {
    var objValue = get(object, path);
    return (objValue === undefined && objValue === srcValue)
      ? hasIn(object, path)
      : baseIsEqual(srcValue, objValue, undefined, UNORDERED_COMPARE_FLAG | PARTIAL_COMPARE_FLAG);
  };
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * A specialized version of `baseProperty` which supports deep paths.
 *
 * @private
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new function.
 */
function basePropertyDeep(path) {
  return function(object) {
    return baseGet(object, path);
  };
}

/**
 * The base implementation of `_.slice` without an iteratee call guard.
 *
 * @private
 * @param {Array} array The array to slice.
 * @param {number} [start=0] The start position.
 * @param {number} [end=array.length] The end position.
 * @returns {Array} Returns the slice of `array`.
 */
function baseSlice(array, start, end) {
  var index = -1,
      length = array.length;

  if (start < 0) {
    start = -start > length ? 0 : (length + start);
  }
  end = end > length ? length : end;
  if (end < 0) {
    end += length;
  }
  length = start > end ? 0 : ((end - start) >>> 0);
  start >>>= 0;

  var result = Array(length);
  while (++index < length) {
    result[index] = array[index + start];
  }
  return result;
}

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @param {Object} [stack] Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, equalFunc, customizer, bitmask, stack) {
  var index = -1,
      isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      isUnordered = bitmask & UNORDERED_COMPARE_FLAG,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(array);
  if (stacked) {
    return stacked == other;
  }
  var result = true;
  stack.set(array, other);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (isUnordered) {
      if (!arraySome(other, function(othValue) {
            return arrValue === othValue || equalFunc(arrValue, othValue, customizer, bitmask, stack);
          })) {
        result = false;
        break;
      }
    } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, customizer, bitmask, stack))) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  return result;
}

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, equalFunc, customizer, bitmask) {
  switch (tag) {
    case arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
        return false;
      }
      return true;

    case boolTag:
    case dateTag:
      // Coerce dates and booleans to numbers, dates to milliseconds and booleans
      // to `1` or `0` treating invalid dates coerced to `NaN` as not equal.
      return +object == +other;

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case numberTag:
      // Treat `NaN` vs. `NaN` as equal.
      return (object != +object) ? other != +other : object == +other;

    case regexpTag:
    case stringTag:
      // Coerce regexes to strings and treat strings primitives and string
      // objects as equal. See https://es5.github.io/#x15.10.6.4 for more details.
      return object == (other + '');

    case mapTag:
      var convert = mapToArray;

    case setTag:
      var isPartial = bitmask & PARTIAL_COMPARE_FLAG;
      convert || (convert = setToArray);

      // Recursively compare objects (susceptible to call stack limits).
      return (isPartial || object.size == other.size) &&
        equalFunc(convert(object), convert(other), customizer, bitmask | UNORDERED_COMPARE_FLAG);

    case symbolTag:
      return !!Symbol && (symbolValueOf.call(object) == symbolValueOf.call(other));
  }
  return false;
}

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, equalFunc, customizer, bitmask, stack) {
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      objProps = keys(object),
      objLength = objProps.length,
      othProps = keys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : baseHas(other, key))) {
      return false;
    }
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(object);
  if (stacked) {
    return stacked == other;
  }
  var result = true;
  stack.set(object, other);

  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, customizer, bitmask, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  return result;
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Gets the property names, values, and compare flags of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the match data of `object`.
 */
function getMatchData(object) {
  var result = toPairs(object),
      length = result.length;

  while (length--) {
    result[length][2] = isStrictComparable(result[length][1]);
  }
  return result;
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function getTag(value) {
  return objectToString.call(value);
}

// Fallback for IE 11 providing `toStringTag` values for maps, sets, and weakmaps.
if ((Map && getTag(new Map) != mapTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = objectToString.call(value),
        Ctor = result == objectTag ? value.constructor : null,
        ctorString = typeof Ctor == 'function' ? funcToString.call(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case mapCtorString: return mapTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

/**
 * Checks if `path` exists on `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @param {Function} hasFunc The function to check properties.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 */
function hasPath(object, path, hasFunc) {
  if (object == null) {
    return false;
  }
  var result = hasFunc(object, path);
  if (!result && !isKey(path)) {
    path = baseCastPath(path);
    object = parent(object, path);
    if (object != null) {
      path = last(path);
      result = hasFunc(object, path);
    }
  }
  var length = object ? object.length : undefined;
  return result || (
    !!length && isLength(length) && isIndex(path, length) &&
    (isArray(object) || isString(object) || isArguments(object))
  );
}

/**
 * Creates an array of index keys for `object` values of arrays,
 * `arguments` objects, and strings, otherwise `null` is returned.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array|null} Returns index keys, else `null`.
 */
function indexKeys(object) {
  var length = object ? object.length : undefined;
  if (isLength(length) &&
      (isArray(object) || isString(object) || isArguments(object))) {
    return baseTimes(length, String);
  }
  return null;
}

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (typeof value == 'number') {
    return true;
  }
  return !isArray(value) &&
    (reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
      (object != null && value in Object(object)));
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return type == 'number' || type == 'boolean' ||
    (type == 'string' && value != '__proto__') || value == null;
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` if suitable for strict
 *  equality comparisons, else `false`.
 */
function isStrictComparable(value) {
  return value === value && !isObject(value);
}

/**
 * Gets the parent value at `path` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array} path The path to get the parent value of.
 * @returns {*} Returns the parent value.
 */
function parent(object, path) {
  return path.length == 1 ? object : get(object, baseSlice(path, 0, -1));
}

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
function stringToPath(string) {
  var result = [];
  toString(string).replace(rePropName, function(match, number, quote, string) {
    result.push(quote ? string.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
}

/**
 * Gets the last element of `array`.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to query.
 * @returns {*} Returns the last element of `array`.
 * @example
 *
 * _.last([1, 2, 3]);
 * // => 3
 */
function last(array) {
  var length = array ? array.length : 0;
  return length ? array[length - 1] : undefined;
}

/**
 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(funcToString.call(value));
  }
  return isObjectLike(value) &&
    (isHostObject(value) ? reIsNative : reIsHostCtor).test(value);
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
function isTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[objectToString.call(value)];
}

/**
 * Converts `value` to a string if it's not one. An empty string is returned
 * for `null` and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }
  if (isSymbol(value)) {
    return Symbol ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

/**
 * Gets the value at `path` of `object`. If the resolved value is
 * `undefined` the `defaultValue` is used in its place.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @param {*} [defaultValue] The value returned if the resolved value is `undefined`.
 * @returns {*} Returns the resolved value.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.get(object, 'a[0].b.c');
 * // => 3
 *
 * _.get(object, ['a', '0', 'b', 'c']);
 * // => 3
 *
 * _.get(object, 'a.b.c', 'default');
 * // => 'default'
 */
function get(object, path, defaultValue) {
  var result = object == null ? undefined : baseGet(object, path);
  return result === undefined ? defaultValue : result;
}

/**
 * Checks if `path` is a direct or inherited property of `object`.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 * @example
 *
 * var object = _.create({ 'a': _.create({ 'b': _.create({ 'c': 3 }) }) });
 *
 * _.hasIn(object, 'a');
 * // => true
 *
 * _.hasIn(object, 'a.b.c');
 * // => true
 *
 * _.hasIn(object, ['a', 'b', 'c']);
 * // => true
 *
 * _.hasIn(object, 'b');
 * // => false
 */
function hasIn(object, path) {
  return hasPath(object, path, baseHasIn);
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  var isProto = isPrototype(object);
  if (!(isProto || isArrayLike(object))) {
    return baseKeys(object);
  }
  var indexes = indexKeys(object),
      skipIndexes = !!indexes,
      result = indexes || [],
      length = result.length;

  for (var key in object) {
    if (baseHas(object, key) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length))) &&
        !(isProto && key == 'constructor')) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Creates an array of own enumerable key-value pairs for `object` which
 * can be consumed by `_.fromPairs`.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the new array of key-value pairs.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.toPairs(new Foo);
 * // => [['a', 1], ['b', 2]] (iteration order is not guaranteed)
 */
function toPairs(object) {
  return baseToPairs(object, keys(object));
}

/**
 * This method returns the first argument given to it.
 *
 * @static
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'user': 'fred' };
 *
 * _.identity(object) === object;
 * // => true
 */
function identity(value) {
  return value;
}

/**
 * Creates a function that returns the value at `path` of a given object.
 *
 * @static
 * @memberOf _
 * @category Util
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var objects = [
 *   { 'a': { 'b': { 'c': 2 } } },
 *   { 'a': { 'b': { 'c': 1 } } }
 * ];
 *
 * _.map(objects, _.property('a.b.c'));
 * // => [2, 1]
 *
 * _.map(_.sortBy(objects, _.property(['a', 'b', 'c'])), 'a.b.c');
 * // => [1, 2]
 */
function property(path) {
  return isKey(path) ? baseProperty(path) : basePropertyDeep(path);
}

// Avoid inheriting from `Object.prototype` when possible.
Hash.prototype = nativeCreate ? nativeCreate(null) : objectProto;

// Add functions to the `MapCache`.
MapCache.prototype.clear = mapClear;
MapCache.prototype['delete'] = mapDelete;
MapCache.prototype.get = mapGet;
MapCache.prototype.has = mapHas;
MapCache.prototype.set = mapSet;

// Add functions to the `Stack` cache.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

module.exports = baseIteratee;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],35:[function(require,module,exports){
/**
 * lodash 4.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseSlice = require('lodash._baseslice'),
    toString = require('lodash.tostring');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/,
    rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype;

/** Built-in value references. */
var splice = arrayProto.splice;

/**
 * Casts `value` to a path array if it's not one.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {Array} Returns the cast property path array.
 */
function baseCastPath(value) {
  return isArray(value) ? value : stringToPath(value);
}

/**
 * The base implementation of `_.get` without support for default values.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @returns {*} Returns the resolved value.
 */
function baseGet(object, path) {
  path = isKey(path, object) ? [path + ''] : baseCastPath(path);

  var index = 0,
      length = path.length;

  while (object != null && index < length) {
    object = object[path[index++]];
  }
  return (index && index == length) ? object : undefined;
}

/**
 * The base implementation of `_.pullAt` without support for individual
 * indexes or capturing the removed elements.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {number[]} indexes The indexes of elements to remove.
 * @returns {Array} Returns `array`.
 */
function basePullAt(array, indexes) {
  var length = array ? indexes.length : 0,
      lastIndex = length - 1;

  while (length--) {
    var index = indexes[length];
    if (lastIndex == length || index != previous) {
      var previous = index;
      if (isIndex(index)) {
        splice.call(array, index, 1);
      }
      else if (!isKey(index, array)) {
        var path = baseCastPath(index),
            object = parent(array, path);

        if (object != null) {
          delete object[last(path)];
        }
      }
      else {
        delete array[index];
      }
    }
  }
  return array;
}

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (typeof value == 'number') {
    return true;
  }
  return !isArray(value) &&
    (reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
      (object != null && value in Object(object)));
}

/**
 * Gets the parent value at `path` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array} path The path to get the parent value of.
 * @returns {*} Returns the parent value.
 */
function parent(object, path) {
  return path.length == 1 ? object : get(object, baseSlice(path, 0, -1));
}

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
function stringToPath(string) {
  var result = [];
  toString(string).replace(rePropName, function(match, number, quote, string) {
    result.push(quote ? string.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
}

/**
 * Gets the last element of `array`.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to query.
 * @returns {*} Returns the last element of `array`.
 * @example
 *
 * _.last([1, 2, 3]);
 * // => 3
 */
function last(array) {
  var length = array ? array.length : 0;
  return length ? array[length - 1] : undefined;
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Gets the value at `path` of `object`. If the resolved value is
 * `undefined` the `defaultValue` is used in its place.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @param {*} [defaultValue] The value returned if the resolved value is `undefined`.
 * @returns {*} Returns the resolved value.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.get(object, 'a[0].b.c');
 * // => 3
 *
 * _.get(object, ['a', '0', 'b', 'c']);
 * // => 3
 *
 * _.get(object, 'a.b.c', 'default');
 * // => 'default'
 */
function get(object, path, defaultValue) {
  var result = object == null ? undefined : baseGet(object, path);
  return result === undefined ? defaultValue : result;
}

module.exports = basePullAt;

},{"lodash._baseslice":36,"lodash.tostring":65}],36:[function(require,module,exports){
/**
 * lodash 4.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * The base implementation of `_.slice` without an iteratee call guard.
 *
 * @private
 * @param {Array} array The array to slice.
 * @param {number} [start=0] The start position.
 * @param {number} [end=array.length] The end position.
 * @returns {Array} Returns the slice of `array`.
 */
function baseSlice(array, start, end) {
  var index = -1,
      length = array.length;

  if (start < 0) {
    start = -start > length ? 0 : (length + start);
  }
  end = end > length ? length : end;
  if (end < 0) {
    end += length;
  }
  length = start > end ? 0 : ((end - start) >>> 0);
  start >>>= 0;

  var result = Array(length);
  while (++index < length) {
    result[index] = array[index + start];
  }
  return result;
}

module.exports = baseSlice;

},{}],37:[function(require,module,exports){
/**
 * lodash 4.4.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var SetCache = require('lodash._setcache'),
    root = require('lodash._root');

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match `RegExp` [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns). */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/**
 * A specialized version of `_.includes` for arrays without support for
 * specifying an index to search from.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} target The value to search for.
 * @returns {boolean} Returns `true` if `target` is found, else `false`.
 */
function arrayIncludes(array, value) {
  return !!array.length && baseIndexOf(array, value, 0) > -1;
}

/**
 * A specialized version of `_.includesWith` for arrays without support for
 * specifying an index to search from.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} target The value to search for.
 * @param {Function} comparator The comparator invoked per element.
 * @returns {boolean} Returns `true` if `target` is found, else `false`.
 */
function arrayIncludesWith(array, value, comparator) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (comparator(value, array[index])) {
      return true;
    }
  }
  return false;
}

/**
 * The base implementation of `_.indexOf` without `fromIndex` bounds checks.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} value The value to search for.
 * @param {number} fromIndex The index to search from.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseIndexOf(array, value, fromIndex) {
  if (value !== value) {
    return indexOfNaN(array, fromIndex);
  }
  var index = fromIndex - 1,
      length = array.length;

  while (++index < length) {
    if (array[index] === value) {
      return index;
    }
  }
  return -1;
}

/**
 * Gets the index at which the first occurrence of `NaN` is found in `array`.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {number} fromIndex The index to search from.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {number} Returns the index of the matched `NaN`, else `-1`.
 */
function indexOfNaN(array, fromIndex, fromRight) {
  var length = array.length,
      index = fromIndex + (fromRight ? 0 : -1);

  while ((fromRight ? index-- : ++index < length)) {
    var other = array[index];
    if (other !== other) {
      return index;
    }
  }
  return -1;
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/**
 * Converts `set` to an array.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the converted array.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/* Built-in method references that are verified to be native. */
var Set = getNative(root, 'Set');

/**
 * Checks if `value` is in `cache`.
 *
 * @private
 * @param {Object} cache The set cache to search.
 * @param {*} value The value to search for.
 * @returns {number} Returns `true` if `value` is found, else `false`.
 */
function cacheHas(cache, value) {
  var map = cache.__data__;
  if (isKeyable(value)) {
    var data = map.__data__,
        hash = typeof value == 'string' ? data.string : data.hash;

    return hash[value] === HASH_UNDEFINED;
  }
  return map.has(value);
}

/**
 * The base implementation of `_.uniqBy` without support for iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {Function} [iteratee] The iteratee invoked per element.
 * @param {Function} [comparator] The comparator invoked per element.
 * @returns {Array} Returns the new duplicate free array.
 */
function baseUniq(array, iteratee, comparator) {
  var index = -1,
      includes = arrayIncludes,
      length = array.length,
      isCommon = true,
      result = [],
      seen = result;

  if (comparator) {
    isCommon = false;
    includes = arrayIncludesWith;
  }
  else if (length >= LARGE_ARRAY_SIZE) {
    var set = iteratee ? null : createSet(array);
    if (set) {
      return setToArray(set);
    }
    isCommon = false;
    includes = cacheHas;
    seen = new SetCache;
  }
  else {
    seen = iteratee ? [] : result;
  }
  outer:
  while (++index < length) {
    var value = array[index],
        computed = iteratee ? iteratee(value) : value;

    if (isCommon && computed === computed) {
      var seenIndex = seen.length;
      while (seenIndex--) {
        if (seen[seenIndex] === computed) {
          continue outer;
        }
      }
      if (iteratee) {
        seen.push(computed);
      }
      result.push(value);
    }
    else if (!includes(seen, computed, comparator)) {
      if (seen !== result) {
        seen.push(computed);
      }
      result.push(value);
    }
  }
  return result;
}

/**
 * Creates a set of `values`.
 *
 * @private
 * @param {Array} values The values to add to the set.
 * @returns {Object} Returns the new set.
 */
var createSet = !(Set && new Set([1, 2]).size === 2) ? noop : function(values) {
  return new Set(values);
};

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return type == 'number' || type == 'boolean' ||
    (type == 'string' && value != '__proto__') || value == null;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(funcToString.call(value));
  }
  return isObjectLike(value) &&
    (isHostObject(value) ? reIsNative : reIsHostCtor).test(value);
}

/**
 * A no-operation function that returns `undefined` regardless of the
 * arguments it receives.
 *
 * @static
 * @memberOf _
 * @category Util
 * @example
 *
 * var object = { 'user': 'fred' };
 *
 * _.noop(object) === undefined;
 * // => true
 */
function noop() {
  // No operation performed.
}

module.exports = baseUniq;

},{"lodash._root":39,"lodash._setcache":40}],38:[function(require,module,exports){
/**
 * lodash 3.9.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var funcTag = '[object Function]';

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 equivalents which return 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = getNative;

},{}],39:[function(require,module,exports){
(function (global){
/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

module.exports = root;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],40:[function(require,module,exports){
(function (global){
/**
 * lodash 4.1.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match `RegExp` [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns). */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var splice = arrayProto.splice;

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map'),
    nativeCreate = getNative(Object, 'create');

/**
 * Creates an hash object.
 *
 * @private
 * @constructor
 * @returns {Object} Returns the new hash object.
 */
function Hash() {}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(hash, key) {
  return hashHas(hash, key) && delete hash[key];
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(hash, key) {
  if (nativeCreate) {
    var result = hash[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(hash, key) ? hash[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(hash, key) {
  return nativeCreate ? hash[key] !== undefined : hasOwnProperty.call(hash, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function hashSet(hash, key, value) {
  hash[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
}

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function MapCache(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapClear() {
  this.__data__ = {
    'hash': new Hash,
    'map': Map ? new Map : [],
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapDelete(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashDelete(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map['delete'](key) : assocDelete(data.map, key);
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapGet(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashGet(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.get(key) : assocGet(data.map, key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapHas(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashHas(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.has(key) : assocHas(data.map, key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache object.
 */
function mapSet(key, value) {
  var data = this.__data__;
  if (isKeyable(key)) {
    hashSet(typeof key == 'string' ? data.string : data.hash, key, value);
  } else if (Map) {
    data.map.set(key, value);
  } else {
    assocSet(data.map, key, value);
  }
  return this;
}

/**
 *
 * Creates a set cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.__data__ = new MapCache;
  while (++index < length) {
    this.push(values[index]);
  }
}

/**
 * Adds `value` to the set cache.
 *
 * @private
 * @name push
 * @memberOf SetCache
 * @param {*} value The value to cache.
 */
function cachePush(value) {
  var map = this.__data__;
  if (isKeyable(value)) {
    var data = map.__data__,
        hash = typeof value == 'string' ? data.string : data.hash;

    hash[value] = HASH_UNDEFINED;
  }
  else {
    map.set(value, HASH_UNDEFINED);
  }
}

/**
 * Removes `key` and its value from the associative array.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function assocDelete(array, key) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    return false;
  }
  var lastIndex = array.length - 1;
  if (index == lastIndex) {
    array.pop();
  } else {
    splice.call(array, index, 1);
  }
  return true;
}

/**
 * Gets the associative array value for `key`.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function assocGet(array, key) {
  var index = assocIndexOf(array, key);
  return index < 0 ? undefined : array[index][1];
}

/**
 * Checks if an associative array value for `key` exists.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function assocHas(array, key) {
  return assocIndexOf(array, key) > -1;
}

/**
 * Gets the index at which the first occurrence of `key` is found in `array`
 * of key-value pairs.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * Sets the associative array `key` to `value`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function assocSet(array, key, value) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    array.push([key, value]);
  } else {
    array[index][1] = value;
  }
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return type == 'number' || type == 'boolean' ||
    (type == 'string' && value != '__proto__') || value == null;
}

/**
 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(funcToString.call(value));
  }
  return isObjectLike(value) &&
    (isHostObject(value) ? reIsNative : reIsHostCtor).test(value);
}

// Avoid inheriting from `Object.prototype` when possible.
Hash.prototype = nativeCreate ? nativeCreate(null) : objectProto;

// Add functions to the `MapCache`.
MapCache.prototype.clear = mapClear;
MapCache.prototype['delete'] = mapDelete;
MapCache.prototype.get = mapGet;
MapCache.prototype.has = mapHas;
MapCache.prototype.set = mapSet;

// Add functions to the `SetCache`.
SetCache.prototype.push = cachePush;

module.exports = SetCache;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],41:[function(require,module,exports){
(function (global){
/**
 * lodash 4.1.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match `RegExp` [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns). */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var splice = arrayProto.splice;

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map'),
    nativeCreate = getNative(Object, 'create');

/**
 * Creates an hash object.
 *
 * @private
 * @constructor
 * @returns {Object} Returns the new hash object.
 */
function Hash() {}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(hash, key) {
  return hashHas(hash, key) && delete hash[key];
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(hash, key) {
  if (nativeCreate) {
    var result = hash[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(hash, key) ? hash[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(hash, key) {
  return nativeCreate ? hash[key] !== undefined : hasOwnProperty.call(hash, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function hashSet(hash, key, value) {
  hash[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
}

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function MapCache(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapClear() {
  this.__data__ = {
    'hash': new Hash,
    'map': Map ? new Map : [],
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapDelete(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashDelete(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map['delete'](key) : assocDelete(data.map, key);
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapGet(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashGet(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.get(key) : assocGet(data.map, key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapHas(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashHas(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.has(key) : assocHas(data.map, key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache object.
 */
function mapSet(key, value) {
  var data = this.__data__;
  if (isKeyable(key)) {
    hashSet(typeof key == 'string' ? data.string : data.hash, key, value);
  } else if (Map) {
    data.map.set(key, value);
  } else {
    assocSet(data.map, key, value);
  }
  return this;
}

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function Stack(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = { 'array': [], 'map': null };
}

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocDelete(array, key) : data.map['delete'](key);
}

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocGet(array, key) : data.map.get(key);
}

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocHas(array, key) : data.map.has(key);
}

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache object.
 */
function stackSet(key, value) {
  var data = this.__data__,
      array = data.array;

  if (array) {
    if (array.length < (LARGE_ARRAY_SIZE - 1)) {
      assocSet(array, key, value);
    } else {
      data.array = null;
      data.map = new MapCache(array);
    }
  }
  var map = data.map;
  if (map) {
    map.set(key, value);
  }
  return this;
}

/**
 * Removes `key` and its value from the associative array.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function assocDelete(array, key) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    return false;
  }
  var lastIndex = array.length - 1;
  if (index == lastIndex) {
    array.pop();
  } else {
    splice.call(array, index, 1);
  }
  return true;
}

/**
 * Gets the associative array value for `key`.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function assocGet(array, key) {
  var index = assocIndexOf(array, key);
  return index < 0 ? undefined : array[index][1];
}

/**
 * Checks if an associative array value for `key` exists.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function assocHas(array, key) {
  return assocIndexOf(array, key) > -1;
}

/**
 * Gets the index at which the first occurrence of `key` is found in `array`
 * of key-value pairs.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * Sets the associative array `key` to `value`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function assocSet(array, key, value) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    array.push([key, value]);
  } else {
    array[index][1] = value;
  }
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return type == 'number' || type == 'boolean' ||
    (type == 'string' && value != '__proto__') || value == null;
}

/**
 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(funcToString.call(value));
  }
  return isObjectLike(value) &&
    (isHostObject(value) ? reIsNative : reIsHostCtor).test(value);
}

// Avoid inheriting from `Object.prototype` when possible.
Hash.prototype = nativeCreate ? nativeCreate(null) : objectProto;

// Add functions to the `MapCache`.
MapCache.prototype.clear = mapClear;
MapCache.prototype['delete'] = mapDelete;
MapCache.prototype.get = mapGet;
MapCache.prototype.has = mapHas;
MapCache.prototype.set = mapSet;

// Add functions to the `Stack` cache.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

module.exports = Stack;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],42:[function(require,module,exports){
/**
 * lodash 4.3.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseClone = require('lodash._baseclone');

/**
 * This method is like `_.clone` except that it recursively clones `value`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to recursively clone.
 * @returns {*} Returns the deep cloned value.
 * @example
 *
 * var objects = [{ 'a': 1 }, { 'b': 2 }];
 *
 * var deep = _.cloneDeep(objects);
 * console.log(deep[0] === objects[0]);
 * // => false
 */
function cloneDeep(value) {
  return baseClone(value, true);
}

module.exports = cloneDeep;

},{"lodash._baseclone":28}],43:[function(require,module,exports){
/**
 * lodash 4.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseSlice = require('lodash._baseslice');

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Creates a slice of `array` with `n` elements dropped from the beginning.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to query.
 * @param {number} [n=1] The number of elements to drop.
 * @param- {Object} [guard] Enables use as an iteratee for functions like `_.map`.
 * @returns {Array} Returns the slice of `array`.
 * @example
 *
 * _.drop([1, 2, 3]);
 * // => [2, 3]
 *
 * _.drop([1, 2, 3], 2);
 * // => [3]
 *
 * _.drop([1, 2, 3], 5);
 * // => []
 *
 * _.drop([1, 2, 3], 0);
 * // => [1, 2, 3]
 */
function drop(array, n, guard) {
  var length = array ? array.length : 0;
  if (!length) {
    return [];
  }
  n = (guard || n === undefined) ? 1 : toInteger(n);
  return baseSlice(array, n < 0 ? 0 : n, length);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This function is loosely based on [`ToInteger`](http://www.ecma-international.org/ecma-262/6.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3');
 * // => 3
 */
function toInteger(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  var remainder = value % 1;
  return value === value ? (remainder ? value - remainder : value) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = drop;

},{"lodash._baseslice":36}],44:[function(require,module,exports){
/**
 * lodash 4.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseEach = require('lodash._baseeach'),
    baseFind = require('lodash._basefind'),
    baseFindIndex = require('lodash._basefindindex'),
    baseIteratee = require('lodash._baseiteratee');

/**
 * Iterates over elements of `collection`, returning the first element
 * `predicate` returns truthy for. The predicate is invoked with three arguments:
 * (value, index|key, collection).
 *
 * @static
 * @memberOf _
 * @category Collection
 * @param {Array|Object} collection The collection to search.
 * @param {Function|Object|string} [predicate=_.identity] The function invoked per iteration.
 * @returns {*} Returns the matched element, else `undefined`.
 * @example
 *
 * var users = [
 *   { 'user': 'barney',  'age': 36, 'active': true },
 *   { 'user': 'fred',    'age': 40, 'active': false },
 *   { 'user': 'pebbles', 'age': 1,  'active': true }
 * ];
 *
 * _.find(users, function(o) { return o.age < 40; });
 * // => object for 'barney'
 *
 * // The `_.matches` iteratee shorthand.
 * _.find(users, { 'age': 1, 'active': true });
 * // => object for 'pebbles'
 *
 * // The `_.matchesProperty` iteratee shorthand.
 * _.find(users, ['active', false]);
 * // => object for 'fred'
 *
 * // The `_.property` iteratee shorthand.
 * _.find(users, 'active');
 * // => object for 'barney'
 */
function find(collection, predicate) {
  predicate = baseIteratee(predicate, 3);
  if (isArray(collection)) {
    var index = baseFindIndex(collection, predicate);
    return index > -1 ? collection[index] : undefined;
  }
  return baseFind(collection, predicate, baseEach);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

module.exports = find;

},{"lodash._baseeach":29,"lodash._basefind":31,"lodash._basefindindex":32,"lodash._baseiteratee":34}],45:[function(require,module,exports){
/**
 * lodash 3.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.7.0 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * Gets the first element of `array`.
 *
 * @static
 * @memberOf _
 * @alias head
 * @category Array
 * @param {Array} array The array to query.
 * @returns {*} Returns the first element of `array`.
 * @example
 *
 * _.first([1, 2, 3]);
 * // => 1
 *
 * _.first([]);
 * // => undefined
 */
function first(array) {
  return array ? array[0] : undefined;
}

module.exports = first;

},{}],46:[function(require,module,exports){
/**
 * lodash 4.1.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseEach = require('lodash._baseeach');

/**
 * A specialized version of `_.forEach` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns `array`.
 */
function arrayEach(array, iteratee) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}

/**
 * Casts `value` to `identity` if it's not a function.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {Array} Returns the array-like object.
 */
function baseCastFunction(value) {
  return typeof value == 'function' ? value : identity;
}

/**
 * Iterates over elements of `collection` invoking `iteratee` for each element.
 * The iteratee is invoked with three arguments: (value, index|key, collection).
 * Iteratee functions may exit iteration early by explicitly returning `false`.
 *
 * **Note:** As with other "Collections" methods, objects with a "length" property
 * are iterated like arrays. To avoid this behavior use `_.forIn` or `_.forOwn`
 * for object iteration.
 *
 * @static
 * @memberOf _
 * @alias each
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
 * @returns {Array|Object} Returns `collection`.
 * @example
 *
 * _([1, 2]).forEach(function(value) {
 *   console.log(value);
 * });
 * // => logs `1` then `2`
 *
 * _.forEach({ 'a': 1, 'b': 2 }, function(value, key) {
 *   console.log(key);
 * });
 * // => logs 'a' then 'b' (iteration order is not guaranteed)
 */
function forEach(collection, iteratee) {
  return (typeof iteratee == 'function' && isArray(collection))
    ? arrayEach(collection, iteratee)
    : baseEach(collection, baseCastFunction(iteratee));
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * This method returns the first argument given to it.
 *
 * @static
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'user': 'fred' };
 *
 * _.identity(object) === object;
 * // => true
 */
function identity(value) {
  return value;
}

module.exports = forEach;

},{"lodash._baseeach":29}],47:[function(require,module,exports){
/**
 * lodash 3.0.7 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = isArguments;

},{}],48:[function(require,module,exports){
/**
 * lodash 4.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type Function
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

module.exports = isArray;

},{}],49:[function(require,module,exports){
/**
 * lodash 4.1.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    stringTag = '[object String]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is empty. A value is considered empty unless it's an
 * `arguments` object, array, string, or jQuery-like collection with a length
 * greater than `0` or an object with own enumerable properties.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {Array|Object|string} value The value to inspect.
 * @returns {boolean} Returns `true` if `value` is empty, else `false`.
 * @example
 *
 * _.isEmpty(null);
 * // => true
 *
 * _.isEmpty(true);
 * // => true
 *
 * _.isEmpty(1);
 * // => true
 *
 * _.isEmpty([1, 2, 3]);
 * // => false
 *
 * _.isEmpty({ 'a': 1 });
 * // => false
 */
function isEmpty(value) {
  if (isArrayLike(value) &&
      (isArray(value) || isString(value) ||
        isFunction(value.splice) || isArguments(value))) {
    return !value.length;
  }
  for (var key in value) {
    if (hasOwnProperty.call(value, key)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

module.exports = isEmpty;

},{}],50:[function(require,module,exports){
/**
 * lodash 4.1.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var Stack = require('lodash._stack'),
    keys = require('lodash.keys'),
    root = require('lodash._root');

/** Used to compose bitmasks for comparison styles. */
var UNORDERED_COMPARE_FLAG = 1,
    PARTIAL_COMPARE_FLAG = 2;

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to match `RegExp` [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns). */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dateTag] = typedArrayTags[errorTag] =
typedArrayTags[funcTag] = typedArrayTags[mapTag] =
typedArrayTags[numberTag] = typedArrayTags[objectTag] =
typedArrayTags[regexpTag] = typedArrayTags[setTag] =
typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;

/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check, else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/**
 * Converts `map` to an array.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the converted array.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/**
 * Converts `set` to an array.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the converted array.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var Symbol = root.Symbol,
    Uint8Array = root.Uint8Array,
    getPrototypeOf = Object.getPrototypeOf;

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map'),
    Set = getNative(root, 'Set'),
    WeakMap = getNative(root, 'WeakMap');

/** Used to detect maps, sets, and weakmaps. */
var mapCtorString = Map ? funcToString.call(Map) : '',
    setCtorString = Set ? funcToString.call(Set) : '',
    weakMapCtorString = WeakMap ? funcToString.call(WeakMap) : '';

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = Symbol ? symbolProto.valueOf : undefined;

/**
 * The base implementation of `_.has` without support for deep paths.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHas(object, key) {
  // Avoid a bug in IE 10-11 where objects with a [[Prototype]] of `null`,
  // that are composed entirely of index properties, return `false` for
  // `hasOwnProperty` checks of them.
  return hasOwnProperty.call(object, key) ||
    (typeof object == 'object' && key in object && getPrototypeOf(object) === null);
}

/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {boolean} [bitmask] The bitmask of comparison flags.
 *  The bitmask may be composed of the following flags:
 *     1 - Unordered comparison
 *     2 - Partial comparison
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, customizer, bitmask, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObject(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, baseIsEqual, customizer, bitmask, stack);
}

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, equalFunc, customizer, bitmask, stack) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = arrayTag,
      othTag = arrayTag;

  if (!objIsArr) {
    objTag = getTag(object);
    if (objTag == argsTag) {
      objTag = objectTag;
    } else if (objTag != objectTag) {
      objIsArr = isTypedArray(object);
    }
  }
  if (!othIsArr) {
    othTag = getTag(other);
    if (othTag == argsTag) {
      othTag = objectTag;
    } else if (othTag != objectTag) {
      othIsArr = isTypedArray(other);
    }
  }
  var objIsObj = objTag == objectTag && !isHostObject(object),
      othIsObj = othTag == objectTag && !isHostObject(other),
      isSameTag = objTag == othTag;

  if (isSameTag && !(objIsArr || objIsObj)) {
    return equalByTag(object, other, objTag, equalFunc, customizer, bitmask);
  }
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG;
  if (!isPartial) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      return equalFunc(objIsWrapped ? object.value() : object, othIsWrapped ? other.value() : other, customizer, bitmask, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new Stack);
  return (objIsArr ? equalArrays : equalObjects)(object, other, equalFunc, customizer, bitmask, stack);
}

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @param {Object} [stack] Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, equalFunc, customizer, bitmask, stack) {
  var index = -1,
      isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      isUnordered = bitmask & UNORDERED_COMPARE_FLAG,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(array);
  if (stacked) {
    return stacked == other;
  }
  var result = true;
  stack.set(array, other);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (isUnordered) {
      if (!arraySome(other, function(othValue) {
            return arrValue === othValue || equalFunc(arrValue, othValue, customizer, bitmask, stack);
          })) {
        result = false;
        break;
      }
    } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, customizer, bitmask, stack))) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  return result;
}

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, equalFunc, customizer, bitmask) {
  switch (tag) {
    case arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
        return false;
      }
      return true;

    case boolTag:
    case dateTag:
      // Coerce dates and booleans to numbers, dates to milliseconds and booleans
      // to `1` or `0` treating invalid dates coerced to `NaN` as not equal.
      return +object == +other;

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case numberTag:
      // Treat `NaN` vs. `NaN` as equal.
      return (object != +object) ? other != +other : object == +other;

    case regexpTag:
    case stringTag:
      // Coerce regexes to strings and treat strings primitives and string
      // objects as equal. See https://es5.github.io/#x15.10.6.4 for more details.
      return object == (other + '');

    case mapTag:
      var convert = mapToArray;

    case setTag:
      var isPartial = bitmask & PARTIAL_COMPARE_FLAG;
      convert || (convert = setToArray);

      // Recursively compare objects (susceptible to call stack limits).
      return (isPartial || object.size == other.size) &&
        equalFunc(convert(object), convert(other), customizer, bitmask | UNORDERED_COMPARE_FLAG);

    case symbolTag:
      return !!Symbol && (symbolValueOf.call(object) == symbolValueOf.call(other));
  }
  return false;
}

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, equalFunc, customizer, bitmask, stack) {
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      objProps = keys(object),
      objLength = objProps.length,
      othProps = keys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : baseHas(other, key))) {
      return false;
    }
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(object);
  if (stacked) {
    return stacked == other;
  }
  var result = true;
  stack.set(object, other);

  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, customizer, bitmask, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  return result;
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function getTag(value) {
  return objectToString.call(value);
}

// Fallback for IE 11 providing `toStringTag` values for maps, sets, and weakmaps.
if ((Map && getTag(new Map) != mapTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = objectToString.call(value),
        Ctor = result == objectTag ? value.constructor : null,
        ctorString = typeof Ctor == 'function' ? funcToString.call(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case mapCtorString: return mapTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Performs a deep comparison between two values to determine if they are
 * equivalent.
 *
 * **Note:** This method supports comparing arrays, array buffers, booleans,
 * date objects, error objects, maps, numbers, `Object` objects, regexes,
 * sets, strings, symbols, and typed arrays. `Object` objects are compared
 * by their own, not inherited, enumerable properties. Functions and DOM
 * nodes are **not** supported.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.isEqual(object, other);
 * // => true
 *
 * object === other;
 * // => false
 */
function isEqual(value, other) {
  return baseIsEqual(value, other);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(funcToString.call(value));
  }
  return isObjectLike(value) &&
    (isHostObject(value) ? reIsNative : reIsHostCtor).test(value);
}

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
function isTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[objectToString.call(value)];
}

module.exports = isEqual;

},{"lodash._root":39,"lodash._stack":41,"lodash.keys":51}],51:[function(require,module,exports){
arguments[4][30][0].apply(exports,arguments)
},{"dup":30}],52:[function(require,module,exports){
/**
 * lodash 3.0.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var numberTag = '[object Number]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is `NaN`.
 *
 * **Note:** This method is not the same as [`isNaN`](https://es5.github.io/#x15.1.2.4)
 * which returns `true` for `undefined` and other non-numeric values.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
 * @example
 *
 * _.isNaN(NaN);
 * // => true
 *
 * _.isNaN(new Number(NaN));
 * // => true
 *
 * isNaN(undefined);
 * // => true
 *
 * _.isNaN(undefined);
 * // => false
 */
function isNaN(value) {
  // An `NaN` primitive is the only value that is not equal to itself.
  // Perform the `toStringTag` check first to avoid errors with some ActiveX objects in IE.
  return isNumber(value) && value != +value;
}

/**
 * Checks if `value` is classified as a `Number` primitive or object.
 *
 * **Note:** To exclude `Infinity`, `-Infinity`, and `NaN`, which are classified
 * as numbers, use the `_.isFinite` method.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isNumber(3);
 * // => true
 *
 * _.isNumber(Number.MIN_VALUE);
 * // => true
 *
 * _.isNumber(Infinity);
 * // => true
 *
 * _.isNumber('3');
 * // => false
 */
function isNumber(value) {
  return typeof value == 'number' ||
    (isObjectLike(value) && objectToString.call(value) == numberTag);
}

module.exports = isNaN;

},{}],53:[function(require,module,exports){
/**
 * lodash 4.0.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var objectTag = '[object Object]';

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString.call(Object);

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var getPrototypeOf = Object.getPrototypeOf;

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  if (!isObjectLike(value) ||
      objectToString.call(value) != objectTag || isHostObject(value)) {
    return false;
  }
  var proto = objectProto;
  if (typeof value.constructor == 'function') {
    proto = getPrototypeOf(value);
  }
  if (proto === null) {
    return true;
  }
  var Ctor = proto.constructor;
  return (typeof Ctor == 'function' &&
    Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString);
}

module.exports = isPlainObject;

},{}],54:[function(require,module,exports){
/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * Checks if `value` is `undefined`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is `undefined`, else `false`.
 * @example
 *
 * _.isUndefined(void 0);
 * // => true
 *
 * _.isUndefined(null);
 * // => false
 */
function isUndefined(value) {
  return value === undefined;
}

module.exports = isUndefined;

},{}],55:[function(require,module,exports){
/**
 * lodash 3.1.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var getNative = require('lodash._getnative'),
    isArguments = require('lodash.isarguments'),
    isArray = require('lodash.isarray');

/** Used to detect unsigned integer values. */
var reIsUint = /^\d+$/;

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/* Native method references for those with the same name as other `lodash` methods. */
var nativeKeys = getNative(Object, 'keys');

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is array-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * A fallback implementation of `Object.keys` which creates an array of the
 * own enumerable property names of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function shimKeys(object) {
  var props = keysIn(object),
      propsLength = props.length,
      length = propsLength && object.length;

  var allowIndexes = !!length && isLength(length) &&
    (isArray(object) || isArguments(object));

  var index = -1,
      result = [];

  while (++index < propsLength) {
    var key = props[index];
    if ((allowIndexes && isIndex(key, length)) || hasOwnProperty.call(object, key)) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
var keys = !nativeKeys ? shimKeys : function(object) {
  var Ctor = object == null ? undefined : object.constructor;
  if ((typeof Ctor == 'function' && Ctor.prototype === object) ||
      (typeof object != 'function' && isArrayLike(object))) {
    return shimKeys(object);
  }
  return isObject(object) ? nativeKeys(object) : [];
};

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  if (object == null) {
    return [];
  }
  if (!isObject(object)) {
    object = Object(object);
  }
  var length = object.length;
  length = (length && isLength(length) &&
    (isArray(object) || isArguments(object)) && length) || 0;

  var Ctor = object.constructor,
      index = -1,
      isProto = typeof Ctor == 'function' && Ctor.prototype === object,
      result = Array(length),
      skipIndexes = length > 0;

  while (++index < length) {
    result[index] = (index + '');
  }
  for (var key in object) {
    if (!(skipIndexes && isIndex(key, length)) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keys;

},{"lodash._getnative":38,"lodash.isarguments":47,"lodash.isarray":56}],56:[function(require,module,exports){
/**
 * lodash 3.0.4 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var arrayTag = '[object Array]',
    funcTag = '[object Function]';

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/* Native method references for those with the same name as other `lodash` methods. */
var nativeIsArray = getNative(Array, 'isArray');

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(function() { return arguments; }());
 * // => false
 */
var isArray = nativeIsArray || function(value) {
  return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
};

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 equivalents which return 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = isArray;

},{}],57:[function(require,module,exports){
/**
 * lodash 4.1.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var root = require('lodash._root');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    stringTag = '[object String]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Converts `iterator` to an array.
 *
 * @private
 * @param {Object} iterator The iterator to convert.
 * @returns {Array} Returns the converted array.
 */
function iteratorToArray(iterator) {
  var data,
      result = [];

  while (!(data = iterator.next()).done) {
    result.push(data.value);
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var Reflect = root.Reflect,
    enumerate = Reflect ? Reflect.enumerate : undefined,
    propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * The base implementation of `_.keysIn` which doesn't skip the constructor
 * property of prototypes or treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeysIn(object) {
  object = object == null ? object : Object(object);

  var result = [];
  for (var key in object) {
    result.push(key);
  }
  return result;
}

// Fallback for IE < 9 with es6-shim.
if (enumerate && !propertyIsEnumerable.call({ 'valueOf': 1 }, 'valueOf')) {
  baseKeysIn = function(object) {
    return iteratorToArray(enumerate(object));
  };
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Creates an array of index keys for `object` values of arrays,
 * `arguments` objects, and strings, otherwise `null` is returned.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array|null} Returns index keys, else `null`.
 */
function indexKeys(object) {
  var length = object ? object.length : undefined;
  if (isLength(length) &&
      (isArray(object) || isString(object) || isArguments(object))) {
    return baseTimes(length, String);
  }
  return null;
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  var index = -1,
      isProto = isPrototype(object),
      props = baseKeysIn(object),
      propsLength = props.length,
      indexes = indexKeys(object),
      skipIndexes = !!indexes,
      result = indexes || [],
      length = result.length;

  while (++index < propsLength) {
    var key = props[index];
    if (!(skipIndexes && (key == 'length' || isIndex(key, length))) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keysIn;

},{"lodash._root":39}],58:[function(require,module,exports){
/**
 * lodash 4.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseEach = require('lodash._baseeach'),
    baseIteratee = require('lodash._baseiteratee');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array.length,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * The base implementation of `_.map` without support for iteratee shorthands.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function baseMap(collection, iteratee) {
  var index = -1,
      result = isArrayLike(collection) ? Array(collection.length) : [];

  baseEach(collection, function(value, key, collection) {
    result[++index] = iteratee(value, key, collection);
  });
  return result;
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Creates an array of values by running each element in `collection` through
 * `iteratee`. The iteratee is invoked with three arguments:
 * (value, index|key, collection).
 *
 * Many lodash methods are guarded to work as iteratees for methods like
 * `_.every`, `_.filter`, `_.map`, `_.mapValues`, `_.reject`, and `_.some`.
 *
 * The guarded methods are:
 * `ary`, `curry`, `curryRight`, `drop`, `dropRight`, `every`, `fill`,
 * `invert`, `parseInt`, `random`, `range`, `rangeRight`, `slice`, `some`,
 * `sortBy`, `take`, `takeRight`, `template`, `trim`, `trimEnd`, `trimStart`,
 * and `words`
 *
 * @static
 * @memberOf _
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function|Object|string} [iteratee=_.identity] The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 * @example
 *
 * function square(n) {
 *   return n * n;
 * }
 *
 * _.map([4, 8], square);
 * // => [16, 64]
 *
 * _.map({ 'a': 4, 'b': 8 }, square);
 * // => [16, 64] (iteration order is not guaranteed)
 *
 * var users = [
 *   { 'user': 'barney' },
 *   { 'user': 'fred' }
 * ];
 *
 * // The `_.property` iteratee shorthand.
 * _.map(users, 'user');
 * // => ['barney', 'fred']
 */
function map(collection, iteratee) {
  var func = isArray(collection) ? arrayMap : baseMap;
  return func(collection, baseIteratee(iteratee, 3));
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = map;

},{"lodash._baseeach":29,"lodash._baseiteratee":34}],59:[function(require,module,exports){
/**
 * lodash 4.3.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var Stack = require('lodash._stack'),
    baseClone = require('lodash._baseclone'),
    isPlainObject = require('lodash.isplainobject'),
    keysIn = require('lodash.keysin'),
    rest = require('lodash.rest');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dateTag] = typedArrayTags[errorTag] =
typedArrayTags[funcTag] = typedArrayTags[mapTag] =
typedArrayTags[numberTag] = typedArrayTags[objectTag] =
typedArrayTags[regexpTag] = typedArrayTags[setTag] =
typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;

/**
 * A specialized version of `_.forEach` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns `array`.
 */
function arrayEach(array, iteratee) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * This function is like `assignValue` except that it doesn't assign `undefined` values.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignMergeValue(object, key, value) {
  if ((value !== undefined && !eq(object[key], value)) ||
      (typeof key == 'number' && value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if ((!eq(objValue, value) ||
        (eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key))) ||
      (value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * The base implementation of `_.merge` without support for multiple sources.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {number} srcIndex The index of `source`.
 * @param {Function} [customizer] The function to customize merged values.
 * @param {Object} [stack] Tracks traversed source values and their merged counterparts.
 */
function baseMerge(object, source, srcIndex, customizer, stack) {
  if (object === source) {
    return;
  }
  var props = (isArray(source) || isTypedArray(source))
    ? undefined
    : keysIn(source);

  arrayEach(props || source, function(srcValue, key) {
    if (props) {
      key = srcValue;
      srcValue = source[key];
    }
    if (isObject(srcValue)) {
      stack || (stack = new Stack);
      baseMergeDeep(object, source, key, srcIndex, baseMerge, customizer, stack);
    }
    else {
      var newValue = customizer
        ? customizer(object[key], srcValue, (key + ''), object, source, stack)
        : undefined;

      if (newValue === undefined) {
        newValue = srcValue;
      }
      assignMergeValue(object, key, newValue);
    }
  });
}

/**
 * A specialized version of `baseMerge` for arrays and objects which performs
 * deep merges and tracks traversed objects enabling objects with circular
 * references to be merged.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {string} key The key of the value to merge.
 * @param {number} srcIndex The index of `source`.
 * @param {Function} mergeFunc The function to merge values.
 * @param {Function} [customizer] The function to customize assigned values.
 * @param {Object} [stack] Tracks traversed source values and their merged counterparts.
 */
function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
  var objValue = object[key],
      srcValue = source[key],
      stacked = stack.get(srcValue);

  if (stacked) {
    assignMergeValue(object, key, stacked);
    return;
  }
  var newValue = customizer
    ? customizer(objValue, srcValue, (key + ''), object, source, stack)
    : undefined;

  var isCommon = newValue === undefined;

  if (isCommon) {
    newValue = srcValue;
    if (isArray(srcValue) || isTypedArray(srcValue)) {
      if (isArray(objValue)) {
        newValue = objValue;
      }
      else if (isArrayLikeObject(objValue)) {
        newValue = copyArray(objValue);
      }
      else {
        isCommon = false;
        newValue = baseClone(srcValue, true);
      }
    }
    else if (isPlainObject(srcValue) || isArguments(srcValue)) {
      if (isArguments(objValue)) {
        newValue = toPlainObject(objValue);
      }
      else if (!isObject(objValue) || (srcIndex && isFunction(objValue))) {
        isCommon = false;
        newValue = baseClone(srcValue, true);
      }
      else {
        newValue = objValue;
      }
    }
    else {
      isCommon = false;
    }
  }
  stack.set(srcValue, newValue);

  if (isCommon) {
    // Recursively merge objects and arrays (susceptible to call stack limits).
    mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
  }
  assignMergeValue(object, key, newValue);
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function copyArray(source, array) {
  var index = -1,
      length = source.length;

  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object) {
  return copyObjectWith(source, props, object);
}

/**
 * This function is like `copyObject` except that it accepts a function to
 * customize copied values.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObjectWith(source, props, object, customizer) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : source[key];

    assignValue(object, key, newValue);
  }
  return object;
}

/**
 * Creates a function like `_.assign`.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return rest(function(object, sources) {
    var index = -1,
        length = sources.length,
        customizer = length > 1 ? sources[length - 1] : undefined,
        guard = length > 2 ? sources[2] : undefined;

    customizer = typeof customizer == 'function'
      ? (length--, customizer)
      : undefined;

    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    object = Object(object);
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, index, customizer);
      }
    }
    return object;
  });
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
      ? (isArrayLike(object) && isIndex(index, object.length))
      : (type == 'string' && index in object)) {
    return eq(object[index], value);
  }
  return false;
}

/**
 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
function isTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[objectToString.call(value)];
}

/**
 * Converts `value` to a plain object flattening inherited enumerable
 * properties of `value` to own properties of the plain object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {Object} Returns the converted plain object.
 * @example
 *
 * function Foo() {
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.assign({ 'a': 1 }, new Foo);
 * // => { 'a': 1, 'b': 2 }
 *
 * _.assign({ 'a': 1 }, _.toPlainObject(new Foo));
 * // => { 'a': 1, 'b': 2, 'c': 3 }
 */
function toPlainObject(value) {
  return copyObject(value, keysIn(value));
}

/**
 * Recursively merges own and inherited enumerable properties of source objects
 * into the destination object. Source properties that resolve to `undefined`
 * are skipped if a destination value exists. Array and plain object properties
 * are merged recursively. Other objects and value types are overridden by
 * assignment. Source objects are applied from left to right. Subsequent
 * sources overwrite property assignments of previous sources.
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns {Object} Returns `object`.
 * @example
 *
 * var users = {
 *   'data': [{ 'user': 'barney' }, { 'user': 'fred' }]
 * };
 *
 * var ages = {
 *   'data': [{ 'age': 36 }, { 'age': 40 }]
 * };
 *
 * _.merge(users, ages);
 * // => { 'data': [{ 'user': 'barney', 'age': 36 }, { 'user': 'fred', 'age': 40 }] }
 */
var merge = createAssigner(function(object, source, srcIndex) {
  baseMerge(object, source, srcIndex);
});

module.exports = merge;

},{"lodash._baseclone":28,"lodash._stack":41,"lodash.isplainobject":53,"lodash.keysin":57,"lodash.rest":61}],60:[function(require,module,exports){
/**
 * lodash 4.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseIteratee = require('lodash._baseiteratee'),
    basePullAt = require('lodash._basepullat');

/**
 * Removes all elements from `array` that `predicate` returns truthy for
 * and returns an array of the removed elements. The predicate is invoked with
 * three arguments: (value, index, array).
 *
 * **Note:** Unlike `_.filter`, this method mutates `array`.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to modify.
 * @param {Function|Object|string} [predicate=_.identity] The function invoked per iteration.
 * @returns {Array} Returns the new array of removed elements.
 * @example
 *
 * var array = [1, 2, 3, 4];
 * var evens = _.remove(array, function(n) {
 *   return n % 2 == 0;
 * });
 *
 * console.log(array);
 * // => [1, 3]
 *
 * console.log(evens);
 * // => [2, 4]
 */
function remove(array, predicate) {
  var result = [];
  if (!(array && array.length)) {
    return result;
  }
  var index = -1,
      indexes = [],
      length = array.length;

  predicate = baseIteratee(predicate, 3);
  while (++index < length) {
    var value = array[index];
    if (predicate(value, index, array)) {
      result.push(value);
      indexes.push(index);
    }
  }
  basePullAt(array, indexes);
  return result;
}

module.exports = remove;

},{"lodash._baseiteratee":34,"lodash._basepullat":35}],61:[function(require,module,exports){
/**
 * lodash 4.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {...*} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  var length = args.length;
  switch (length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a function that invokes `func` with the `this` binding of the
 * created function and arguments from `start` and beyond provided as an array.
 *
 * **Note:** This method is based on the [rest parameter](https://mdn.io/rest_parameters).
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var say = _.rest(function(what, names) {
 *   return what + ' ' + _.initial(names).join(', ') +
 *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
 * });
 *
 * say('hello', 'fred', 'barney', 'pebbles');
 * // => 'hello fred, barney, & pebbles'
 */
function rest(func, start) {
  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  start = nativeMax(start === undefined ? (func.length - 1) : toInteger(start), 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        array = Array(length);

    while (++index < length) {
      array[index] = args[start + index];
    }
    switch (start) {
      case 0: return func.call(this, array);
      case 1: return func.call(this, args[0], array);
      case 2: return func.call(this, args[0], args[1], array);
    }
    var otherArgs = Array(start + 1);
    index = -1;
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = array;
    return apply(func, this, otherArgs);
  };
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This function is loosely based on [`ToInteger`](http://www.ecma-international.org/ecma-262/6.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3');
 * // => 3
 */
function toInteger(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  var remainder = value % 1;
  return value === value ? (remainder ? value - remainder : value) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = rest;

},{}],62:[function(require,module,exports){
/**
 * lodash 4.0.3 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var keys = require('lodash.keys');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    stringTag = '[object String]';

/** Used to compose unicode character classes. */
var rsAstralRange = '\\ud800-\\udfff',
    rsComboMarksRange = '\\u0300-\\u036f\\ufe20-\\ufe23',
    rsComboSymbolsRange = '\\u20d0-\\u20f0',
    rsVarRange = '\\ufe0e\\ufe0f';

/** Used to compose unicode capture groups. */
var rsAstral = '[' + rsAstralRange + ']',
    rsCombo = '[' + rsComboMarksRange + rsComboSymbolsRange + ']',
    rsFitz = '\\ud83c[\\udffb-\\udfff]',
    rsModifier = '(?:' + rsCombo + '|' + rsFitz + ')',
    rsNonAstral = '[^' + rsAstralRange + ']',
    rsRegional = '(?:\\ud83c[\\udde6-\\uddff]){2}',
    rsSurrPair = '[\\ud800-\\udbff][\\udc00-\\udfff]',
    rsZWJ = '\\u200d';

/** Used to compose unicode regexes. */
var reOptMod = rsModifier + '?',
    rsOptVar = '[' + rsVarRange + ']?',
    rsOptJoin = '(?:' + rsZWJ + '(?:' + [rsNonAstral, rsRegional, rsSurrPair].join('|') + ')' + rsOptVar + reOptMod + ')*',
    rsSeq = rsOptVar + reOptMod + rsOptJoin,
    rsSymbol = '(?:' + [rsNonAstral + rsCombo + '?', rsCombo, rsRegional, rsSurrPair, rsAstral].join('|') + ')';

/** Used to match [string symbols](https://mathiasbynens.be/notes/javascript-unicode). */
var reComplexSymbol = RegExp(rsFitz + '(?=' + rsFitz + ')|' + rsSymbol + rsSeq, 'g');

/** Used to detect strings with [zero-width joiners or code points from the astral planes](http://eev.ee/blog/2015/09/12/dark-corners-of-unicode/). */
var reHasComplexSymbol = RegExp('[' + rsZWJ + rsAstralRange  + rsComboMarksRange + rsComboSymbolsRange + rsVarRange + ']');

/**
 * Gets the number of symbols in `string`.
 *
 * @private
 * @param {string} string The string to inspect.
 * @returns {number} Returns the string size.
 */
function stringSize(string) {
  if (!(string && reHasComplexSymbol.test(string))) {
    return string.length;
  }
  var result = reComplexSymbol.lastIndex = 0;
  while (reComplexSymbol.test(string)) {
    result++;
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Gets the size of `collection` by returning its length for array-like
 * values or the number of own enumerable properties for objects.
 *
 * @static
 * @memberOf _
 * @category Collection
 * @param {Array|Object} collection The collection to inspect.
 * @returns {number} Returns the collection size.
 * @example
 *
 * _.size([1, 2, 3]);
 * // => 3
 *
 * _.size({ 'a': 1, 'b': 2 });
 * // => 2
 *
 * _.size('pebbles');
 * // => 7
 */
function size(collection) {
  if (collection == null) {
    return 0;
  }
  if (isArrayLike(collection)) {
    var result = collection.length;
    return (result && isString(collection)) ? stringSize(collection) : result;
  }
  return keys(collection).length;
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

module.exports = size;

},{"lodash.keys":63}],63:[function(require,module,exports){
arguments[4][30][0].apply(exports,arguments)
},{"dup":30}],64:[function(require,module,exports){
/**
 * lodash 4.0.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseSlice = require('lodash._baseslice');

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_SAFE_INTEGER = 9007199254740991,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
      ? (isArrayLike(object) && isIndex(index, object.length))
      : (type == 'string' && index in object)) {
    return eq(object[index], value);
  }
  return false;
}

/**
 * Creates a slice of `array` from `start` up to, but not including, `end`.
 *
 * **Note:** This method is used instead of [`Array#slice`](https://mdn.io/Array/slice)
 * to ensure dense arrays are returned.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to slice.
 * @param {number} [start=0] The start position.
 * @param {number} [end=array.length] The end position.
 * @returns {Array} Returns the slice of `array`.
 */
function slice(array, start, end) {
  var length = array ? array.length : 0;
  if (!length) {
    return [];
  }
  if (end && typeof end != 'number' && isIterateeCall(array, start, end)) {
    start = 0;
    end = length;
  }
  else {
    start = start == null ? 0 : toInteger(start);
    end = end === undefined ? length : toInteger(end);
  }
  return baseSlice(array, start, end);
}

/**
 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This function is loosely based on [`ToInteger`](http://www.ecma-international.org/ecma-262/6.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3');
 * // => 3
 */
function toInteger(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  var remainder = value % 1;
  return value === value ? (remainder ? value - remainder : value) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = slice;

},{"lodash._baseslice":36}],65:[function(require,module,exports){
(function (global){
/**
 * lodash 4.1.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var Symbol = root.Symbol;

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolToString = Symbol ? symbolProto.toString : undefined;

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Converts `value` to a string if it's not one. An empty string is returned
 * for `null` and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }
  if (isSymbol(value)) {
    return Symbol ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = toString;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],66:[function(require,module,exports){
/**
 * lodash 4.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var toString = require('lodash.tostring');

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to compose unicode character classes. */
var rsAstralRange = '\\ud800-\\udfff',
    rsComboMarksRange = '\\u0300-\\u036f\\ufe20-\\ufe23',
    rsComboSymbolsRange = '\\u20d0-\\u20f0',
    rsVarRange = '\\ufe0e\\ufe0f';

/** Used to compose unicode capture groups. */
var rsAstral = '[' + rsAstralRange + ']',
    rsCombo = '[' + rsComboMarksRange + rsComboSymbolsRange + ']',
    rsFitz = '\\ud83c[\\udffb-\\udfff]',
    rsModifier = '(?:' + rsCombo + '|' + rsFitz + ')',
    rsNonAstral = '[^' + rsAstralRange + ']',
    rsRegional = '(?:\\ud83c[\\udde6-\\uddff]){2}',
    rsSurrPair = '[\\ud800-\\udbff][\\udc00-\\udfff]',
    rsZWJ = '\\u200d';

/** Used to compose unicode regexes. */
var reOptMod = rsModifier + '?',
    rsOptVar = '[' + rsVarRange + ']?',
    rsOptJoin = '(?:' + rsZWJ + '(?:' + [rsNonAstral, rsRegional, rsSurrPair].join('|') + ')' + rsOptVar + reOptMod + ')*',
    rsSeq = rsOptVar + reOptMod + rsOptJoin,
    rsSymbol = '(?:' + [rsNonAstral + rsCombo + '?', rsCombo, rsRegional, rsSurrPair, rsAstral].join('|') + ')';

/** Used to match [string symbols](https://mathiasbynens.be/notes/javascript-unicode). */
var reComplexSymbol = RegExp(rsFitz + '(?=' + rsFitz + ')|' + rsSymbol + rsSeq, 'g');

/**
 * The base implementation of `_.indexOf` without `fromIndex` bounds checks.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} value The value to search for.
 * @param {number} fromIndex The index to search from.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseIndexOf(array, value, fromIndex) {
  if (value !== value) {
    return indexOfNaN(array, fromIndex);
  }
  var index = fromIndex - 1,
      length = array.length;

  while (++index < length) {
    if (array[index] === value) {
      return index;
    }
  }
  return -1;
}

/**
 * Used by `_.trim` and `_.trimStart` to get the index of the first string symbol
 * that is not found in the character symbols.
 *
 * @private
 * @param {Array} strSymbols The string symbols to inspect.
 * @param {Array} chrSymbols The character symbols to find.
 * @returns {number} Returns the index of the first unmatched string symbol.
 */
function charsStartIndex(strSymbols, chrSymbols) {
  var index = -1,
      length = strSymbols.length;

  while (++index < length && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {}
  return index;
}

/**
 * Used by `_.trim` and `_.trimEnd` to get the index of the last string symbol
 * that is not found in the character symbols.
 *
 * @private
 * @param {Array} strSymbols The string symbols to inspect.
 * @param {Array} chrSymbols The character symbols to find.
 * @returns {number} Returns the index of the last unmatched string symbol.
 */
function charsEndIndex(strSymbols, chrSymbols) {
  var index = strSymbols.length;

  while (index-- && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {}
  return index;
}

/**
 * Gets the index at which the first occurrence of `NaN` is found in `array`.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {number} fromIndex The index to search from.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {number} Returns the index of the matched `NaN`, else `-1`.
 */
function indexOfNaN(array, fromIndex, fromRight) {
  var length = array.length,
      index = fromIndex + (fromRight ? 0 : -1);

  while ((fromRight ? index-- : ++index < length)) {
    var other = array[index];
    if (other !== other) {
      return index;
    }
  }
  return -1;
}

/**
 * Converts `string` to an array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the converted array.
 */
function stringToArray(string) {
  return string.match(reComplexSymbol);
}

/**
 * Removes leading and trailing whitespace or specified characters from `string`.
 *
 * @static
 * @memberOf _
 * @category String
 * @param {string} [string=''] The string to trim.
 * @param {string} [chars=whitespace] The characters to trim.
 * @param- {Object} [guard] Enables use as an iteratee for functions like `_.map`.
 * @returns {string} Returns the trimmed string.
 * @example
 *
 * _.trim('  abc  ');
 * // => 'abc'
 *
 * _.trim('-_-abc-_-', '_-');
 * // => 'abc'
 *
 * _.map(['  foo  ', '  bar  '], _.trim);
 * // => ['foo', 'bar']
 */
function trim(string, chars, guard) {
  string = toString(string);
  if (!string) {
    return string;
  }
  if (guard || chars === undefined) {
    return string.replace(reTrim, '');
  }
  chars = (chars + '');
  if (!chars) {
    return string;
  }
  var strSymbols = stringToArray(string),
      chrSymbols = stringToArray(chars);

  return strSymbols
    .slice(charsStartIndex(strSymbols, chrSymbols), charsEndIndex(strSymbols, chrSymbols) + 1)
    .join('');
}

module.exports = trim;

},{"lodash.tostring":65}],67:[function(require,module,exports){
/**
 * lodash 4.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseFlatten = require('lodash._baseflatten'),
    baseUniq = require('lodash._baseuniq'),
    rest = require('lodash.rest');

/**
 * Creates an array of unique values, in order, from all given arrays using
 * [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {...Array} [arrays] The arrays to inspect.
 * @returns {Array} Returns the new array of combined values.
 * @example
 *
 * _.union([2, 1], [4, 2], [1, 2]);
 * // => [2, 1, 4]
 */
var union = rest(function(arrays) {
  return baseUniq(baseFlatten(arrays, 1, true));
});

module.exports = union;

},{"lodash._baseflatten":33,"lodash._baseuniq":37,"lodash.rest":61}],68:[function(require,module,exports){
var raf = require("raf")
var TypedError = require("error/typed")

var InvalidUpdateInRender = TypedError({
    type: "main-loop.invalid.update.in-render",
    message: "main-loop: Unexpected update occurred in loop.\n" +
        "We are currently rendering a view, " +
            "you can't change state right now.\n" +
        "The diff is: {stringDiff}.\n" +
        "SUGGESTED FIX: find the state mutation in your view " +
            "or rendering function and remove it.\n" +
        "The view should not have any side effects.\n",
    diff: null,
    stringDiff: null
})

module.exports = main

function main(initialState, view, opts) {
    opts = opts || {}

    var currentState = initialState
    var create = opts.create
    var diff = opts.diff
    var patch = opts.patch
    var redrawScheduled = false

    var tree = opts.initialTree || view(currentState)
    var target = opts.target || create(tree, opts)
    var inRenderingTransaction = false

    currentState = null

    var loop = {
        state: initialState,
        target: target,
        update: update
    }
    return loop

    function update(state) {
        if (inRenderingTransaction) {
            throw InvalidUpdateInRender({
                diff: state._diff,
                stringDiff: JSON.stringify(state._diff)
            })
        }

        if (currentState === null && !redrawScheduled) {
            redrawScheduled = true
            raf(redraw)
        }

        currentState = state
        loop.state = state
    }

    function redraw() {
        redrawScheduled = false
        if (currentState === null) {
            return
        }

        inRenderingTransaction = true
        var newTree = view(currentState)

        if (opts.createOnly) {
            inRenderingTransaction = false
            create(newTree, opts)
        } else {
            var patches = diff(tree, newTree, opts)
            inRenderingTransaction = false
            target = patch(target, patches, opts)
        }

        tree = newTree
        currentState = null
    }
}

},{"error/typed":16,"raf":73}],69:[function(require,module,exports){
// Generated by CoffeeScript 1.8.0
(function() {
  var Events, Mediator, mediator;

  Events = require('backbone-events-standalone');

  Mediator = (function() {
    Mediator.prototype.attributes = {};

    function Mediator() {}

    Mediator.prototype.set = function(key, data) {
      return this.attributes[key] = data;
    };

    Mediator.prototype.get = function(key) {
      return this.attributes[key];
    };

    return Mediator;

  })();

  Events.mixin(Mediator.prototype);

  mediator = new Mediator;

  mediator.Mediator = Mediator;

  module.exports = mediator;

}).call(this);

},{"backbone-events-standalone":2}],70:[function(require,module,exports){
/*!
	Papa Parse
	v4.1.2
	https://github.com/mholt/PapaParse
*/
(function(global)
{
	"use strict";

	var IS_WORKER = !global.document && !!global.postMessage,
		IS_PAPA_WORKER = IS_WORKER && /(\?|&)papaworker(=|&|$)/.test(global.location.search),
		LOADED_SYNC = false, AUTO_SCRIPT_PATH;
	var workers = {}, workerIdCounter = 0;

	var Papa = {};

	Papa.parse = CsvToJson;
	Papa.unparse = JsonToCsv;

	Papa.RECORD_SEP = String.fromCharCode(30);
	Papa.UNIT_SEP = String.fromCharCode(31);
	Papa.BYTE_ORDER_MARK = "\ufeff";
	Papa.BAD_DELIMITERS = ["\r", "\n", "\"", Papa.BYTE_ORDER_MARK];
	Papa.WORKERS_SUPPORTED = !IS_WORKER && !!global.Worker;
	Papa.SCRIPT_PATH = null;	// Must be set by your code if you use workers and this lib is loaded asynchronously

	// Configurable chunk sizes for local and remote files, respectively
	Papa.LocalChunkSize = 1024 * 1024 * 10;	// 10 MB
	Papa.RemoteChunkSize = 1024 * 1024 * 5;	// 5 MB
	Papa.DefaultDelimiter = ",";			// Used if not specified and detection fails

	// Exposed for testing and development only
	Papa.Parser = Parser;
	Papa.ParserHandle = ParserHandle;
	Papa.NetworkStreamer = NetworkStreamer;
	Papa.FileStreamer = FileStreamer;
	Papa.StringStreamer = StringStreamer;

	if (typeof module !== 'undefined' && module.exports)
	{
		// Export to Node...
		module.exports = Papa;
	}
	else if (isFunction(global.define) && global.define.amd)
	{
		// Wireup with RequireJS
		define(function() { return Papa; });
	}
	else
	{
		// ...or as browser global
		global.Papa = Papa;
	}

	if (global.jQuery)
	{
		var $ = global.jQuery;
		$.fn.parse = function(options)
		{
			var config = options.config || {};
			var queue = [];

			this.each(function(idx)
			{
				var supported = $(this).prop('tagName').toUpperCase() == "INPUT"
								&& $(this).attr('type').toLowerCase() == "file"
								&& global.FileReader;

				if (!supported || !this.files || this.files.length == 0)
					return true;	// continue to next input element

				for (var i = 0; i < this.files.length; i++)
				{
					queue.push({
						file: this.files[i],
						inputElem: this,
						instanceConfig: $.extend({}, config)
					});
				}
			});

			parseNextFile();	// begin parsing
			return this;		// maintains chainability


			function parseNextFile()
			{
				if (queue.length == 0)
				{
					if (isFunction(options.complete))
						options.complete();
					return;
				}

				var f = queue[0];

				if (isFunction(options.before))
				{
					var returned = options.before(f.file, f.inputElem);

					if (typeof returned === 'object')
					{
						if (returned.action == "abort")
						{
							error("AbortError", f.file, f.inputElem, returned.reason);
							return;	// Aborts all queued files immediately
						}
						else if (returned.action == "skip")
						{
							fileComplete();	// parse the next file in the queue, if any
							return;
						}
						else if (typeof returned.config === 'object')
							f.instanceConfig = $.extend(f.instanceConfig, returned.config);
					}
					else if (returned == "skip")
					{
						fileComplete();	// parse the next file in the queue, if any
						return;
					}
				}

				// Wrap up the user's complete callback, if any, so that ours also gets executed
				var userCompleteFunc = f.instanceConfig.complete;
				f.instanceConfig.complete = function(results)
				{
					if (isFunction(userCompleteFunc))
						userCompleteFunc(results, f.file, f.inputElem);
					fileComplete();
				};

				Papa.parse(f.file, f.instanceConfig);
			}

			function error(name, file, elem, reason)
			{
				if (isFunction(options.error))
					options.error({name: name}, file, elem, reason);
			}

			function fileComplete()
			{
				queue.splice(0, 1);
				parseNextFile();
			}
		}
	}


	if (IS_PAPA_WORKER)
	{
		global.onmessage = workerThreadReceivedMessage;
	}
	else if (Papa.WORKERS_SUPPORTED)
	{
		AUTO_SCRIPT_PATH = getScriptPath();

		// Check if the script was loaded synchronously
		if (!document.body)
		{
			// Body doesn't exist yet, must be synchronous
			LOADED_SYNC = true;
		}
		else
		{
			document.addEventListener('DOMContentLoaded', function () {
				LOADED_SYNC = true;
			}, true);
		}
	}




	function CsvToJson(_input, _config)
	{
		_config = _config || {};

		if (_config.worker && Papa.WORKERS_SUPPORTED)
		{
			var w = newWorker();

			w.userStep = _config.step;
			w.userChunk = _config.chunk;
			w.userComplete = _config.complete;
			w.userError = _config.error;

			_config.step = isFunction(_config.step);
			_config.chunk = isFunction(_config.chunk);
			_config.complete = isFunction(_config.complete);
			_config.error = isFunction(_config.error);
			delete _config.worker;	// prevent infinite loop

			w.postMessage({
				input: _input,
				config: _config,
				workerId: w.id
			});

			return;
		}

		var streamer = null;
		if (typeof _input === 'string')
		{
			if (_config.download)
				streamer = new NetworkStreamer(_config);
			else
				streamer = new StringStreamer(_config);
		}
		else if ((global.File && _input instanceof File) || _input instanceof Object)	// ...Safari. (see issue #106)
			streamer = new FileStreamer(_config);

		return streamer.stream(_input);
	}






	function JsonToCsv(_input, _config)
	{
		var _output = "";
		var _fields = [];

		// Default configuration

		/** whether to surround every datum with quotes */
		var _quotes = false;

		/** delimiting character */
		var _delimiter = ",";

		/** newline character(s) */
		var _newline = "\r\n";

		unpackConfig();

		if (typeof _input === 'string')
			_input = JSON.parse(_input);

		if (_input instanceof Array)
		{
			if (!_input.length || _input[0] instanceof Array)
				return serialize(null, _input);
			else if (typeof _input[0] === 'object')
				return serialize(objectKeys(_input[0]), _input);
		}
		else if (typeof _input === 'object')
		{
			if (typeof _input.data === 'string')
				_input.data = JSON.parse(_input.data);

			if (_input.data instanceof Array)
			{
				if (!_input.fields)
					_input.fields = _input.data[0] instanceof Array
									? _input.fields
									: objectKeys(_input.data[0]);

				if (!(_input.data[0] instanceof Array) && typeof _input.data[0] !== 'object')
					_input.data = [_input.data];	// handles input like [1,2,3] or ["asdf"]
			}

			return serialize(_input.fields || [], _input.data || []);
		}

		// Default (any valid paths should return before this)
		throw "exception: Unable to serialize unrecognized input";


		function unpackConfig()
		{
			if (typeof _config !== 'object')
				return;

			if (typeof _config.delimiter === 'string'
				&& _config.delimiter.length == 1
				&& Papa.BAD_DELIMITERS.indexOf(_config.delimiter) == -1)
			{
				_delimiter = _config.delimiter;
			}

			if (typeof _config.quotes === 'boolean'
				|| _config.quotes instanceof Array)
				_quotes = _config.quotes;

			if (typeof _config.newline === 'string')
				_newline = _config.newline;
		}


		/** Turns an object's keys into an array */
		function objectKeys(obj)
		{
			if (typeof obj !== 'object')
				return [];
			var keys = [];
			for (var key in obj)
				keys.push(key);
			return keys;
		}

		/** The double for loop that iterates the data and writes out a CSV string including header row */
		function serialize(fields, data)
		{
			var csv = "";

			if (typeof fields === 'string')
				fields = JSON.parse(fields);
			if (typeof data === 'string')
				data = JSON.parse(data);

			var hasHeader = fields instanceof Array && fields.length > 0;
			var dataKeyedByField = !(data[0] instanceof Array);

			// If there a header row, write it first
			if (hasHeader)
			{
				for (var i = 0; i < fields.length; i++)
				{
					if (i > 0)
						csv += _delimiter;
					csv += safe(fields[i], i);
				}
				if (data.length > 0)
					csv += _newline;
			}

			// Then write out the data
			for (var row = 0; row < data.length; row++)
			{
				var maxCol = hasHeader ? fields.length : data[row].length;

				for (var col = 0; col < maxCol; col++)
				{
					if (col > 0)
						csv += _delimiter;
					var colIdx = hasHeader && dataKeyedByField ? fields[col] : col;
					csv += safe(data[row][colIdx], col);
				}

				if (row < data.length - 1)
					csv += _newline;
			}

			return csv;
		}

		/** Encloses a value around quotes if needed (makes a value safe for CSV insertion) */
		function safe(str, col)
		{
			if (typeof str === "undefined" || str === null)
				return "";

			str = str.toString().replace(/"/g, '""');

			var needsQuotes = (typeof _quotes === 'boolean' && _quotes)
							|| (_quotes instanceof Array && _quotes[col])
							|| hasAny(str, Papa.BAD_DELIMITERS)
							|| str.indexOf(_delimiter) > -1
							|| str.charAt(0) == ' '
							|| str.charAt(str.length - 1) == ' ';

			return needsQuotes ? '"' + str + '"' : str;
		}

		function hasAny(str, substrings)
		{
			for (var i = 0; i < substrings.length; i++)
				if (str.indexOf(substrings[i]) > -1)
					return true;
			return false;
		}
	}

	/** ChunkStreamer is the base prototype for various streamer implementations. */
	function ChunkStreamer(config)
	{
		this._handle = null;
		this._paused = false;
		this._finished = false;
		this._input = null;
		this._baseIndex = 0;
		this._partialLine = "";
		this._rowCount = 0;
		this._start = 0;
		this._nextChunk = null;
		this.isFirstChunk = true;
		this._completeResults = {
			data: [],
			errors: [],
			meta: {}
		};
		replaceConfig.call(this, config);

		this.parseChunk = function(chunk)
		{
			// First chunk pre-processing
			if (this.isFirstChunk && isFunction(this._config.beforeFirstChunk))
			{
				var modifiedChunk = this._config.beforeFirstChunk(chunk);
				if (modifiedChunk !== undefined)
					chunk = modifiedChunk;
			}
			this.isFirstChunk = false;

			// Rejoin the line we likely just split in two by chunking the file
			var aggregate = this._partialLine + chunk;
			this._partialLine = "";

			var results = this._handle.parse(aggregate, this._baseIndex, !this._finished);
			
			if (this._handle.paused() || this._handle.aborted())
				return;
			
			var lastIndex = results.meta.cursor;
			
			if (!this._finished)
			{
				this._partialLine = aggregate.substring(lastIndex - this._baseIndex);
				this._baseIndex = lastIndex;
			}

			if (results && results.data)
				this._rowCount += results.data.length;

			var finishedIncludingPreview = this._finished || (this._config.preview && this._rowCount >= this._config.preview);

			if (IS_PAPA_WORKER)
			{
				global.postMessage({
					results: results,
					workerId: Papa.WORKER_ID,
					finished: finishedIncludingPreview
				});
			}
			else if (isFunction(this._config.chunk))
			{
				this._config.chunk(results, this._handle);
				if (this._paused)
					return;
				results = undefined;
				this._completeResults = undefined;
			}

			if (!this._config.step && !this._config.chunk) {
				this._completeResults.data = this._completeResults.data.concat(results.data);
				this._completeResults.errors = this._completeResults.errors.concat(results.errors);
				this._completeResults.meta = results.meta;
			}

			if (finishedIncludingPreview && isFunction(this._config.complete) && (!results || !results.meta.aborted))
				this._config.complete(this._completeResults);

			if (!finishedIncludingPreview && (!results || !results.meta.paused))
				this._nextChunk();

			return results;
		};

		this._sendError = function(error)
		{
			if (isFunction(this._config.error))
				this._config.error(error);
			else if (IS_PAPA_WORKER && this._config.error)
			{
				global.postMessage({
					workerId: Papa.WORKER_ID,
					error: error,
					finished: false
				});
			}
		};

		function replaceConfig(config)
		{
			// Deep-copy the config so we can edit it
			var configCopy = copy(config);
			configCopy.chunkSize = parseInt(configCopy.chunkSize);	// parseInt VERY important so we don't concatenate strings!
			if (!config.step && !config.chunk)
				configCopy.chunkSize = null;  // disable Range header if not streaming; bad values break IIS - see issue #196
			this._handle = new ParserHandle(configCopy);
			this._handle.streamer = this;
			this._config = configCopy;	// persist the copy to the caller
		}
	}


	function NetworkStreamer(config)
	{
		config = config || {};
		if (!config.chunkSize)
			config.chunkSize = Papa.RemoteChunkSize;
		ChunkStreamer.call(this, config);

		var xhr;

		if (IS_WORKER)
		{
			this._nextChunk = function()
			{
				this._readChunk();
				this._chunkLoaded();
			};
		}
		else
		{
			this._nextChunk = function()
			{
				this._readChunk();
			};
		}

		this.stream = function(url)
		{
			this._input = url;
			this._nextChunk();	// Starts streaming
		};

		this._readChunk = function()
		{
			if (this._finished)
			{
				this._chunkLoaded();
				return;
			}

			xhr = new XMLHttpRequest();
			
			if (!IS_WORKER)
			{
				xhr.onload = bindFunction(this._chunkLoaded, this);
				xhr.onerror = bindFunction(this._chunkError, this);
			}

			xhr.open("GET", this._input, !IS_WORKER);
			
			if (this._config.chunkSize)
			{
				var end = this._start + this._config.chunkSize - 1;	// minus one because byte range is inclusive
				xhr.setRequestHeader("Range", "bytes="+this._start+"-"+end);
				xhr.setRequestHeader("If-None-Match", "webkit-no-cache"); // https://bugs.webkit.org/show_bug.cgi?id=82672
			}

			try {
				xhr.send();
			}
			catch (err) {
				this._chunkError(err.message);
			}

			if (IS_WORKER && xhr.status == 0)
				this._chunkError();
			else
				this._start += this._config.chunkSize;
		}

		this._chunkLoaded = function()
		{
			if (xhr.readyState != 4)
				return;

			if (xhr.status < 200 || xhr.status >= 400)
			{
				this._chunkError();
				return;
			}

			this._finished = !this._config.chunkSize || this._start > getFileSize(xhr);
			this.parseChunk(xhr.responseText);
		}

		this._chunkError = function(errorMessage)
		{
			var errorText = xhr.statusText || errorMessage;
			this._sendError(errorText);
		}

		function getFileSize(xhr)
		{
			var contentRange = xhr.getResponseHeader("Content-Range");
			return parseInt(contentRange.substr(contentRange.lastIndexOf("/") + 1));
		}
	}
	NetworkStreamer.prototype = Object.create(ChunkStreamer.prototype);
	NetworkStreamer.prototype.constructor = NetworkStreamer;


	function FileStreamer(config)
	{
		config = config || {};
		if (!config.chunkSize)
			config.chunkSize = Papa.LocalChunkSize;
		ChunkStreamer.call(this, config);

		var reader, slice;

		// FileReader is better than FileReaderSync (even in worker) - see http://stackoverflow.com/q/24708649/1048862
		// But Firefox is a pill, too - see issue #76: https://github.com/mholt/PapaParse/issues/76
		var usingAsyncReader = typeof FileReader !== 'undefined';	// Safari doesn't consider it a function - see issue #105

		this.stream = function(file)
		{
			this._input = file;
			slice = file.slice || file.webkitSlice || file.mozSlice;

			if (usingAsyncReader)
			{
				reader = new FileReader();		// Preferred method of reading files, even in workers
				reader.onload = bindFunction(this._chunkLoaded, this);
				reader.onerror = bindFunction(this._chunkError, this);
			}
			else
				reader = new FileReaderSync();	// Hack for running in a web worker in Firefox

			this._nextChunk();	// Starts streaming
		};

		this._nextChunk = function()
		{
			if (!this._finished && (!this._config.preview || this._rowCount < this._config.preview))
				this._readChunk();
		}

		this._readChunk = function()
		{
			var input = this._input;
			if (this._config.chunkSize)
			{
				var end = Math.min(this._start + this._config.chunkSize, this._input.size);
				input = slice.call(input, this._start, end);
			}
			var txt = reader.readAsText(input, this._config.encoding);
			if (!usingAsyncReader)
				this._chunkLoaded({ target: { result: txt } });	// mimic the async signature
		}

		this._chunkLoaded = function(event)
		{
			// Very important to increment start each time before handling results
			this._start += this._config.chunkSize;
			this._finished = !this._config.chunkSize || this._start >= this._input.size;
			this.parseChunk(event.target.result);
		}

		this._chunkError = function()
		{
			this._sendError(reader.error);
		}

	}
	FileStreamer.prototype = Object.create(ChunkStreamer.prototype);
	FileStreamer.prototype.constructor = FileStreamer;


	function StringStreamer(config)
	{
		config = config || {};
		ChunkStreamer.call(this, config);

		var string;
		var remaining;
		this.stream = function(s)
		{
			string = s;
			remaining = s;
			return this._nextChunk();
		}
		this._nextChunk = function()
		{
			if (this._finished) return;
			var size = this._config.chunkSize;
			var chunk = size ? remaining.substr(0, size) : remaining;
			remaining = size ? remaining.substr(size) : '';
			this._finished = !remaining;
			return this.parseChunk(chunk);
		}
	}
	StringStreamer.prototype = Object.create(StringStreamer.prototype);
	StringStreamer.prototype.constructor = StringStreamer;



	// Use one ParserHandle per entire CSV file or string
	function ParserHandle(_config)
	{
		// One goal is to minimize the use of regular expressions...
		var FLOAT = /^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i;

		var self = this;
		var _stepCounter = 0;	// Number of times step was called (number of rows parsed)
		var _input;				// The input being parsed
		var _parser;			// The core parser being used
		var _paused = false;	// Whether we are paused or not
		var _aborted = false;   // Whether the parser has aborted or not
		var _delimiterError;	// Temporary state between delimiter detection and processing results
		var _fields = [];		// Fields are from the header row of the input, if there is one
		var _results = {		// The last results returned from the parser
			data: [],
			errors: [],
			meta: {}
		};

		if (isFunction(_config.step))
		{
			var userStep = _config.step;
			_config.step = function(results)
			{
				_results = results;

				if (needsHeaderRow())
					processResults();
				else	// only call user's step function after header row
				{
					processResults();

					// It's possbile that this line was empty and there's no row here after all
					if (_results.data.length == 0)
						return;

					_stepCounter += results.data.length;
					if (_config.preview && _stepCounter > _config.preview)
						_parser.abort();
					else
						userStep(_results, self);
				}
			};
		}

		/**
		 * Parses input. Most users won't need, and shouldn't mess with, the baseIndex
		 * and ignoreLastRow parameters. They are used by streamers (wrapper functions)
		 * when an input comes in multiple chunks, like from a file.
		 */
		this.parse = function(input, baseIndex, ignoreLastRow)
		{
			if (!_config.newline)
				_config.newline = guessLineEndings(input);

			_delimiterError = false;
			if (!_config.delimiter)
			{
				var delimGuess = guessDelimiter(input);
				if (delimGuess.successful)
					_config.delimiter = delimGuess.bestDelimiter;
				else
				{
					_delimiterError = true;	// add error after parsing (otherwise it would be overwritten)
					_config.delimiter = Papa.DefaultDelimiter;
				}
				_results.meta.delimiter = _config.delimiter;
			}

			var parserConfig = copy(_config);
			if (_config.preview && _config.header)
				parserConfig.preview++;	// to compensate for header row

			_input = input;
			_parser = new Parser(parserConfig);
			_results = _parser.parse(_input, baseIndex, ignoreLastRow);
			processResults();
			return _paused ? { meta: { paused: true } } : (_results || { meta: { paused: false } });
		};

		this.paused = function()
		{
			return _paused;
		};

		this.pause = function()
		{
			_paused = true;
			_parser.abort();
			_input = _input.substr(_parser.getCharIndex());
		};

		this.resume = function()
		{
			_paused = false;
			self.streamer.parseChunk(_input);
		};

		this.aborted = function () {
			return _aborted;
		}

		this.abort = function()
		{
			_aborted = true;
			_parser.abort();
			_results.meta.aborted = true;
			if (isFunction(_config.complete))
				_config.complete(_results);
			_input = "";
		};

		function processResults()
		{
			if (_results && _delimiterError)
			{
				addError("Delimiter", "UndetectableDelimiter", "Unable to auto-detect delimiting character; defaulted to '"+Papa.DefaultDelimiter+"'");
				_delimiterError = false;
			}

			if (_config.skipEmptyLines)
			{
				for (var i = 0; i < _results.data.length; i++)
					if (_results.data[i].length == 1 && _results.data[i][0] == "")
						_results.data.splice(i--, 1);
			}

			if (needsHeaderRow())
				fillHeaderFields();

			return applyHeaderAndDynamicTyping();
		}

		function needsHeaderRow()
		{
			return _config.header && _fields.length == 0;
		}

		function fillHeaderFields()
		{
			if (!_results)
				return;
			for (var i = 0; needsHeaderRow() && i < _results.data.length; i++)
				for (var j = 0; j < _results.data[i].length; j++)
					_fields.push(_results.data[i][j]);
			_results.data.splice(0, 1);
		}

		function applyHeaderAndDynamicTyping()
		{
			if (!_results || (!_config.header && !_config.dynamicTyping))
				return _results;

			for (var i = 0; i < _results.data.length; i++)
			{
				var row = {};

				for (var j = 0; j < _results.data[i].length; j++)
				{
					if (_config.dynamicTyping)
					{
						var value = _results.data[i][j];
						if (value == "true" || value == "TRUE")
							_results.data[i][j] = true;
						else if (value == "false" || value == "FALSE")
							_results.data[i][j] = false;
						else
							_results.data[i][j] = tryParseFloat(value);
					}

					if (_config.header)
					{
						if (j >= _fields.length)
						{
							if (!row["__parsed_extra"])
								row["__parsed_extra"] = [];
							row["__parsed_extra"].push(_results.data[i][j]);
						}
						else
							row[_fields[j]] = _results.data[i][j];
					}
				}

				if (_config.header)
				{
					_results.data[i] = row;
					if (j > _fields.length)
						addError("FieldMismatch", "TooManyFields", "Too many fields: expected " + _fields.length + " fields but parsed " + j, i);
					else if (j < _fields.length)
						addError("FieldMismatch", "TooFewFields", "Too few fields: expected " + _fields.length + " fields but parsed " + j, i);
				}
			}

			if (_config.header && _results.meta)
				_results.meta.fields = _fields;
			return _results;
		}

		function guessDelimiter(input)
		{
			var delimChoices = [",", "\t", "|", ";", Papa.RECORD_SEP, Papa.UNIT_SEP];
			var bestDelim, bestDelta, fieldCountPrevRow;

			for (var i = 0; i < delimChoices.length; i++)
			{
				var delim = delimChoices[i];
				var delta = 0, avgFieldCount = 0;
				fieldCountPrevRow = undefined;

				var preview = new Parser({
					delimiter: delim,
					preview: 10
				}).parse(input);

				for (var j = 0; j < preview.data.length; j++)
				{
					var fieldCount = preview.data[j].length;
					avgFieldCount += fieldCount;

					if (typeof fieldCountPrevRow === 'undefined')
					{
						fieldCountPrevRow = fieldCount;
						continue;
					}
					else if (fieldCount > 1)
					{
						delta += Math.abs(fieldCount - fieldCountPrevRow);
						fieldCountPrevRow = fieldCount;
					}
				}

				if (preview.data.length > 0)
					avgFieldCount /= preview.data.length;

				if ((typeof bestDelta === 'undefined' || delta < bestDelta)
					&& avgFieldCount > 1.99)
				{
					bestDelta = delta;
					bestDelim = delim;
				}
			}

			_config.delimiter = bestDelim;

			return {
				successful: !!bestDelim,
				bestDelimiter: bestDelim
			}
		}

		function guessLineEndings(input)
		{
			input = input.substr(0, 1024*1024);	// max length 1 MB

			var r = input.split('\r');

			if (r.length == 1)
				return '\n';

			var numWithN = 0;
			for (var i = 0; i < r.length; i++)
			{
				if (r[i][0] == '\n')
					numWithN++;
			}

			return numWithN >= r.length / 2 ? '\r\n' : '\r';
		}

		function tryParseFloat(val)
		{
			var isNumber = FLOAT.test(val);
			return isNumber ? parseFloat(val) : val;
		}

		function addError(type, code, msg, row)
		{
			_results.errors.push({
				type: type,
				code: code,
				message: msg,
				row: row
			});
		}
	}





	/** The core parser implements speedy and correct CSV parsing */
	function Parser(config)
	{
		// Unpack the config object
		config = config || {};
		var delim = config.delimiter;
		var newline = config.newline;
		var comments = config.comments;
		var step = config.step;
		var preview = config.preview;
		var fastMode = config.fastMode;

		// Delimiter must be valid
		if (typeof delim !== 'string'
			|| Papa.BAD_DELIMITERS.indexOf(delim) > -1)
			delim = ",";

		// Comment character must be valid
		if (comments === delim)
			throw "Comment character same as delimiter";
		else if (comments === true)
			comments = "#";
		else if (typeof comments !== 'string'
			|| Papa.BAD_DELIMITERS.indexOf(comments) > -1)
			comments = false;

		// Newline must be valid: \r, \n, or \r\n
		if (newline != '\n' && newline != '\r' && newline != '\r\n')
			newline = '\n';

		// We're gonna need these at the Parser scope
		var cursor = 0;
		var aborted = false;

		this.parse = function(input, baseIndex, ignoreLastRow)
		{
			// For some reason, in Chrome, this speeds things up (!?)
			if (typeof input !== 'string')
				throw "Input must be a string";

			// We don't need to compute some of these every time parse() is called,
			// but having them in a more local scope seems to perform better
			var inputLen = input.length,
				delimLen = delim.length,
				newlineLen = newline.length,
				commentsLen = comments.length;
			var stepIsFunction = typeof step === 'function';

			// Establish starting state
			cursor = 0;
			var data = [], errors = [], row = [], lastCursor = 0;

			if (!input)
				return returnable();

			if (fastMode || (fastMode !== false && input.indexOf('"') === -1))
			{
				var rows = input.split(newline);
				for (var i = 0; i < rows.length; i++)
				{
					var row = rows[i];
					cursor += row.length;
					if (i !== rows.length - 1)
						cursor += newline.length;
					else if (ignoreLastRow)
						return returnable();
					if (comments && row.substr(0, commentsLen) == comments)
						continue;
					if (stepIsFunction)
					{
						data = [];
						pushRow(row.split(delim));
						doStep();
						if (aborted)
							return returnable();
					}
					else
						pushRow(row.split(delim));
					if (preview && i >= preview)
					{
						data = data.slice(0, preview);
						return returnable(true);
					}
				}
				return returnable();
			}

			var nextDelim = input.indexOf(delim, cursor);
			var nextNewline = input.indexOf(newline, cursor);

			// Parser loop
			for (;;)
			{
				// Field has opening quote
				if (input[cursor] == '"')
				{
					// Start our search for the closing quote where the cursor is
					var quoteSearch = cursor;

					// Skip the opening quote
					cursor++;

					for (;;)
					{
						// Find closing quote
						var quoteSearch = input.indexOf('"', quoteSearch+1);

						if (quoteSearch === -1)
						{
							if (!ignoreLastRow) {
								// No closing quote... what a pity
								errors.push({
									type: "Quotes",
									code: "MissingQuotes",
									message: "Quoted field unterminated",
									row: data.length,	// row has yet to be inserted
									index: cursor
								});
							}
							return finish();
						}

						if (quoteSearch === inputLen-1)
						{
							// Closing quote at EOF
							var value = input.substring(cursor, quoteSearch).replace(/""/g, '"');
							return finish(value);
						}

						// If this quote is escaped, it's part of the data; skip it
						if (input[quoteSearch+1] == '"')
						{
							quoteSearch++;
							continue;
						}

						if (input[quoteSearch+1] == delim)
						{
							// Closing quote followed by delimiter
							row.push(input.substring(cursor, quoteSearch).replace(/""/g, '"'));
							cursor = quoteSearch + 1 + delimLen;
							nextDelim = input.indexOf(delim, cursor);
							nextNewline = input.indexOf(newline, cursor);
							break;
						}

						if (input.substr(quoteSearch+1, newlineLen) === newline)
						{
							// Closing quote followed by newline
							row.push(input.substring(cursor, quoteSearch).replace(/""/g, '"'));
							saveRow(quoteSearch + 1 + newlineLen);
							nextDelim = input.indexOf(delim, cursor);	// because we may have skipped the nextDelim in the quoted field

							if (stepIsFunction)
							{
								doStep();
								if (aborted)
									return returnable();
							}
							
							if (preview && data.length >= preview)
								return returnable(true);

							break;
						}
					}

					continue;
				}

				// Comment found at start of new line
				if (comments && row.length === 0 && input.substr(cursor, commentsLen) === comments)
				{
					if (nextNewline == -1)	// Comment ends at EOF
						return returnable();
					cursor = nextNewline + newlineLen;
					nextNewline = input.indexOf(newline, cursor);
					nextDelim = input.indexOf(delim, cursor);
					continue;
				}

				// Next delimiter comes before next newline, so we've reached end of field
				if (nextDelim !== -1 && (nextDelim < nextNewline || nextNewline === -1))
				{
					row.push(input.substring(cursor, nextDelim));
					cursor = nextDelim + delimLen;
					nextDelim = input.indexOf(delim, cursor);
					continue;
				}

				// End of row
				if (nextNewline !== -1)
				{
					row.push(input.substring(cursor, nextNewline));
					saveRow(nextNewline + newlineLen);

					if (stepIsFunction)
					{
						doStep();
						if (aborted)
							return returnable();
					}

					if (preview && data.length >= preview)
						return returnable(true);

					continue;
				}

				break;
			}


			return finish();


			function pushRow(row)
			{
				data.push(row);
				lastCursor = cursor;
			}

			/**
			 * Appends the remaining input from cursor to the end into
			 * row, saves the row, calls step, and returns the results.
			 */
			function finish(value)
			{
				if (ignoreLastRow)
					return returnable();
				if (typeof value === 'undefined')
					value = input.substr(cursor);
				row.push(value);
				cursor = inputLen;	// important in case parsing is paused
				pushRow(row);
				if (stepIsFunction)
					doStep();
				return returnable();
			}

			/**
			 * Appends the current row to the results. It sets the cursor
			 * to newCursor and finds the nextNewline. The caller should
			 * take care to execute user's step function and check for
			 * preview and end parsing if necessary.
			 */
			function saveRow(newCursor)
			{
				cursor = newCursor;
				pushRow(row);
				row = [];
				nextNewline = input.indexOf(newline, cursor);
			}

			/** Returns an object with the results, errors, and meta. */
			function returnable(stopped)
			{
				return {
					data: data,
					errors: errors,
					meta: {
						delimiter: delim,
						linebreak: newline,
						aborted: aborted,
						truncated: !!stopped,
						cursor: lastCursor + (baseIndex || 0)
					}
				};
			}

			/** Executes the user's step function and resets data & errors. */
			function doStep()
			{
				step(returnable());
				data = [], errors = [];
			}
		};

		/** Sets the abort flag */
		this.abort = function()
		{
			aborted = true;
		};

		/** Gets the cursor position */
		this.getCharIndex = function()
		{
			return cursor;
		};
	}


	// If you need to load Papa Parse asynchronously and you also need worker threads, hard-code
	// the script path here. See: https://github.com/mholt/PapaParse/issues/87#issuecomment-57885358
	function getScriptPath()
	{
		var scripts = document.getElementsByTagName('script');
		return scripts.length ? scripts[scripts.length - 1].src : '';
	}

	function newWorker()
	{
		if (!Papa.WORKERS_SUPPORTED)
			return false;
		if (!LOADED_SYNC && Papa.SCRIPT_PATH === null)
			throw new Error(
				'Script path cannot be determined automatically when Papa Parse is loaded asynchronously. ' +
				'You need to set Papa.SCRIPT_PATH manually.'
			);
		var workerUrl = Papa.SCRIPT_PATH || AUTO_SCRIPT_PATH;
		// Append "papaworker" to the search string to tell papaparse that this is our worker.
		workerUrl += (workerUrl.indexOf('?') !== -1 ? '&' : '?') + 'papaworker';
		var w = new global.Worker(workerUrl);
		w.onmessage = mainThreadReceivedMessage;
		w.id = workerIdCounter++;
		workers[w.id] = w;
		return w;
	}

	/** Callback when main thread receives a message */
	function mainThreadReceivedMessage(e)
	{
		var msg = e.data;
		var worker = workers[msg.workerId];
		var aborted = false;

		if (msg.error)
			worker.userError(msg.error, msg.file);
		else if (msg.results && msg.results.data)
		{
			var abort = function() {
				aborted = true;
				completeWorker(msg.workerId, { data: [], errors: [], meta: { aborted: true } });
			};

			var handle = {
				abort: abort,
				pause: notImplemented,
				resume: notImplemented
			};

			if (isFunction(worker.userStep))
			{
				for (var i = 0; i < msg.results.data.length; i++)
				{
					worker.userStep({
						data: [msg.results.data[i]],
						errors: msg.results.errors,
						meta: msg.results.meta
					}, handle);
					if (aborted)
						break;
				}
				delete msg.results;	// free memory ASAP
			}
			else if (isFunction(worker.userChunk))
			{
				worker.userChunk(msg.results, handle, msg.file);
				delete msg.results;
			}
		}

		if (msg.finished && !aborted)
			completeWorker(msg.workerId, msg.results);
	}

	function completeWorker(workerId, results) {
		var worker = workers[workerId];
		if (isFunction(worker.userComplete))
			worker.userComplete(results);
		worker.terminate();
		delete workers[workerId];
	}

	function notImplemented() {
		throw "Not implemented.";
	}

	/** Callback when worker thread receives a message */
	function workerThreadReceivedMessage(e)
	{
		var msg = e.data;

		if (typeof Papa.WORKER_ID === 'undefined' && msg)
			Papa.WORKER_ID = msg.workerId;

		if (typeof msg.input === 'string')
		{
			global.postMessage({
				workerId: Papa.WORKER_ID,
				results: Papa.parse(msg.input, msg.config),
				finished: true
			});
		}
		else if ((global.File && msg.input instanceof File) || msg.input instanceof Object)	// thank you, Safari (see issue #106)
		{
			var results = Papa.parse(msg.input, msg.config);
			if (results)
				global.postMessage({
					workerId: Papa.WORKER_ID,
					results: results,
					finished: true
				});
		}
	}

	/** Makes a deep copy of an array or object (mostly) */
	function copy(obj)
	{
		if (typeof obj !== 'object')
			return obj;
		var cpy = obj instanceof Array ? [] : {};
		for (var key in obj)
			cpy[key] = copy(obj[key]);
		return cpy;
	}

	function bindFunction(f, self)
	{
		return function() { f.apply(self, arguments); };
	}

	function isFunction(func)
	{
		return typeof func === 'function';
	}
})(typeof window !== 'undefined' ? window : this);

},{}],71:[function(require,module,exports){
var trim = require('trim')
  , forEach = require('for-each')
  , isArray = function(arg) {
      return Object.prototype.toString.call(arg) === '[object Array]';
    }

module.exports = function (headers) {
  if (!headers)
    return {}

  var result = {}

  forEach(
      trim(headers).split('\n')
    , function (row) {
        var index = row.indexOf(':')
          , key = trim(row.slice(0, index)).toLowerCase()
          , value = trim(row.slice(index + 1))

        if (typeof(result[key]) === 'undefined') {
          result[key] = value
        } else if (isArray(result[key])) {
          result[key].push(value)
        } else {
          result[key] = [ result[key], value ]
        }
      }
  )

  return result
}
},{"for-each":21,"trim":76}],72:[function(require,module,exports){
(function (process){
// Generated by CoffeeScript 1.6.3
(function() {
  var getNanoSeconds, hrtime, loadTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - loadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    loadTime = getNanoSeconds();
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(this);

/*

*/

}).call(this,require('_process'))
},{"_process":7}],73:[function(require,module,exports){
var now = require('performance-now')
  , global = typeof window === 'undefined' ? {} : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = global['request' + suffix]
  , caf = global['cancel' + suffix] || global['cancelRequest' + suffix]
  , isNative = true

for(var i = 0; i < vendors.length && !raf; i++) {
  raf = global[vendors[i] + 'Request' + suffix]
  caf = global[vendors[i] + 'Cancel' + suffix]
      || global[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  isNative = false

  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next))
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  if(!isNative) {
    return raf.call(global, fn)
  }
  return raf.call(global, function() {
    try{
      fn.apply(this, arguments)
    } catch(e) {
      setTimeout(function() { throw e }, 0)
    }
  })
}
module.exports.cancel = function() {
  caf.apply(global, arguments)
}

},{"performance-now":72}],74:[function(require,module,exports){
(function (process){
module.exports = function (tasks, cb) {
  var results, pending, keys
  var isSync = true

  if (Array.isArray(tasks)) {
    results = []
    pending = tasks.length
  } else {
    keys = Object.keys(tasks)
    results = {}
    pending = keys.length
  }

  function done (err) {
    function end () {
      if (cb) cb(err, results)
      cb = null
    }
    if (isSync) process.nextTick(end)
    else end()
  }

  function each (i, err, result) {
    results[i] = result
    if (--pending === 0 || err) {
      done(err)
    }
  }

  if (!pending) {
    // empty
    done(null)
  } else if (keys) {
    // object
    keys.forEach(function (key) {
      tasks[key](each.bind(undefined, key))
    })
  } else {
    // array
    tasks.forEach(function (task, i) {
      task(each.bind(undefined, i))
    })
  }

  isSync = false
}

}).call(this,require('_process'))
},{"_process":7}],75:[function(require,module,exports){
var nargs = /\{([0-9a-zA-Z]+)\}/g
var slice = Array.prototype.slice

module.exports = template

function template(string) {
    var args

    if (arguments.length === 2 && typeof arguments[1] === "object") {
        args = arguments[1]
    } else {
        args = slice.call(arguments, 1)
    }

    if (!args || !args.hasOwnProperty) {
        args = {}
    }

    return string.replace(nargs, function replaceArg(match, i, index) {
        var result

        if (string[index - 1] === "{" &&
            string[index + match.length] === "}") {
            return i
        } else {
            result = args.hasOwnProperty(i) ? args[i] : null
            if (result === null || result === undefined) {
                return ""
            }

            return result
        }
    })
}

},{}],76:[function(require,module,exports){

exports = module.exports = trim;

function trim(str){
  return str.replace(/^\s*|\s*$/g, '');
}

exports.left = function(str){
  return str.replace(/^\s*/, '');
};

exports.right = function(str){
  return str.replace(/\s*$/, '');
};

},{}],77:[function(require,module,exports){
/*!
* vdom-virtualize
* Copyright 2014 by Marcel Klehr <mklehr@gmx.net>
*
* (MIT LICENSE)
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
* THE SOFTWARE.
*/
var VNode = require("virtual-dom/vnode/vnode")
  , VText = require("virtual-dom/vnode/vtext")
  , VComment = require("./vcomment")

module.exports = createVNode

function createVNode(domNode, key) {
  key = key || null // XXX: Leave out `key` for now... merely used for (re-)ordering

  if(domNode.nodeType == 1) return createFromElement(domNode, key)
  if(domNode.nodeType == 3) return createFromTextNode(domNode, key)
  if(domNode.nodeType == 8) return createFromCommentNode(domNode, key)
  return
}

createVNode.fromHTML = function(html, key) {
  var rootNode = null;

  try {
    // Everything except iOS 7 Safari, IE 8/9, Andriod Browser 4.1/4.3
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    rootNode = doc.documentElement;
  } catch(e) {
    // Old browsers
    var ifr = document.createElement('iframe');
    ifr.setAttribute('data-content', html);
    ifr.src = 'javascript: window.frameElement.getAttribute("data-content");';
    document.head.appendChild(ifr);
    rootNode = ifr.contentDocument.documentElement;
    setTimeout(function() {
      ifr.remove(); // Garbage collection
    }, 0);
  }

  return createVNode(rootNode, key);
};

function createFromTextNode(tNode) {
  return new VText(tNode.nodeValue)
}


function createFromCommentNode(cNode) {
  return new VComment(cNode.nodeValue)
}


function createFromElement(el) {
  var tagName = el.tagName
  , namespace = el.namespaceURI == 'http://www.w3.org/1999/xhtml'? null : el.namespaceURI
  , properties = getElementProperties(el)
  , children = []

  for (var i = 0; i < el.childNodes.length; i++) {
    children.push(createVNode(el.childNodes[i]/*, i*/))
  }

  return new VNode(tagName, properties, children, null, namespace)
}


function getElementProperties(el) {
  var obj = {}

  for(var i=0; i<props.length; i++) {
    var propName = props[i]
    if(!el[propName]) continue

    // Special case: style
    // .style is a DOMStyleDeclaration, thus we need to iterate over all
    // rules to create a hash of applied css properties.
    //
    // You can directly set a specific .style[prop] = value so patching with vdom
    // is possible.
    if("style" == propName) {
      var css = {}
        , styleProp
      if ('undefined' !== typeof el.style.length) {
        for(var j=0; j<el.style.length; j++) {
          styleProp = el.style[i]
          css[styleProp] = el.style.getPropertyValue(styleProp) // XXX: add support for "!important" via getPropertyPriority()!
        }
      } else { // IE8
        for (var styleProp in el.style) {
          if (el.style[styleProp] && el.style.hasOwnProperty(styleProp)) {
            css[styleProp] = el.style[styleProp];
          }
        }
      }

      if(Object.keys(css).length) obj[propName] = css
      continue
    }

    // https://msdn.microsoft.com/en-us/library/cc848861%28v=vs.85%29.aspx
    // The img element does not support the HREF content attribute.
    // In addition, the href property is read-only for the img Document Object Model (DOM) object
    if (el.tagName.toLowerCase() === 'img' && propName === 'href') {
      continue;
    }

    // Special case: dataset
    // we can iterate over .dataset with a simple for..in loop.
    // The all-time foo with data-* attribs is the dash-snake to camelCase
    // conversion.
    //
    // *This is compatible with h(), but not with every browser, thus this section was removed in favor
    // of attributes (specified below)!*
    //
    // .dataset properties are directly accessible as transparent getters/setters, so
    // patching with vdom is possible.
    /*if("dataset" == propName) {
      var data = {}
      for(var p in el.dataset) {
        data[p] = el.dataset[p]
      }
      obj[propName] = data
      return
    }*/

    // Special case: attributes
    // these are a NamedNodeMap, but we can just convert them to a hash for vdom,
    // because of https://github.com/Matt-Esch/virtual-dom/blob/master/vdom/apply-properties.js#L57
    if("attributes" == propName){
      var atts = Array.prototype.slice.call(el[propName]);
      var hash = {}
      for(var k=0; k<atts.length; k++){
        var name = atts[k].name;
        if(obj[name] || obj[attrBlacklist[name]]) continue;
        hash[name] = el.getAttribute(name);
      }
      obj[propName] = hash;
      continue
    }
    if("tabIndex" == propName && el.tabIndex === -1) continue

    // Special case: contentEditable
    // browser use 'inherit' by default on all nodes, but does not allow setting it to ''
    // diffing virtualize dom will trigger error
    // ref: https://github.com/Matt-Esch/virtual-dom/issues/176
    if("contentEditable" == propName && el[propName] === 'inherit') continue

    if('object' === typeof el[propName]) continue

    // default: just copy the property
    obj[propName] = el[propName]
  }

  return obj
}

/**
 * DOMNode property white list
 * Taken from https://github.com/Raynos/react/blob/dom-property-config/src/browser/ui/dom/DefaultDOMPropertyConfig.js
 */
var props =

module.exports.properties = [
 "accept"
,"accessKey"
,"action"
,"alt"
,"async"
,"autoComplete"
,"autoPlay"
,"cellPadding"
,"cellSpacing"
,"checked"
,"className"
,"colSpan"
,"content"
,"contentEditable"
,"controls"
,"crossOrigin"
,"data"
//,"dataset" removed since attributes handles data-attributes
,"defer"
,"dir"
,"download"
,"draggable"
,"encType"
,"formNoValidate"
,"href"
,"hrefLang"
,"htmlFor"
,"httpEquiv"
,"icon"
,"id"
,"label"
,"lang"
,"list"
,"loop"
,"max"
,"mediaGroup"
,"method"
,"min"
,"multiple"
,"muted"
,"name"
,"noValidate"
,"pattern"
,"placeholder"
,"poster"
,"preload"
,"radioGroup"
,"readOnly"
,"rel"
,"required"
,"rowSpan"
,"sandbox"
,"scope"
,"scrollLeft"
,"scrolling"
,"scrollTop"
,"selected"
,"span"
,"spellCheck"
,"src"
,"srcDoc"
,"srcSet"
,"start"
,"step"
,"style"
,"tabIndex"
,"target"
,"title"
,"type"
,"value"

// Non-standard Properties
,"autoCapitalize"
,"autoCorrect"
,"property"

, "attributes"
]

var attrBlacklist =
module.exports.attrBlacklist = {
  'class': 'className'
}
},{"./vcomment":78,"virtual-dom/vnode/vnode":100,"virtual-dom/vnode/vtext":102}],78:[function(require,module,exports){
module.exports = VirtualComment

function VirtualComment(text) {
  this.text = String(text)
}

VirtualComment.prototype.type = 'Widget'

VirtualComment.prototype.init = function() {
  return document.createComment(this.text)
}

VirtualComment.prototype.update = function(previous, domNode) {
  if(this.text === previous.text) return
  domNode.nodeValue = this.text
}

},{}],79:[function(require,module,exports){
var createElement = require("./vdom/create-element.js")

module.exports = createElement

},{"./vdom/create-element.js":84}],80:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":104}],81:[function(require,module,exports){
var h = require("./virtual-hyperscript/index.js")

module.exports = h

},{"./virtual-hyperscript/index.js":91}],82:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":87}],83:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook.js")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, propName, propValue, previous);
        } else if (isHook(propValue)) {
            removeProperty(node, propName, propValue, previous)
            if (propValue.hook) {
                propValue.hook(node,
                    propName,
                    previous ? previous[propName] : undefined)
            }
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, propName, propValue, previous) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        } else if (previousValue.unhook) {
            previousValue.unhook(node, propName, propValue)
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"../vnode/is-vhook.js":95,"is-object":27}],84:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("../vnode/is-vnode.js")
var isVText = require("../vnode/is-vtext.js")
var isWidget = require("../vnode/is-widget.js")
var handleThunk = require("../vnode/handle-thunk.js")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var node = (vnode.namespace === null) ?
        doc.createElement(vnode.tagName) :
        doc.createElementNS(vnode.namespace, vnode.tagName)

    var props = vnode.properties
    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"../vnode/handle-thunk.js":93,"../vnode/is-vnode.js":96,"../vnode/is-vtext.js":97,"../vnode/is-widget.js":98,"./apply-properties":83,"global/document":22}],85:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],86:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("../vnode/is-widget.js")
var VPatch = require("../vnode/vpatch.js")

var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = renderOptions.render(vText, renderOptions)

        if (parentNode && newNode !== domNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    var updating = updateWidget(leftVNode, widget)
    var newNode

    if (updating) {
        newNode = widget.update(leftVNode, domNode) || domNode
    } else {
        newNode = renderOptions.render(widget, renderOptions)
    }

    var parentNode = domNode.parentNode

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    if (!updating) {
        destroyWidget(domNode, leftVNode)
    }

    return newNode
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, moves) {
    var childNodes = domNode.childNodes
    var keyMap = {}
    var node
    var remove
    var insert

    for (var i = 0; i < moves.removes.length; i++) {
        remove = moves.removes[i]
        node = childNodes[remove.from]
        if (remove.key) {
            keyMap[remove.key] = node
        }
        domNode.removeChild(node)
    }

    var length = childNodes.length
    for (var j = 0; j < moves.inserts.length; j++) {
        insert = moves.inserts[j]
        node = keyMap[insert.key]
        // this is the weirdest bug i've ever seen in webkit
        domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../vnode/is-widget.js":98,"../vnode/vpatch.js":101,"./apply-properties":83,"./update-widget":88}],87:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var render = require("./create-element")
var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches, renderOptions) {
    renderOptions = renderOptions || {}
    renderOptions.patch = renderOptions.patch && renderOptions.patch !== patch
        ? renderOptions.patch
        : patchRecursive
    renderOptions.render = renderOptions.render || render

    return renderOptions.patch(rootNode, patches, renderOptions)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions.document && ownerDocument !== document) {
        renderOptions.document = ownerDocument
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./create-element":84,"./dom-index":85,"./patch-op":86,"global/document":22,"x-is-array":107}],88:[function(require,module,exports){
var isWidget = require("../vnode/is-widget.js")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"../vnode/is-widget.js":98}],89:[function(require,module,exports){
'use strict';

var EvStore = require('ev-store');

module.exports = EvHook;

function EvHook(value) {
    if (!(this instanceof EvHook)) {
        return new EvHook(value);
    }

    this.value = value;
}

EvHook.prototype.hook = function (node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = this.value;
};

EvHook.prototype.unhook = function(node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = undefined;
};

},{"ev-store":17}],90:[function(require,module,exports){
'use strict';

module.exports = SoftSetHook;

function SoftSetHook(value) {
    if (!(this instanceof SoftSetHook)) {
        return new SoftSetHook(value);
    }

    this.value = value;
}

SoftSetHook.prototype.hook = function (node, propertyName) {
    if (node[propertyName] !== this.value) {
        node[propertyName] = this.value;
    }
};

},{}],91:[function(require,module,exports){
'use strict';

var isArray = require('x-is-array');

var VNode = require('../vnode/vnode.js');
var VText = require('../vnode/vtext.js');
var isVNode = require('../vnode/is-vnode');
var isVText = require('../vnode/is-vtext');
var isWidget = require('../vnode/is-widget');
var isHook = require('../vnode/is-vhook');
var isVThunk = require('../vnode/is-thunk');

var parseTag = require('./parse-tag.js');
var softSetHook = require('./hooks/soft-set-hook.js');
var evHook = require('./hooks/ev-hook.js');

module.exports = h;

function h(tagName, properties, children) {
    var childNodes = [];
    var tag, props, key, namespace;

    if (!children && isChildren(properties)) {
        children = properties;
        props = {};
    }

    props = props || properties || {};
    tag = parseTag(tagName, props);

    // support keys
    if (props.hasOwnProperty('key')) {
        key = props.key;
        props.key = undefined;
    }

    // support namespace
    if (props.hasOwnProperty('namespace')) {
        namespace = props.namespace;
        props.namespace = undefined;
    }

    // fix cursor bug
    if (tag === 'INPUT' &&
        !namespace &&
        props.hasOwnProperty('value') &&
        props.value !== undefined &&
        !isHook(props.value)
    ) {
        props.value = softSetHook(props.value);
    }

    transformProperties(props);

    if (children !== undefined && children !== null) {
        addChild(children, childNodes, tag, props);
    }


    return new VNode(tag, props, childNodes, key, namespace);
}

function addChild(c, childNodes, tag, props) {
    if (typeof c === 'string') {
        childNodes.push(new VText(c));
    } else if (typeof c === 'number') {
        childNodes.push(new VText(String(c)));
    } else if (isChild(c)) {
        childNodes.push(c);
    } else if (isArray(c)) {
        for (var i = 0; i < c.length; i++) {
            addChild(c[i], childNodes, tag, props);
        }
    } else if (c === null || c === undefined) {
        return;
    } else {
        throw UnexpectedVirtualElement({
            foreignObject: c,
            parentVnode: {
                tagName: tag,
                properties: props
            }
        });
    }
}

function transformProperties(props) {
    for (var propName in props) {
        if (props.hasOwnProperty(propName)) {
            var value = props[propName];

            if (isHook(value)) {
                continue;
            }

            if (propName.substr(0, 3) === 'ev-') {
                // add ev-foo support
                props[propName] = evHook(value);
            }
        }
    }
}

function isChild(x) {
    return isVNode(x) || isVText(x) || isWidget(x) || isVThunk(x);
}

function isChildren(x) {
    return typeof x === 'string' || isArray(x) || isChild(x);
}

function UnexpectedVirtualElement(data) {
    var err = new Error();

    err.type = 'virtual-hyperscript.unexpected.virtual-element';
    err.message = 'Unexpected virtual child passed to h().\n' +
        'Expected a VNode / Vthunk / VWidget / string but:\n' +
        'got:\n' +
        errorString(data.foreignObject) +
        '.\n' +
        'The parent vnode is:\n' +
        errorString(data.parentVnode)
        '\n' +
        'Suggested fix: change your `h(..., [ ... ])` callsite.';
    err.foreignObject = data.foreignObject;
    err.parentVnode = data.parentVnode;

    return err;
}

function errorString(obj) {
    try {
        return JSON.stringify(obj, null, '    ');
    } catch (e) {
        return String(obj);
    }
}

},{"../vnode/is-thunk":94,"../vnode/is-vhook":95,"../vnode/is-vnode":96,"../vnode/is-vtext":97,"../vnode/is-widget":98,"../vnode/vnode.js":100,"../vnode/vtext.js":102,"./hooks/ev-hook.js":89,"./hooks/soft-set-hook.js":90,"./parse-tag.js":92,"x-is-array":107}],92:[function(require,module,exports){
'use strict';

var split = require('browser-split');

var classIdSplit = /([\.#]?[a-zA-Z0-9\u007F-\uFFFF_:-]+)/;
var notClassId = /^\.|#/;

module.exports = parseTag;

function parseTag(tag, props) {
    if (!tag) {
        return 'DIV';
    }

    var noId = !(props.hasOwnProperty('id'));

    var tagParts = split(tag, classIdSplit);
    var tagName = null;

    if (notClassId.test(tagParts[1])) {
        tagName = 'DIV';
    }

    var classes, part, type, i;

    for (i = 0; i < tagParts.length; i++) {
        part = tagParts[i];

        if (!part) {
            continue;
        }

        type = part.charAt(0);

        if (!tagName) {
            tagName = part;
        } else if (type === '.') {
            classes = classes || [];
            classes.push(part.substring(1, part.length));
        } else if (type === '#' && noId) {
            props.id = part.substring(1, part.length);
        }
    }

    if (classes) {
        if (props.className) {
            classes.push(props.className);
        }

        props.className = classes.join(' ');
    }

    return props.namespace ? tagName : tagName.toUpperCase();
}

},{"browser-split":4}],93:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":94,"./is-vnode":96,"./is-vtext":97,"./is-widget":98}],94:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],95:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],96:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":99}],97:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":99}],98:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],99:[function(require,module,exports){
module.exports = "2"

},{}],100:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false
    var hasThunks = false
    var descendantHooks = false
    var hooks

    for (var propName in properties) {
        if (properties.hasOwnProperty(propName)) {
            var property = properties[propName]
            if (isVHook(property) && property.unhook) {
                if (!hooks) {
                    hooks = {}
                }

                hooks[propName] = property
            }
        }
    }

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }

            if (!hasThunks && child.hasThunks) {
                hasThunks = true
            }

            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
                descendantHooks = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        } else if (!hasThunks && isThunk(child)) {
            hasThunks = true;
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
    this.hasThunks = hasThunks
    this.hooks = hooks
    this.descendantHooks = descendantHooks
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-thunk":94,"./is-vhook":95,"./is-vnode":96,"./is-widget":98,"./version":99}],101:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":99}],102:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":99}],103:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                 diff = diff || {}
                 diff[aKey] = bValue
            } else {
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}

},{"../vnode/is-vhook":95,"is-object":27}],104:[function(require,module,exports){
var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        return
    }

    var apply = patch[index]
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                applyClear = true
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            applyClear = true
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        if (!isWidget(a)) {
            applyClear = true
        }

        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        patch[index] = apply
    }

    if (applyClear) {
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var orderedSet = reorder(aChildren, b.children)
    var bChildren = orderedSet.children

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (orderedSet.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(
            VPatch.ORDER,
            a,
            orderedSet.moves
        ))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b)
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true
        }
    }

    return false
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {
    // O(M) time, O(M) memory
    var bChildIndex = keyIndex(bChildren)
    var bKeys = bChildIndex.keys
    var bFree = bChildIndex.free

    if (bFree.length === bChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(N) time, O(N) memory
    var aChildIndex = keyIndex(aChildren)
    var aKeys = aChildIndex.keys
    var aFree = aChildIndex.free

    if (aFree.length === aChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(MAX(N, M)) memory
    var newChildren = []

    var freeIndex = 0
    var freeCount = bFree.length
    var deletedItems = 0

    // Iterate through a and match a node in b
    // O(N) time,
    for (var i = 0 ; i < aChildren.length; i++) {
        var aItem = aChildren[i]
        var itemIndex

        if (aItem.key) {
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key]
                newChildren.push(bChildren[itemIndex])

            } else {
                // Remove old keyed items
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        } else {
            // Match the item in a with the next free item in b
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++]
                newChildren.push(bChildren[itemIndex])
            } else {
                // There are no free items in b to match with
                // the free items in a, so the extra free nodes
                // are deleted.
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        }
    }

    var lastFreeIndex = freeIndex >= bFree.length ?
        bChildren.length :
        bFree[freeIndex]

    // Iterate through b and append any new keys
    // O(M) time
    for (var j = 0; j < bChildren.length; j++) {
        var newItem = bChildren[j]

        if (newItem.key) {
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newChildren.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // Add any leftover non-keyed items
            newChildren.push(newItem)
        }
    }

    var simulate = newChildren.slice()
    var simulateIndex = 0
    var removes = []
    var inserts = []
    var simulateItem

    for (var k = 0; k < bChildren.length;) {
        var wantedItem = bChildren[k]
        simulateItem = simulate[simulateIndex]

        // remove items
        while (simulateItem === null && simulate.length) {
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // if we need a key in this position...
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    if (bKeys[simulateItem.key] !== k + 1) {
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // if the remove didn't put the wanted item in place, we need to insert it
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({key: wantedItem.key, to: k})
                        }
                        // items are matching, so skip ahead
                        else {
                            simulateIndex++
                        }
                    }
                    else {
                        inserts.push({key: wantedItem.key, to: k})
                    }
                }
                else {
                    inserts.push({key: wantedItem.key, to: k})
                }
                k++
            }
            // a key in simulate has no matching wanted key, remove it
            else if (simulateItem && simulateItem.key) {
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }
        }
        else {
            simulateIndex++
            k++
        }
    }

    // remove all the remaining nodes from simulate
    while(simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    return {
        children: newChildren,
        moves: {
            removes: removes,
            inserts: inserts
        }
    }
}

function remove(arr, index, key) {
    arr.splice(index, 1)

    return {
        from: index,
        key: key
    }
}

function keyIndex(children) {
    var keys = {}
    var free = []
    var length = children.length

    for (var i = 0; i < length; i++) {
        var child = children[i]

        if (child.key) {
            keys[child.key] = i
        } else {
            free.push(i)
        }
    }

    return {
        keys: keys,     // A hash of key name to index
        free: free      // An array of unkeyed item indices
    }
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"../vnode/handle-thunk":93,"../vnode/is-thunk":94,"../vnode/is-vnode":96,"../vnode/is-vtext":97,"../vnode/is-widget":98,"../vnode/vpatch":101,"./diff-props":103,"x-is-array":107}],105:[function(require,module,exports){
var hiddenStore = require('./hidden-store.js');

module.exports = createStore;

function createStore() {
    var key = {};

    return function (obj) {
        if ((typeof obj !== 'object' || obj === null) &&
            typeof obj !== 'function'
        ) {
            throw new Error('Weakmap-shim: Key must be object')
        }

        var store = obj.valueOf(key);
        return store && store.identity === key ?
            store : hiddenStore(obj, key);
    };
}

},{"./hidden-store.js":106}],106:[function(require,module,exports){
module.exports = hiddenStore;

function hiddenStore(obj, key) {
    var store = { identity: key };
    var valueOf = obj.valueOf;

    Object.defineProperty(obj, "valueOf", {
        value: function (value) {
            return value !== key ?
                valueOf.apply(this, arguments) : store;
        },
        writable: true
    });

    return store;
}

},{}],107:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}],108:[function(require,module,exports){
"use strict";
var window = require("global/window")
var once = require("once")
var isFunction = require("is-function")
var parseHeaders = require("parse-headers")
var xtend = require("xtend")

module.exports = createXHR
createXHR.XMLHttpRequest = window.XMLHttpRequest || noop
createXHR.XDomainRequest = "withCredentials" in (new createXHR.XMLHttpRequest()) ? createXHR.XMLHttpRequest : window.XDomainRequest

forEachArray(["get", "put", "post", "patch", "head", "delete"], function(method) {
    createXHR[method === "delete" ? "del" : method] = function(uri, options, callback) {
        options = initParams(uri, options, callback)
        options.method = method.toUpperCase()
        return _createXHR(options)
    }
})

function forEachArray(array, iterator) {
    for (var i = 0; i < array.length; i++) {
        iterator(array[i])
    }
}

function isEmpty(obj){
    for(var i in obj){
        if(obj.hasOwnProperty(i)) return false
    }
    return true
}

function initParams(uri, options, callback) {
    var params = uri

    if (isFunction(options)) {
        callback = options
        if (typeof uri === "string") {
            params = {uri:uri}
        }
    } else {
        params = xtend(options, {uri: uri})
    }

    params.callback = callback
    return params
}

function createXHR(uri, options, callback) {
    options = initParams(uri, options, callback)
    return _createXHR(options)
}

function _createXHR(options) {
    var callback = options.callback
    if(typeof callback === "undefined"){
        throw new Error("callback argument missing")
    }
    callback = once(callback)

    function readystatechange() {
        if (xhr.readyState === 4) {
            loadFunc()
        }
    }

    function getBody() {
        // Chrome with requestType=blob throws errors arround when even testing access to responseText
        var body = undefined

        if (xhr.response) {
            body = xhr.response
        } else if (xhr.responseType === "text" || !xhr.responseType) {
            body = xhr.responseText || xhr.responseXML
        }

        if (isJson) {
            try {
                body = JSON.parse(body)
            } catch (e) {}
        }

        return body
    }

    var failureResponse = {
                body: undefined,
                headers: {},
                statusCode: 0,
                method: method,
                url: uri,
                rawRequest: xhr
            }

    function errorFunc(evt) {
        clearTimeout(timeoutTimer)
        if(!(evt instanceof Error)){
            evt = new Error("" + (evt || "Unknown XMLHttpRequest Error") )
        }
        evt.statusCode = 0
        callback(evt, failureResponse)
    }

    // will load the data & process the response in a special response object
    function loadFunc() {
        if (aborted) return
        var status
        clearTimeout(timeoutTimer)
        if(options.useXDR && xhr.status===undefined) {
            //IE8 CORS GET successful response doesn't have a status field, but body is fine
            status = 200
        } else {
            status = (xhr.status === 1223 ? 204 : xhr.status)
        }
        var response = failureResponse
        var err = null

        if (status !== 0){
            response = {
                body: getBody(),
                statusCode: status,
                method: method,
                headers: {},
                url: uri,
                rawRequest: xhr
            }
            if(xhr.getAllResponseHeaders){ //remember xhr can in fact be XDR for CORS in IE
                response.headers = parseHeaders(xhr.getAllResponseHeaders())
            }
        } else {
            err = new Error("Internal XMLHttpRequest Error")
        }
        callback(err, response, response.body)

    }

    var xhr = options.xhr || null

    if (!xhr) {
        if (options.cors || options.useXDR) {
            xhr = new createXHR.XDomainRequest()
        }else{
            xhr = new createXHR.XMLHttpRequest()
        }
    }

    var key
    var aborted
    var uri = xhr.url = options.uri || options.url
    var method = xhr.method = options.method || "GET"
    var body = options.body || options.data || null
    var headers = xhr.headers = options.headers || {}
    var sync = !!options.sync
    var isJson = false
    var timeoutTimer

    if ("json" in options) {
        isJson = true
        headers["accept"] || headers["Accept"] || (headers["Accept"] = "application/json") //Don't override existing accept header declared by user
        if (method !== "GET" && method !== "HEAD") {
            headers["content-type"] || headers["Content-Type"] || (headers["Content-Type"] = "application/json") //Don't override existing accept header declared by user
            body = JSON.stringify(options.json)
        }
    }

    xhr.onreadystatechange = readystatechange
    xhr.onload = loadFunc
    xhr.onerror = errorFunc
    // IE9 must have onprogress be set to a unique function.
    xhr.onprogress = function () {
        // IE must die
    }
    xhr.ontimeout = errorFunc
    xhr.open(method, uri, !sync, options.username, options.password)
    //has to be after open
    if(!sync) {
        xhr.withCredentials = !!options.withCredentials
    }
    // Cannot set timeout with sync request
    // not setting timeout on the xhr object, because of old webkits etc. not handling that correctly
    // both npm's request and jquery 1.x use this kind of timeout, so this is being consistent
    if (!sync && options.timeout > 0 ) {
        timeoutTimer = setTimeout(function(){
            aborted=true//IE9 may still call readystatechange
            xhr.abort("timeout")
            var e = new Error("XMLHttpRequest timeout")
            e.code = "ETIMEDOUT"
            errorFunc(e)
        }, options.timeout )
    }

    if (xhr.setRequestHeader) {
        for(key in headers){
            if(headers.hasOwnProperty(key)){
                xhr.setRequestHeader(key, headers[key])
            }
        }
    } else if (options.headers && !isEmpty(options.headers)) {
        throw new Error("Headers cannot be set on an XDomainRequest object")
    }

    if ("responseType" in options) {
        xhr.responseType = options.responseType
    }

    if ("beforeSend" in options &&
        typeof options.beforeSend === "function"
    ) {
        options.beforeSend(xhr)
    }

    xhr.send(body)

    return xhr


}

function noop() {}

},{"global/window":23,"is-function":26,"once":109,"parse-headers":71,"xtend":110}],109:[function(require,module,exports){
module.exports = once

once.proto = once(function () {
  Object.defineProperty(Function.prototype, 'once', {
    value: function () {
      return once(this)
    },
    configurable: true
  })
})

function once (fn) {
  var called = false
  return function () {
    if (called) return
    called = true
    return fn.apply(this, arguments)
  }
}

},{}],110:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],111:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],112:[function(require,module,exports){
var css = "@charset \"UTF-8\";\nhtml {\n  box-sizing: border-box;\n}\n*,\n*::after,\n*::before {\n  box-sizing: inherit;\n}\n.ec {\n  font-size: 14px;\n  line-height: 1.5;\n  background: #F5F5F5;\n  float: left;\n  width: 100%;\n  /*------------------------------------*    $TABLES\n\\*------------------------------------*/\n  /**\n * We have a lot at our disposal for making very complex table constructs, e.g.:\n *\n   <table class=\"table--bordered  table--striped  table--data\">\n       <colgroup>\n           <col class=t10>\n           <col class=t10>\n           <col class=t10>\n           <col>\n       </colgroup>\n       <thead>\n           <tr>\n               <th colspan=3>Foo</th>\n               <th>Bar</th>\n           </tr>\n           <tr>\n               <th>Lorem</th>\n               <th>Ipsum</th>\n               <th class=numerical>Dolor</th>\n               <th>Sit</th>\n           </tr>\n       </thead>\n       <tbody>\n           <tr>\n               <th rowspan=3>Sit</th>\n               <td>Dolor</td>\n               <td class=numerical>03.788</td>\n               <td>Lorem</td>\n           </tr>\n           <tr>\n               <td>Dolor</td>\n               <td class=numerical>32.210</td>\n               <td>Lorem</td>\n           </tr>\n           <tr>\n               <td>Dolor</td>\n               <td class=numerical>47.797</td>\n               <td>Lorem</td>\n           </tr>\n           <tr>\n               <th rowspan=2>Sit</th>\n               <td>Dolor</td>\n               <td class=numerical>09.640</td>\n               <td>Lorem</td>\n           </tr>\n           <tr>\n               <td>Dolor</td>\n               <td class=numerical>12.117</td>\n               <td>Lorem</td>\n           </tr>\n       </tbody>\n   </table>\n *\n */\n  /**\n * Cell alignments\n */\n  /**\n * In the HTML above we see several `col` elements with classes whose numbers\n * represent a percentage width for that column. We leave one column free of a\n * class so that column can soak up the effects of any accidental breakage in\n * the table.\n */\n  /* 1/8 */\n  /* 1/4 */\n  /* 1/3 */\n  /* 3/8 */\n  /* 1/2 */\n  /* 5/8 */\n  /* 2/3 */\n  /* 3/4*/\n  /* 7/8 */\n  /**\n * Bordered tables\n */\n  /**\n * Striped tables\n */\n  /**\n * Data table\n */\n  /*------------------------------------*    $BEAUTONS.CSS\n\\*------------------------------------*/\n  /**\n * beautons is a beautifully simple button toolkit.\n *\n * LICENSE\n *\n * Copyright 2013 Harry Roberts\n *\n * Licensed under the Apache License, Version 2.0 (the \"License\");\n * you may not use this file except in compliance with the License.\n * You may obtain a copy of the License at\n *\n * http://apache.org/licenses/LICENSE-2.0\n *\n * Unless required by applicable law or agreed to in writing, software\n * distributed under the License is distributed on an \"AS IS\" BASIS,\n * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n * See the License for the specific language governing permissions and\n * limitations under the License.\n *\n */\n  /*!*\n *\n * @csswizardry -- csswizardry.com/beautons\n *\n */\n  /*------------------------------------*    $BASE\n\\*------------------------------------*/\n  /**\n * Base button styles.\n *\n * 1. Allow us to better style box model properties.\n * 2. Line different sized buttons up a little nicer.\n * 3. Stop buttons wrapping and looking broken.\n * 4. Make buttons inherit font styles.\n * 5. Force all elements using beautons to appear clickable.\n * 6. Normalise box model styles.\n * 7. If the button’s text is 1em, and the button is (3 * font-size) tall, then\n *    there is 1em of space above and below that text. We therefore apply 1em\n *    of space to the left and right, as padding, to keep consistent spacing.\n * 8. Basic cosmetics for default buttons. Change or override at will.\n * 9. Don’t allow buttons to have underlines; it kinda ruins the illusion.\n */\n  /*------------------------------------*    $SIZES\n\\*------------------------------------*/\n  /**\n * Button size modifiers.\n *\n * These all follow the same sizing rules as above; text is 1em, space around it\n * remains uniform.\n */\n  /**\n * These buttons will fill the entirety of their container.\n *\n * 1. Remove padding so that widths and paddings don’t conflict.\n */\n  /*------------------------------------*    $FONT-SIZES\n\\*------------------------------------*/\n  /**\n * Button font-size modifiers.\n */\n  /**\n * Make the button inherit sizing from its parent.\n */\n  /*------------------------------------*    $FUNCTIONS\n\\*------------------------------------*/\n  /**\n * Button function modifiers.\n */\n  /**\n * Positive actions; e.g. sign in, purchase, submit, etc.\n */\n  /**\n * Negative actions; e.g. close account, delete photo, remove friend, etc.\n */\n  /**\n * Inactive, disabled buttons.\n *\n * 1. Make the button look like normal text when hovered.\n */\n  /*------------------------------------*    $STYLES\n\\*------------------------------------*/\n  /**\n * Button style modifiers.\n *\n * 1. Use an overly-large number to ensure completely rounded, pill-like ends.\n */\n  /*------------------------------------*    $HELPER\n\\*------------------------------------*/\n  /**\n * A series of helper classes to use arbitrarily. Only use a helper class if an\n * element/component doesn’t already have a class to which you could apply this\n * styling, e.g. if you need to float `.main-nav` left then add `float:left;` to\n * that ruleset as opposed to adding the `.float--left` class to the markup.\n *\n * A lot of these classes carry `!important` as you will always want them to win\n * out over other selectors.\n */\n  /**\n * Add/remove floats\n */\n  /**\n * Text alignment\n */\n  /**\n * Font weights\n */\n  /**\n * Add/remove margins\n */\n  /**\n * Add/remove paddings\n */\n  /**\n * Pull items full width of `.island` parents.\n */\n}\n.ec table {\n  width: 100%;\n}\n.ec table [contenteditable=\"true\"]:active,\n.ec table [contenteditable=\"true\"]:focus {\n  border: none;\n  outline: none;\n  background: #F5F5F5;\n}\n.ec th,\n.ec td {\n  padding: 0.375em;\n  text-align: left;\n}\n@media screen and (min-width: 480px) {\n  .ec th,\n  .ec td {\n    padding: 0.75em;\n  }\n}\n.ec [colspan] {\n  text-align: center;\n}\n.ec [colspan=\"1\"] {\n  text-align: left;\n}\n.ec [rowspan] {\n  vertical-align: middle;\n}\n.ec [rowspan=\"1\"] {\n  vertical-align: top;\n}\n.ec .numerical {\n  text-align: right;\n}\n.ec .t5 {\n  width: 5%;\n}\n.ec .t10 {\n  width: 10%;\n}\n.ec .t12 {\n  width: 12.5%;\n}\n.ec .t15 {\n  width: 15%;\n}\n.ec .t20 {\n  width: 20%;\n}\n.ec .t25 {\n  width: 25%;\n}\n.ec .t30 {\n  width: 30%;\n}\n.ec .t33 {\n  width: 33.333%;\n}\n.ec .t35 {\n  width: 35%;\n}\n.ec .t37 {\n  width: 37.5%;\n}\n.ec .t40 {\n  width: 40%;\n}\n.ec .t45 {\n  width: 45%;\n}\n.ec .t50 {\n  width: 50%;\n}\n.ec .t55 {\n  width: 55%;\n}\n.ec .t60 {\n  width: 60%;\n}\n.ec .t62 {\n  width: 62.5%;\n}\n.ec .t65 {\n  width: 65%;\n}\n.ec .t66 {\n  width: 66.666%;\n}\n.ec .t70 {\n  width: 70%;\n}\n.ec .t75 {\n  width: 75%;\n}\n.ec .t80 {\n  width: 80%;\n}\n.ec .t85 {\n  width: 85%;\n}\n.ec .t87 {\n  width: 87.5%;\n}\n.ec .t90 {\n  width: 90%;\n}\n.ec .t95 {\n  width: 95%;\n}\n.ec .table--bordered {\n  border-collapse: collapse;\n}\n.ec .table--bordered tr {\n  border: 1px solid #DDD;\n}\n.ec .table--bordered th,\n.ec .table--bordered td {\n  border-right: 1px solid #DDD;\n}\n.ec .table--bordered thead tr:last-child th {\n  border-bottom-width: 2px;\n}\n.ec .table--bordered tbody tr th:last-of-type {\n  border-right-width: 2px;\n}\n.ec .table--striped tbody tr:nth-of-type(odd) {\n  background-color: #ffc;\n  /* Override this color in your theme stylesheet */\n}\n.ec .table--data {\n  font: 12px/1.5 sans-serif;\n}\n.ec .table--disabled {\n  color: #777;\n  border-color: #777;\n}\n.ec fieldset {\n  background-color: #F5F5F5;\n  border: 1px solid #DDD;\n  margin: 0 0 0.75em;\n  padding: 1.5em;\n}\n.ec input,\n.ec label,\n.ec select {\n  display: block;\n  font-family: \"sans-serif\";\n  font-size: 14px;\n}\n.ec label {\n  font-weight: 600;\n}\n.ec label.required::after {\n  content: \"*\";\n}\n.ec label abbr {\n  display: none;\n}\n.ec input[type=\"color\"],\n.ec input[type=\"date\"],\n.ec input[type=\"datetime\"],\n.ec input[type=\"datetime-local\"],\n.ec input[type=\"email\"],\n.ec input[type=\"month\"],\n.ec input[type=\"number\"],\n.ec input[type=\"password\"],\n.ec input[type=\"search\"],\n.ec input[type=\"tel\"],\n.ec input[type=\"text\"],\n.ec input[type=\"time\"],\n.ec input[type=\"url\"],\n.ec input[type=\"week\"],\n.ec textarea,\n.ec select {\n  background-color: white;\n  border: 1px solid #bfbfbf;\n  border-radius: 3px;\n  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06);\n  box-sizing: border-box;\n  font-family: \"sans-serif\";\n  font-size: 14px;\n  padding: 0.375em;\n  transition: border-color 0.2s ease-in;\n  max-width: 100%;\n}\n.ec input[type=\"color\"]:hover,\n.ec input[type=\"date\"]:hover,\n.ec input[type=\"datetime\"]:hover,\n.ec input[type=\"datetime-local\"]:hover,\n.ec input[type=\"email\"]:hover,\n.ec input[type=\"month\"]:hover,\n.ec input[type=\"number\"]:hover,\n.ec input[type=\"password\"]:hover,\n.ec input[type=\"search\"]:hover,\n.ec input[type=\"tel\"]:hover,\n.ec input[type=\"text\"]:hover,\n.ec input[type=\"time\"]:hover,\n.ec input[type=\"url\"]:hover,\n.ec input[type=\"week\"]:hover,\n.ec textarea:hover,\n.ec select:hover {\n  border-color: #b1b1b1;\n}\n.ec input[type=\"color\"]:focus,\n.ec input[type=\"date\"]:focus,\n.ec input[type=\"datetime\"]:focus,\n.ec input[type=\"datetime-local\"]:focus,\n.ec input[type=\"email\"]:focus,\n.ec input[type=\"month\"]:focus,\n.ec input[type=\"number\"]:focus,\n.ec input[type=\"password\"]:focus,\n.ec input[type=\"search\"]:focus,\n.ec input[type=\"tel\"]:focus,\n.ec input[type=\"text\"]:focus,\n.ec input[type=\"time\"]:focus,\n.ec input[type=\"url\"]:focus,\n.ec input[type=\"week\"]:focus,\n.ec textarea:focus,\n.ec select:focus {\n  border-color: #477dca;\n  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06), 0 0 5px rgba(55, 112, 192, 0.7);\n  outline: none;\n}\n.ec input[type=\"color\"]:disabled,\n.ec input[type=\"date\"]:disabled,\n.ec input[type=\"datetime\"]:disabled,\n.ec input[type=\"datetime-local\"]:disabled,\n.ec input[type=\"email\"]:disabled,\n.ec input[type=\"month\"]:disabled,\n.ec input[type=\"number\"]:disabled,\n.ec input[type=\"password\"]:disabled,\n.ec input[type=\"search\"]:disabled,\n.ec input[type=\"tel\"]:disabled,\n.ec input[type=\"text\"]:disabled,\n.ec input[type=\"time\"]:disabled,\n.ec input[type=\"url\"]:disabled,\n.ec input[type=\"week\"]:disabled,\n.ec textarea:disabled,\n.ec select:disabled {\n  background-color: #f2f2f2;\n  cursor: not-allowed;\n}\n.ec input[type=\"color\"]:disabled:hover,\n.ec input[type=\"date\"]:disabled:hover,\n.ec input[type=\"datetime\"]:disabled:hover,\n.ec input[type=\"datetime-local\"]:disabled:hover,\n.ec input[type=\"email\"]:disabled:hover,\n.ec input[type=\"month\"]:disabled:hover,\n.ec input[type=\"number\"]:disabled:hover,\n.ec input[type=\"password\"]:disabled:hover,\n.ec input[type=\"search\"]:disabled:hover,\n.ec input[type=\"tel\"]:disabled:hover,\n.ec input[type=\"text\"]:disabled:hover,\n.ec input[type=\"time\"]:disabled:hover,\n.ec input[type=\"url\"]:disabled:hover,\n.ec input[type=\"week\"]:disabled:hover,\n.ec textarea:disabled:hover,\n.ec select:disabled:hover {\n  border: 1px solid #DDD;\n}\n.ec textarea {\n  width: 100%;\n  resize: vertical;\n}\n.ec input[type=\"search\"] {\n  appearance: none;\n}\n.ec input[type=\"checkbox\"],\n.ec input[type=\"radio\"] {\n  display: inline;\n  margin-right: 0.375em;\n}\n.ec input[type=\"checkbox\"] + label,\n.ec input[type=\"radio\"] + label {\n  display: inline-block;\n}\n.ec input[type=\"file\"] {\n  width: 100%;\n}\n.ec select {\n  max-width: 100%;\n  width: auto;\n}\n.ec .form-item {\n  width: 100%;\n  color: #333;\n  margin-bottom: 0.75em;\n}\n@media screen and (min-width: 600px) {\n  .ec .form-item {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n  }\n}\n.ec .form-item__input {\n  width: 100%;\n}\n@media screen and (min-width: 600px) {\n  .ec .form-item__input {\n    width: 60%;\n  }\n}\n.ec .form-item__label {\n  width: 100%;\n  padding-bottom: 0.75em;\n}\n@media screen and (min-width: 600px) {\n  .ec .form-item__label {\n    padding: 0;\n    width: 40%;\n    text-align: right;\n    margin-right: 1.5em;\n  }\n}\n.ec .field-group {\n  padding: 0.375em 0 0.75em 0;\n}\n.ec .field-group__title {\n  padding-bottom: 0.75em;\n}\n.ec h1 {\n  margin: 0;\n  padding: 0;\n  font-size: 28px;\n}\n.ec h2 {\n  margin: 0;\n  padding: 0;\n  font-size: 24.5px;\n}\n.ec h3 {\n  margin: 0;\n  padding: 0;\n  font-size: 21px;\n}\n.ec h4 {\n  margin: 0;\n  padding: 0;\n  font-size: 17.5px;\n}\n.ec h5 {\n  margin: 0;\n  padding: 0;\n  font-size: 15.75px;\n}\n.ec h6 {\n  margin: 0;\n  padding: 0;\n  font-size: 14px;\n}\n.ec .vertical-tabs-container {\n  margin-bottom: 1.5em;\n  overflow: hidden;\n  display: flex;\n}\n.ec .vertical-tabs-container::after {\n  clear: both;\n  content: \"\";\n  display: table;\n}\n.ec .vertical-tabs-container .vertical-tabs {\n  padding: 0;\n  margin: 0;\n  display: inline;\n  float: left;\n  width: 20%;\n  list-style: none;\n  border-right: 1px solid #DDD;\n}\n.ec .vertical-tabs-container li.active {\n  background-color: white;\n  margin-right: -1px;\n  border: 1px solid #DDD;\n  border-right-color: white;\n}\n.ec .vertical-tabs-container li.active .sub-active {\n  color: #477dca;\n}\n.ec .vertical-tabs-container li.active .sub-non-active {\n  color: #333;\n}\n.ec .vertical-tabs-container li a {\n  padding: 0.75em 0.809em;\n  text-decoration: none;\n  color: inherit;\n  display: block;\n}\n.ec .vertical-tabs-container li ul {\n  list-style: none;\n  padding: 0;\n  margin: 0;\n}\n.ec .vertical-tabs-container li ul li {\n  padding-bottom: 5px;\n  padding-left: 20px;\n}\n.ec .vertical-tabs-container .vertical-tab:focus {\n  outline: none;\n}\n.ec .vertical-tabs-container .vertical-tab-content-container {\n  border: 1px solid #DDD;\n  border-left: none;\n  display: inline-block;\n  width: 80%;\n  background-color: white;\n  margin: 0 auto;\n}\n.ec .vertical-tabs-container .vertical-tab-content-container a:focus {\n  outline: none;\n}\n.ec .vertical-tabs-container .vertical-tab-content {\n  display: inline-block;\n  background-color: white;\n  padding: 1.5em 1.618em;\n  border: none;\n  width: 100%;\n}\n.ec .vertical-tabs-container .vertical-tab-accordion-heading {\n  border-top: 1px solid #DDD;\n  cursor: pointer;\n  display: block;\n  font-weight: bold;\n  padding: 0.75em 0.809em;\n}\n.ec .vertical-tabs-container .vertical-tab-accordion-heading:hover {\n  color: #477dca;\n}\n.ec .vertical-tabs-container .vertical-tab-accordion-heading:first-child {\n  border-top: none;\n}\n.ec .vertical-tabs-container .vertical-tab-accordion-heading.active {\n  background: white;\n  border-bottom: none;\n}\n.ec .accordion-tabs-minimal {\n  margin: 0 0.75em;\n  line-height: 1.5;\n  padding: 0;\n}\n.ec .accordion-tabs-minimal::after {\n  clear: both;\n  content: \"\";\n  display: table;\n}\n.ec .accordion-tabs-minimal ul.tab-list {\n  margin: 0;\n  padding: 0;\n}\n.ec .accordion-tabs-minimal li.tab-header-and-content {\n  list-style: none;\n  display: inline;\n}\n.ec .accordion-tabs-minimal .tab-link {\n  border-top: 1px solid #DDD;\n  display: inline-block;\n  border-top: 0;\n}\n.ec .accordion-tabs-minimal .tab-link a {\n  text-decoration: none;\n  display: block;\n  padding: 0.75em 1.618em;\n}\n.ec .accordion-tabs-minimal .tab-link a:hover {\n  color: #2c5999;\n}\n.ec .accordion-tabs-minimal .tab-link a:focus {\n  outline: none;\n}\n.ec .accordion-tabs-minimal .tab-link a.is-active {\n  border: 1px solid #DDD;\n  border-bottom-color: white;\n  background: white;\n  margin-bottom: -1px;\n  color: #477dca;\n}\n.ec .accordion-tabs-minimal .tab-content {\n  border: 1px solid #DDD;\n  padding: 1.5em 1.618em;\n  width: 100%;\n  float: left;\n  background: white;\n  min-height: 250px;\n}\n.ec .btn {\n  display: inline-block;\n  /* [1] */\n  vertical-align: middle;\n  /* [2] */\n  white-space: nowrap;\n  /* [3] */\n  font-family: inherit;\n  /* [4] */\n  font-size: 100%;\n  /* [4] */\n  cursor: pointer;\n  /* [5] */\n  border: none;\n  /* [6] */\n  margin: 0;\n  /* [6] */\n  padding-top: 0;\n  /* [6] */\n  padding-bottom: 0;\n  /* [6] */\n  line-height: 3;\n  /* [7] */\n  padding-right: 1em;\n  /* [7] */\n  padding-left: 1em;\n  /* [7] */\n  border-radius: 3px;\n  /* [8] */\n  background: #477dca;\n  color: white;\n}\n.ec .btn,\n.ec .btn:hover {\n  text-decoration: none;\n  /* [9] */\n  background: #2c5999;\n}\n.ec .btn:active,\n.ec .btn:focus {\n  outline: none;\n}\n.ec .btn--small {\n  padding-right: 0.5em;\n  padding-left: 0.5em;\n  line-height: 2;\n}\n.ec .btn--large {\n  padding-right: 1.5em;\n  padding-left: 1.5em;\n  line-height: 4;\n}\n.ec .btn--huge {\n  padding-right: 2em;\n  padding-left: 2em;\n  line-height: 5;\n}\n.ec .btn--full {\n  width: 100%;\n  padding-right: 0;\n  /* [1] */\n  padding-left: 0;\n  /* [1] */\n  text-align: center;\n}\n.ec .btn--alpha {\n  font-size: 3rem;\n}\n.ec .btn--beta {\n  font-size: 2rem;\n}\n.ec .btn--gamma {\n  font-size: 1rem;\n}\n.ec .btn--natural {\n  vertical-align: baseline;\n  font-size: inherit;\n  line-height: inherit;\n  padding-right: 0.5em;\n  padding-left: 0.5em;\n}\n.ec .btn--positive {\n  background-color: #4A993E;\n  color: #fff;\n}\n.ec .btn--negative {\n  background-color: #b33630;\n  color: #fff;\n}\n.ec .btn--inactive,\n.ec .btn--inactive:hover,\n.ec .btn--inactive:active,\n.ec .btn--inactive:focus {\n  background-color: #ddd;\n  color: #777;\n  cursor: text;\n  /* [1] */\n}\n.ec .btn--soft {\n  border-radius: 200px;\n  /* [1] */\n}\n.ec .btn--hard {\n  border-radius: 0;\n}\n@media screen and (min-width: 800px) {\n  .ec .left {\n    width: 49%;\n    margin-right: 2%;\n    float: left;\n  }\n}\n@media screen and (min-width: 800px) {\n  .ec .right {\n    width: 49%;\n    float: left;\n  }\n}\n.ec .navigation {\n  padding: 0;\n  margin: 0;\n  display: block;\n}\n.ec .navigation__item {\n  margin: 20px 10px 20px 10px;\n  padding-bottom: 10px;\n  cursor: pointer;\n  display: inline-block;\n}\n.ec .navigation--steps .ec .navigation__item {\n  border-bottom: 5px solid;\n}\n.ec .float--right {\n  float: right !important;\n}\n.ec .float--left {\n  float: left !important;\n}\n.ec .float--none {\n  float: none !important;\n}\n.ec .text--left {\n  text-align: left  !important;\n}\n.ec .text--center {\n  text-align: center !important;\n}\n.ec .text--right {\n  text-align: right !important;\n}\n.ec .weight--light {\n  font-weight: 300 !important;\n}\n.ec .weight--normal {\n  font-weight: 400 !important;\n}\n.ec .weight--semibold {\n  font-weight: 600 !important;\n}\n.ec .push {\n  margin: 1.5em !important;\n}\n.ec .push--top {\n  margin-top: 1.5em !important;\n}\n.ec .push--right {\n  margin-right: 1.5em !important;\n}\n.ec .push--bottom {\n  margin-bottom: 1.5em !important;\n}\n.ec .push--left {\n  margin-left: 1.5em !important;\n}\n.ec .push--ends {\n  margin-top: 1.5em !important;\n  margin-bottom: 1.5em !important;\n}\n.ec .push--sides {\n  margin-right: 1.5em !important;\n  margin-left: 1.5em !important;\n}\n.ec .push-half {\n  margin: 0.75em !important;\n}\n.ec .push-half--top {\n  margin-top: 0.75em !important;\n}\n.ec .push-half--right {\n  margin-right: 0.75em !important;\n}\n.ec .push-half--bottom {\n  margin-bottom: 0.75em !important;\n}\n.ec .push-half--left {\n  margin-left: 0.75em !important;\n}\n.ec .push-half--ends {\n  margin-top: 0.75em !important;\n  margin-bottom: 0.75em !important;\n}\n.ec .push-half--sides {\n  margin-right: 0.75em !important;\n  margin-left: 0.75em !important;\n}\n.ec .flush {\n  margin: 0 !important;\n}\n.ec .flush--top {\n  margin-top: 0 !important;\n}\n.ec .flush--right {\n  margin-right: 0 !important;\n}\n.ec .flush--bottom {\n  margin-bottom: 0 !important;\n}\n.ec .flush--left {\n  margin-left: 0 !important;\n}\n.ec .flush--ends {\n  margin-top: 0 !important;\n  margin-bottom: 0 !important;\n}\n.ec .flush--sides {\n  margin-right: 0 !important;\n  margin-left: 0 !important;\n}\n.ec .soft {\n  padding: 1.5em !important;\n}\n.ec .soft--top {\n  padding-top: 1.5em !important;\n}\n.ec .soft--right {\n  padding-right: 1.5em !important;\n}\n.ec .soft--bottom {\n  padding-bottom: 1.5em !important;\n}\n.ec .soft--left {\n  padding-left: 1.5em !important;\n}\n.ec .soft--ends {\n  padding-top: 1.5em !important;\n  padding-bottom: 1.5em !important;\n}\n.ec .soft--sides {\n  padding-right: 1.5em !important;\n  padding-left: 1.5em !important;\n}\n.ec .soft-half {\n  padding: 0.75em !important;\n}\n.ec .soft-half--top {\n  padding-top: 0.75em !important;\n}\n.ec .soft-half--right {\n  padding-right: 0.75em !important;\n}\n.ec .soft-half--bottom {\n  padding-bottom: 0.75em !important;\n}\n.ec .soft-half--left {\n  padding-left: 0.75em !important;\n}\n.ec .soft-half--ends {\n  padding-top: 0.75em !important;\n  padding-bottom: 0.75em !important;\n}\n.ec .soft-half--sides {\n  padding-right: 0.75em !important;\n  padding-left: 0.75em !important;\n}\n.ec .hard {\n  padding: 0 !important;\n}\n.ec .hard--top {\n  padding-top: 0 !important;\n}\n.ec .hard--right {\n  padding-right: 0 !important;\n}\n.ec .hard--bottom {\n  padding-bottom: 0 !important;\n}\n.ec .hard--left {\n  padding-left: 0 !important;\n}\n.ec .hard--ends {\n  padding-top: 0 !important;\n  padding-bottom: 0 !important;\n}\n.ec .hard--sides {\n  padding-right: 0 !important;\n  padding-left: 0 !important;\n}\n.ec .full-bleed {\n  margin-right: -1.5em !important;\n  margin-left: -1.5em !important;\n}\n.islet .ec .full-bleed {\n  margin-right: -0.75em !important;\n  margin-left: -0.75em !important;\n}\n.ec .loader,\n.ec .loader:before,\n.ec .loader:after {\n  border-radius: 50%;\n}\n.ec .loader:before,\n.ec .loader:after {\n  position: absolute;\n  content: '';\n}\n.ec .loader:before {\n  width: 5.2em;\n  height: 10.2em;\n  background: #DDD;\n  border-radius: 10.2em 0 0 10.2em;\n  top: -0.1em;\n  left: -0.1em;\n  -webkit-transform-origin: 5.2em 5.1em;\n  transform-origin: 5.2em 5.1em;\n  -webkit-animation: load2 2s infinite ease 1.5s;\n  animation: load2 2s infinite ease 1.5s;\n}\n.ec .loader {\n  font-size: 11px;\n  text-indent: -99999em;\n  margin: 55px auto;\n  position: relative;\n  width: 10em;\n  height: 10em;\n  box-shadow: inset 0 0 0 1em #ffffff;\n  -webkit-transform: translateZ(0);\n  -ms-transform: translateZ(0);\n  transform: translateZ(0);\n}\n.ec .loader:after {\n  width: 5.2em;\n  height: 10.2em;\n  background: #DDD;\n  border-radius: 0 10.2em 10.2em 0;\n  top: -0.1em;\n  left: 5.1em;\n  -webkit-transform-origin: 0px 5.1em;\n  transform-origin: 0px 5.1em;\n  -webkit-animation: load2 2s infinite ease;\n  animation: load2 2s infinite ease;\n}\n@-webkit-keyframes load2 {\n  0% {\n    -webkit-transform: rotate(0deg);\n    transform: rotate(0deg);\n  }\n\n  100% {\n    -webkit-transform: rotate(360deg);\n    transform: rotate(360deg);\n  }\n}\n@keyframes load2 {\n  0% {\n    -webkit-transform: rotate(0deg);\n    transform: rotate(0deg);\n  }\n\n  100% {\n    -webkit-transform: rotate(360deg);\n    transform: rotate(360deg);\n  }\n}\n.ec a,\n.ec .hover {\n  color: #477dca;\n  cursor: pointer;\n}\n.ec .active {\n  color: #477dca;\n}\n.ec .container {\n  clear: both;\n}\n.ec .Scp {\n  position: absolute;\n  margin-top: 5px;\n  width: 200px;\n  height: 150px;\n  border: 1px solid #DDD;\n  border-radius: 3px;\n}\n.ec .header {\n  margin-bottom: 20px;\n  background-color: #333;\n  width: 100%;\n  display: inline-block;\n}\n.ec .header .logo {\n  float: right;\n  text-align: right;\n  padding: 7px 1em;\n  height: 64px;\n}\n.ec .header .logo svg {\n  height: 50px;\n}\n.ec .header .navigation {\n  margin-left: 20px;\n  margin-top: 22px;\n  float: left;\n}\n.ec .header .navigation .tab-link a {\n  text-decoration: none;\n  color: white;\n}\n.ec .header .navigation .tab-link.is-active {\n  background: #F5F5F5;\n  border: none;\n}\n.ec .header .navigation .tab-link.is-active a {\n  color: #477dca;\n}\n.ec .header:after {\n  clear: both;\n}\n.ec .revisionElement {\n  margin-top: 20px;\n  border: 1px solid #DDD;\n  background: white;\n  padding: 20px;\n  display: block;\n  float: left;\n  width: 100%;\n}\n.ec .objectArray {\n  border: 1px solid #DDD;\n  display: inline-block;\n  width: 100%;\n}\n.ec .objectArray .title {\n  width: 100%;\n  float: left;\n  padding: 7.5px 10px;\n  background: #F5F5F5;\n}\n.ec .objectArray .title h4,\n.ec .objectArray .title h5 {\n  float: left;\n}\n.ec .objectArray .title .btn {\n  float: right;\n}\n.ec .objectArray .list {\n  width: 100%;\n  float: left;\n}\n.ec .objectArray .list .item {\n  width: 100%;\n  float: left;\n}\n.ec .objectArray .list .item .title {\n  border-bottom: 1px solid #DDD;\n  border-top: 1px solid #DDD;\n}\n.ec .objectArray .list .item .options {\n  float: left;\n  width: 100%;\n  padding-top: 20px;\n}\n.ec .readOnlyBox {\n  border: 1px solid #DDD;\n  background: white;\n  padding: 10px 20px;\n  display: block;\n  margin-bottom: 10px;\n}\n.ec .titleBar {\n  display: inline-block;\n  width: 100%;\n  padding-bottom: 20px;\n}\n.ec .titleBar h3 {\n  float: left;\n}\n.ec .titleBar .btn {\n  margin-left: 10px;\n  float: right;\n}\n.ec .templatelist {\n  display: flex;\n  flex-wrap: wrap;\n}\n.ec .templatelist__item {\n  padding: 0.75em;\n  margin: 5px;\n  width: 125px;\n  cursor: pointer;\n  border: 1px solid white;\n  background: white;\n  transition: background-color ease-in 0.2s, border-color ease-in 0.2s;\n}\n.ec .templatelist__item:hover {\n  background: #F5F5F5;\n  border: 1px solid #DDD;\n}\n.ec .file_drop {\n  padding: 50px;\n  background: #DDD;\n}\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGUuY3NzIiwic291cmNlcyI6WyJzdHlsZS5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9fYm91cmJvbi5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9zZXR0aW5ncy9fcHJlZml4ZXIuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvc2V0dGluZ3MvX3B4LXRvLWVtLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL3NldHRpbmdzL19hc3NldC1waXBlbGluZS5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9mdW5jdGlvbnMvX2Fzc2lnbi1pbnB1dHMuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvZnVuY3Rpb25zL19jb250YWlucy5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9mdW5jdGlvbnMvX2NvbnRhaW5zLWZhbHN5LnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2Z1bmN0aW9ucy9faXMtbGVuZ3RoLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2Z1bmN0aW9ucy9faXMtbGlnaHQuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvZnVuY3Rpb25zL19pcy1udW1iZXIuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvZnVuY3Rpb25zL19pcy1zaXplLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2Z1bmN0aW9ucy9fcHgtdG8tZW0uc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvZnVuY3Rpb25zL19weC10by1yZW0uc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvZnVuY3Rpb25zL19zaGFkZS5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9mdW5jdGlvbnMvX3N0cmlwLXVuaXRzLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2Z1bmN0aW9ucy9fdGludC5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9mdW5jdGlvbnMvX3RyYW5zaXRpb24tcHJvcGVydHktbmFtZS5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9mdW5jdGlvbnMvX3VucGFjay5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9mdW5jdGlvbnMvX21vZHVsYXItc2NhbGUuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvaGVscGVycy9fY29udmVydC11bml0cy5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9oZWxwZXJzL19kaXJlY3Rpb25hbC12YWx1ZXMuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvaGVscGVycy9fZm9udC1zb3VyY2UtZGVjbGFyYXRpb24uc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvaGVscGVycy9fZ3JhZGllbnQtcG9zaXRpb25zLXBhcnNlci5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9oZWxwZXJzL19saW5lYXItYW5nbGUtcGFyc2VyLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2hlbHBlcnMvX2xpbmVhci1ncmFkaWVudC1wYXJzZXIuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvaGVscGVycy9fbGluZWFyLXBvc2l0aW9ucy1wYXJzZXIuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvaGVscGVycy9fbGluZWFyLXNpZGUtY29ybmVyLXBhcnNlci5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9oZWxwZXJzL19yYWRpYWwtYXJnLXBhcnNlci5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9oZWxwZXJzL19yYWRpYWwtcG9zaXRpb25zLXBhcnNlci5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9oZWxwZXJzL19yYWRpYWwtZ3JhZGllbnQtcGFyc2VyLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2hlbHBlcnMvX3JlbmRlci1ncmFkaWVudHMuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvaGVscGVycy9fc2hhcGUtc2l6ZS1zdHJpcHBlci5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9oZWxwZXJzL19zdHItdG8tbnVtLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2NzczMvX2FuaW1hdGlvbi5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9jc3MzL19hcHBlYXJhbmNlLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2NzczMvX2JhY2tmYWNlLXZpc2liaWxpdHkuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvY3NzMy9fYmFja2dyb3VuZC5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9jc3MzL19iYWNrZ3JvdW5kLWltYWdlLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2NzczMvX2JvcmRlci1pbWFnZS5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9jc3MzL19jYWxjLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2NzczMvX2NvbHVtbnMuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvY3NzMy9fZmlsdGVyLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2NzczMvX2ZsZXgtYm94LnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2NzczMvX2ZvbnQtZmFjZS5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9jc3MzL19mb250LWZlYXR1cmUtc2V0dGluZ3Muc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvY3NzMy9faGlkcGktbWVkaWEtcXVlcnkuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvY3NzMy9faHlwaGVucy5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9jc3MzL19pbWFnZS1yZW5kZXJpbmcuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvY3NzMy9fa2V5ZnJhbWVzLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2NzczMvX2xpbmVhci1ncmFkaWVudC5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9jc3MzL19wZXJzcGVjdGl2ZS5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9jc3MzL19wbGFjZWhvbGRlci5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9jc3MzL19yYWRpYWwtZ3JhZGllbnQuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvY3NzMy9fc2VsZWN0aW9uLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2NzczMvX3RleHQtZGVjb3JhdGlvbi5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9jc3MzL190cmFuc2Zvcm0uc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvY3NzMy9fdHJhbnNpdGlvbi5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9jc3MzL191c2VyLXNlbGVjdC5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9hZGRvbnMvX2JvcmRlci1jb2xvci5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9hZGRvbnMvX2JvcmRlci1yYWRpdXMuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvYWRkb25zL19ib3JkZXItc3R5bGUuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvYWRkb25zL19ib3JkZXItd2lkdGguc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvYWRkb25zL19idXR0b25zLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2FkZG9ucy9fY2xlYXJmaXguc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvYWRkb25zL19lbGxpcHNpcy5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9hZGRvbnMvX2ZvbnQtc3RhY2tzLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2FkZG9ucy9faGlkZS10ZXh0LnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2FkZG9ucy9fbWFyZ2luLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2FkZG9ucy9fcGFkZGluZy5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24vYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9hZGRvbnMvX3Bvc2l0aW9uLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2FkZG9ucy9fcHJlZml4ZXIuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvYWRkb25zL19yZXRpbmEtaW1hZ2Uuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvYWRkb25zL19zaXplLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2FkZG9ucy9fdGV4dC1pbnB1dHMuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvYWRkb25zL190aW1pbmctZnVuY3Rpb25zLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2FkZG9ucy9fdHJpYW5nbGUuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvYWRkb25zL193b3JkLXdyYXAuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uL2FwcC9hc3NldHMvc3R5bGVzaGVldHMvX2JvdXJib24tZGVwcmVjYXRlZC11cGNvbWluZy5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24tbmVhdC9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL19uZWF0LnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi1uZWF0L2FwcC9hc3NldHMvc3R5bGVzaGVldHMvX25lYXQtaGVscGVycy5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24tbmVhdC9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2Z1bmN0aW9ucy9fcHJpdmF0ZS5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24tbmVhdC9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2Z1bmN0aW9ucy9fbmV3LWJyZWFrcG9pbnQuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uLW5lYXQvYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9zZXR0aW5ncy9fZ3JpZC5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24tbmVhdC9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL3NldHRpbmdzL192aXN1YWwtZ3JpZC5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24tbmVhdC9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL3NldHRpbmdzL19kaXNhYmxlLXdhcm5pbmdzLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi1uZWF0L2FwcC9hc3NldHMvc3R5bGVzaGVldHMvZ3JpZC9fcHJpdmF0ZS5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24tbmVhdC9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2dyaWQvX2JveC1zaXppbmcuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uLW5lYXQvYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9ncmlkL19vbWVnYS5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24tbmVhdC9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2dyaWQvX291dGVyLWNvbnRhaW5lci5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24tbmVhdC9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2dyaWQvX3NwYW4tY29sdW1ucy5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24tbmVhdC9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2dyaWQvX3Jvdy5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24tbmVhdC9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2dyaWQvX3NoaWZ0LnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi1uZWF0L2FwcC9hc3NldHMvc3R5bGVzaGVldHMvZ3JpZC9fcGFkLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi1uZWF0L2FwcC9hc3NldHMvc3R5bGVzaGVldHMvZ3JpZC9fZmlsbC1wYXJlbnQuc2NzcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9ib3VyYm9uLW5lYXQvYXBwL2Fzc2V0cy9zdHlsZXNoZWV0cy9ncmlkL19tZWRpYS5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24tbmVhdC9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2dyaWQvX3RvLWRlcHJlY2F0ZS5zY3NzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2JvdXJib24tbmVhdC9hcHAvYXNzZXRzL3N0eWxlc2hlZXRzL2dyaWQvX3Zpc3VhbC1ncmlkLnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi1uZWF0L2FwcC9hc3NldHMvc3R5bGVzaGVldHMvZ3JpZC9fZGlzcGxheS1jb250ZXh0LnNjc3MiLCIuLi8uLi9ub2RlX21vZHVsZXMvYm91cmJvbi1uZWF0L2FwcC9hc3NldHMvc3R5bGVzaGVldHMvZ3JpZC9fZGlyZWN0aW9uLWNvbnRleHQuc2NzcyIsImJhc2UvX3ZhcmlhYmxlcy5zY3NzIiwiYmFzZS9fdGFibGVzLnNjc3MiLCJiYXNlL19mb3Jtcy5zY3NzIiwiYmFzZS9fdHlwZ3JhcGh5LnNjc3MiLCJjb21wb25lbnRzL192ZXJ0aWNhbC10YWJzLnNjc3MiLCJjb21wb25lbnRzL19ob3Jpem9udGFsLXRhYnMuc2NzcyIsImNvbXBvbmVudHMvX2J1dHRvbnMuc2NzcyIsImNvbXBvbmVudHMvX3N0cnVjdHVyZS5zY3NzIiwiY29tcG9uZW50cy9fbmF2aWdhdGlvbi5zY3NzIiwiY29tcG9uZW50cy9faGVscGVycy5zY3NzIiwiY29tcG9uZW50cy9fbG9hZGVyLnNjc3MiXSwic291cmNlc0NvbnRlbnQiOlsiQGltcG9ydCBcImJvdXJib25cIjtcbkBpbXBvcnQgXCJuZWF0XCI7XG5AaW1wb3J0IFwiYmFzZS92YXJpYWJsZXNcIjtcblxuLmVjIHtcbiAgZm9udC1zaXplOiAkYmFzZS1mb250LXNpemU7XG4gIGxpbmUtaGVpZ2h0OiAkYmFzZS1saW5lLWhlaWdodDtcbiAgYmFja2dyb3VuZDogJHN1cGVyLWxpZ2h0LWdyYXk7XG4gIGZsb2F0OiBsZWZ0O1xuICB3aWR0aDogMTAwJTtcbiAgQGltcG9ydCBcImJhc2UvdGFibGVzXCI7XG4gIEBpbXBvcnQgXCJiYXNlL2Zvcm1zXCI7XG4gIEBpbXBvcnQgXCJiYXNlL3R5cGdyYXBoeVwiO1xuICBAaW1wb3J0IFwiY29tcG9uZW50cy92ZXJ0aWNhbC10YWJzXCI7XG4gIEBpbXBvcnQgXCJjb21wb25lbnRzL2hvcml6b250YWwtdGFic1wiO1xuICBAaW1wb3J0IFwiY29tcG9uZW50cy9idXR0b25zXCI7XG4gIEBpbXBvcnQgXCJjb21wb25lbnRzL3N0cnVjdHVyZVwiO1xuICBAaW1wb3J0IFwiY29tcG9uZW50cy9uYXZpZ2F0aW9uXCI7XG4gIEBpbXBvcnQgXCJjb21wb25lbnRzL2hlbHBlcnNcIjtcbiAgQGltcG9ydCBcImNvbXBvbmVudHMvbG9hZGVyXCI7XG5cbiAgYSwgLmhvdmVyIHtcbiAgICBjb2xvcjogJGJhc2UtYWNjZW50LWNvbG9yO1xuICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgfVxuXG4gIC5hY3RpdmUge1xuICAgIGNvbG9yOiAkYmFzZS1hY2NlbnQtY29sb3I7XG4gIH1cblxuICAuY29udGFpbmVyIHtcbiAgICBjbGVhcjogYm90aDtcbiAgfVxuICAuU2Nwe1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICBtYXJnaW4tdG9wOiA1cHg7XG4gICAgd2lkdGg6IDIwMHB4O1xuICAgIGhlaWdodDogMTUwcHg7XG4gICAgYm9yZGVyOiAxcHggc29saWQgJGxpZ2h0LWdyYXk7XG4gICAgYm9yZGVyLXJhZGl1czogM3B4O1xuICB9XG4gIC5oZWFkZXJ7XG4gICAgbWFyZ2luLWJvdHRvbTogMjBweDtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjMzMzO1xuICAgIHdpZHRoOjEwMCU7XG4gICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xuICAgIC5sb2dvIHtcbiAgICAgIGZsb2F0OiByaWdodDtcbiAgICAgIHRleHQtYWxpZ246IHJpZ2h0O1xuICAgICAgcGFkZGluZzogN3B4IDFlbTtcbiAgICAgIGhlaWdodDogNjRweDtcbiAgICAgIHN2ZyB7XG4gICAgICAgIGhlaWdodDogNTBweDtcbiAgICAgIH1cbiAgICB9XG4gICAgLm5hdmlnYXRpb257XG4gICAgICBtYXJnaW4tbGVmdDogMjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDIycHg7XG4gICAgICBmbG9hdDogbGVmdDtcbiAgICAgIC50YWItbGluayBhe1xuICAgICAgICB0ZXh0LWRlY29yYXRpb246IG5vbmU7XG4gICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgIH1cblxuICAgICAgLnRhYi1saW5rLmlzLWFjdGl2ZXtcbiAgICAgICAgYmFja2dyb3VuZDogJHN1cGVyLWxpZ2h0LWdyYXk7XG4gICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgYXtcbiAgICAgICAgICBjb2xvcjogJGJhc2UtYWNjZW50LWNvbG9yO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgICY6YWZ0ZXJ7XG4gICAgICBjbGVhcjogYm90aDtcbiAgICB9XG4gIH1cbiAgLnJldmlzaW9uRWxlbWVudHtcbiAgICBtYXJnaW4tdG9wOiAyMHB4O1xuICAgIGJvcmRlcjogMXB4IHNvbGlkICRsaWdodC1ncmF5O1xuICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgIHBhZGRpbmc6IDIwcHg7XG4gICAgZGlzcGxheTogYmxvY2s7XG4gICAgZmxvYXQ6IGxlZnQ7XG4gICAgd2lkdGg6IDEwMCU7XG4gIH1cbiAgLm9iamVjdEFycmF5e1xuICAgIGJvcmRlcjogMXB4IHNvbGlkICRsaWdodC1ncmF5O1xuICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICB3aWR0aDogMTAwJTtcbiAgICAudGl0bGV7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICAgIGZsb2F0OiBsZWZ0O1xuICAgICAgcGFkZGluZzogNy41cHggMTBweDtcbiAgICAgIGJhY2tncm91bmQ6ICRzdXBlci1saWdodC1ncmF5O1xuICAgICAgaDQsIGg1e1xuICAgICAgICBmbG9hdDogbGVmdDtcbiAgICAgIH1cbiAgICAgIC5idG57XG4gICAgICAgIGZsb2F0OiByaWdodDtcbiAgICAgIH1cbiAgICB9XG4gICAgLmxpc3R7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICAgIGZsb2F0OiBsZWZ0O1xuICAgICAgLml0ZW17XG4gICAgICAgIC50aXRsZXtcbiAgICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgJGxpZ2h0LWdyYXk7XG4gICAgICAgICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkICRsaWdodC1ncmF5O1xuICAgICAgICB9XG4gICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICBmbG9hdDogbGVmdDtcbiAgICAgICAgLm9wdGlvbnN7XG4gICAgICAgICAgZmxvYXQ6IGxlZnQ7XG4gICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgcGFkZGluZy10b3A6IDIwcHg7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLnJlYWRPbmx5Qm94e1xuICAgIGJvcmRlcjogMXB4IHNvbGlkICRsaWdodC1ncmF5O1xuICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgIHBhZGRpbmc6IDEwcHggMjBweDtcbiAgICBkaXNwbGF5OiBibG9jaztcbiAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuICB9XG4gIC50aXRsZUJhcntcbiAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgcGFkZGluZy1ib3R0b206IDIwcHg7XG4gICAgaDN7XG4gICAgICBmbG9hdDogbGVmdDtcbiAgICB9XG4gICAgLmJ0bntcbiAgICAgIG1hcmdpbi1sZWZ0OiAxMHB4O1xuICAgICAgZmxvYXQ6IHJpZ2h0O1xuICAgIH1cbiAgfVxuICAudGVtcGxhdGVsaXN0IHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtd3JhcDogd3JhcDtcbiAgICAmX19pdGVtIHtcbiAgICAgIHBhZGRpbmc6ICRiYXNlLXNwYWNpbmcvMjtcbiAgICAgIG1hcmdpbjogNXB4O1xuICAgICAgd2lkdGg6IDEyNXB4O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgd2hpdGU7XG4gICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgIHRyYW5zaXRpb246IGJhY2tncm91bmQtY29sb3IgJGJhc2UtdGltaW5nICRiYXNlLWR1cmF0aW9uLCBib3JkZXItY29sb3IgJGJhc2UtdGltaW5nICRiYXNlLWR1cmF0aW9uO1xuICAgICAgJjpob3ZlcntcbiAgICAgICAgYmFja2dyb3VuZDogJHN1cGVyLWxpZ2h0LWdyYXk7XG4gICAgICAgIGJvcmRlcjogMXB4IHNvbGlkICRsaWdodC1ncmF5O1xuICAgICAgfVxuXG4gICAgfVxuICB9XG5cbiAgLmZpbGVfZHJvcCB7XG4gICAgcGFkZGluZzogNTBweDtcbiAgICBiYWNrZ3JvdW5kOiAkbGlnaHQtZ3JheTtcbiAgfVxuXG59XG4iLCIvLyBCb3VyYm9uIDQuMi4zXG4vLyBodHRwOi8vYm91cmJvbi5pb1xuLy8gQ29weXJpZ2h0IDIwMTEtMjAxNSB0aG91Z2h0Ym90LCBpbmMuXG4vLyBNSVQgTGljZW5zZVxuXG5AaW1wb3J0IFwic2V0dGluZ3MvcHJlZml4ZXJcIjtcbkBpbXBvcnQgXCJzZXR0aW5ncy9weC10by1lbVwiO1xuQGltcG9ydCBcInNldHRpbmdzL2Fzc2V0LXBpcGVsaW5lXCI7XG5cbkBpbXBvcnQgXCJmdW5jdGlvbnMvYXNzaWduLWlucHV0c1wiO1xuQGltcG9ydCBcImZ1bmN0aW9ucy9jb250YWluc1wiO1xuQGltcG9ydCBcImZ1bmN0aW9ucy9jb250YWlucy1mYWxzeVwiO1xuQGltcG9ydCBcImZ1bmN0aW9ucy9pcy1sZW5ndGhcIjtcbkBpbXBvcnQgXCJmdW5jdGlvbnMvaXMtbGlnaHRcIjtcbkBpbXBvcnQgXCJmdW5jdGlvbnMvaXMtbnVtYmVyXCI7XG5AaW1wb3J0IFwiZnVuY3Rpb25zL2lzLXNpemVcIjtcbkBpbXBvcnQgXCJmdW5jdGlvbnMvcHgtdG8tZW1cIjtcbkBpbXBvcnQgXCJmdW5jdGlvbnMvcHgtdG8tcmVtXCI7XG5AaW1wb3J0IFwiZnVuY3Rpb25zL3NoYWRlXCI7XG5AaW1wb3J0IFwiZnVuY3Rpb25zL3N0cmlwLXVuaXRzXCI7XG5AaW1wb3J0IFwiZnVuY3Rpb25zL3RpbnRcIjtcbkBpbXBvcnQgXCJmdW5jdGlvbnMvdHJhbnNpdGlvbi1wcm9wZXJ0eS1uYW1lXCI7XG5AaW1wb3J0IFwiZnVuY3Rpb25zL3VucGFja1wiO1xuQGltcG9ydCBcImZ1bmN0aW9ucy9tb2R1bGFyLXNjYWxlXCI7XG5cbkBpbXBvcnQgXCJoZWxwZXJzL2NvbnZlcnQtdW5pdHNcIjtcbkBpbXBvcnQgXCJoZWxwZXJzL2RpcmVjdGlvbmFsLXZhbHVlc1wiO1xuQGltcG9ydCBcImhlbHBlcnMvZm9udC1zb3VyY2UtZGVjbGFyYXRpb25cIjtcbkBpbXBvcnQgXCJoZWxwZXJzL2dyYWRpZW50LXBvc2l0aW9ucy1wYXJzZXJcIjtcbkBpbXBvcnQgXCJoZWxwZXJzL2xpbmVhci1hbmdsZS1wYXJzZXJcIjtcbkBpbXBvcnQgXCJoZWxwZXJzL2xpbmVhci1ncmFkaWVudC1wYXJzZXJcIjtcbkBpbXBvcnQgXCJoZWxwZXJzL2xpbmVhci1wb3NpdGlvbnMtcGFyc2VyXCI7XG5AaW1wb3J0IFwiaGVscGVycy9saW5lYXItc2lkZS1jb3JuZXItcGFyc2VyXCI7XG5AaW1wb3J0IFwiaGVscGVycy9yYWRpYWwtYXJnLXBhcnNlclwiO1xuQGltcG9ydCBcImhlbHBlcnMvcmFkaWFsLXBvc2l0aW9ucy1wYXJzZXJcIjtcbkBpbXBvcnQgXCJoZWxwZXJzL3JhZGlhbC1ncmFkaWVudC1wYXJzZXJcIjtcbkBpbXBvcnQgXCJoZWxwZXJzL3JlbmRlci1ncmFkaWVudHNcIjtcbkBpbXBvcnQgXCJoZWxwZXJzL3NoYXBlLXNpemUtc3RyaXBwZXJcIjtcbkBpbXBvcnQgXCJoZWxwZXJzL3N0ci10by1udW1cIjtcblxuQGltcG9ydCBcImNzczMvYW5pbWF0aW9uXCI7XG5AaW1wb3J0IFwiY3NzMy9hcHBlYXJhbmNlXCI7XG5AaW1wb3J0IFwiY3NzMy9iYWNrZmFjZS12aXNpYmlsaXR5XCI7XG5AaW1wb3J0IFwiY3NzMy9iYWNrZ3JvdW5kXCI7XG5AaW1wb3J0IFwiY3NzMy9iYWNrZ3JvdW5kLWltYWdlXCI7XG5AaW1wb3J0IFwiY3NzMy9ib3JkZXItaW1hZ2VcIjtcbkBpbXBvcnQgXCJjc3MzL2NhbGNcIjtcbkBpbXBvcnQgXCJjc3MzL2NvbHVtbnNcIjtcbkBpbXBvcnQgXCJjc3MzL2ZpbHRlclwiO1xuQGltcG9ydCBcImNzczMvZmxleC1ib3hcIjtcbkBpbXBvcnQgXCJjc3MzL2ZvbnQtZmFjZVwiO1xuQGltcG9ydCBcImNzczMvZm9udC1mZWF0dXJlLXNldHRpbmdzXCI7XG5AaW1wb3J0IFwiY3NzMy9oaWRwaS1tZWRpYS1xdWVyeVwiO1xuQGltcG9ydCBcImNzczMvaHlwaGVuc1wiO1xuQGltcG9ydCBcImNzczMvaW1hZ2UtcmVuZGVyaW5nXCI7XG5AaW1wb3J0IFwiY3NzMy9rZXlmcmFtZXNcIjtcbkBpbXBvcnQgXCJjc3MzL2xpbmVhci1ncmFkaWVudFwiO1xuQGltcG9ydCBcImNzczMvcGVyc3BlY3RpdmVcIjtcbkBpbXBvcnQgXCJjc3MzL3BsYWNlaG9sZGVyXCI7XG5AaW1wb3J0IFwiY3NzMy9yYWRpYWwtZ3JhZGllbnRcIjtcbkBpbXBvcnQgXCJjc3MzL3NlbGVjdGlvblwiO1xuQGltcG9ydCBcImNzczMvdGV4dC1kZWNvcmF0aW9uXCI7XG5AaW1wb3J0IFwiY3NzMy90cmFuc2Zvcm1cIjtcbkBpbXBvcnQgXCJjc3MzL3RyYW5zaXRpb25cIjtcbkBpbXBvcnQgXCJjc3MzL3VzZXItc2VsZWN0XCI7XG5cbkBpbXBvcnQgXCJhZGRvbnMvYm9yZGVyLWNvbG9yXCI7XG5AaW1wb3J0IFwiYWRkb25zL2JvcmRlci1yYWRpdXNcIjtcbkBpbXBvcnQgXCJhZGRvbnMvYm9yZGVyLXN0eWxlXCI7XG5AaW1wb3J0IFwiYWRkb25zL2JvcmRlci13aWR0aFwiO1xuQGltcG9ydCBcImFkZG9ucy9idXR0b25zXCI7XG5AaW1wb3J0IFwiYWRkb25zL2NsZWFyZml4XCI7XG5AaW1wb3J0IFwiYWRkb25zL2VsbGlwc2lzXCI7XG5AaW1wb3J0IFwiYWRkb25zL2ZvbnQtc3RhY2tzXCI7XG5AaW1wb3J0IFwiYWRkb25zL2hpZGUtdGV4dFwiO1xuQGltcG9ydCBcImFkZG9ucy9tYXJnaW5cIjtcbkBpbXBvcnQgXCJhZGRvbnMvcGFkZGluZ1wiO1xuQGltcG9ydCBcImFkZG9ucy9wb3NpdGlvblwiO1xuQGltcG9ydCBcImFkZG9ucy9wcmVmaXhlclwiO1xuQGltcG9ydCBcImFkZG9ucy9yZXRpbmEtaW1hZ2VcIjtcbkBpbXBvcnQgXCJhZGRvbnMvc2l6ZVwiO1xuQGltcG9ydCBcImFkZG9ucy90ZXh0LWlucHV0c1wiO1xuQGltcG9ydCBcImFkZG9ucy90aW1pbmctZnVuY3Rpb25zXCI7XG5AaW1wb3J0IFwiYWRkb25zL3RyaWFuZ2xlXCI7XG5AaW1wb3J0IFwiYWRkb25zL3dvcmQtd3JhcFwiO1xuXG5AaW1wb3J0IFwiYm91cmJvbi1kZXByZWNhdGVkLXVwY29taW5nXCI7XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbi8vLyBHbG9iYWwgdmFyaWFibGVzIHRvIGVuYWJsZSBvciBkaXNhYmxlIHZlbmRvciBwcmVmaXhlc1xuXG4kcHJlZml4LWZvci13ZWJraXQ6ICAgIHRydWUgIWRlZmF1bHQ7XG4kcHJlZml4LWZvci1tb3ppbGxhOiAgIHRydWUgIWRlZmF1bHQ7XG4kcHJlZml4LWZvci1taWNyb3NvZnQ6IHRydWUgIWRlZmF1bHQ7XG4kcHJlZml4LWZvci1vcGVyYTogICAgIHRydWUgIWRlZmF1bHQ7XG4kcHJlZml4LWZvci1zcGVjOiAgICAgIHRydWUgIWRlZmF1bHQ7XG4iLCIkZW0tYmFzZTogMTZweCAhZGVmYXVsdDtcbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIEEgZ2xvYmFsIHNldHRpbmcgdG8gZW5hYmxlIG9yIGRpc2FibGUgdGhlIGAkYXNzZXQtcGlwZWxpbmVgIHZhcmlhYmxlIGZvciBhbGwgZnVuY3Rpb25zIHRoYXQgYWNjZXB0IGl0LlxuLy8vXG4vLy8gQHR5cGUgQm9vbFxuXG4kYXNzZXQtcGlwZWxpbmU6IGZhbHNlICFkZWZhdWx0O1xuIiwiQGZ1bmN0aW9uIGFzc2lnbi1pbnB1dHMoJGlucHV0cywgJHBzZXVkbzogbnVsbCkge1xuICAkbGlzdDogKCk7XG5cbiAgQGVhY2ggJGlucHV0IGluICRpbnB1dHMge1xuICAgICRpbnB1dDogdW5xdW90ZSgkaW5wdXQpO1xuICAgICRpbnB1dDogaWYoJHBzZXVkbywgJGlucHV0ICsgXCI6XCIgKyAkcHNldWRvLCAkaW5wdXQpO1xuICAgICRsaXN0OiBhcHBlbmQoJGxpc3QsICRpbnB1dCwgY29tbWEpO1xuICB9XG5cbiAgQHJldHVybiAkbGlzdDtcbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIENoZWNrcyBpZiBhIGxpc3QgY29udGFpbnMgYSB2YWx1ZShzKS5cbi8vL1xuLy8vIEBhY2Nlc3MgcHJpdmF0ZVxuLy8vXG4vLy8gQHBhcmFtIHtMaXN0fSAkbGlzdFxuLy8vICAgVGhlIGxpc3QgdG8gY2hlY2sgYWdhaW5zdC5cbi8vL1xuLy8vIEBwYXJhbSB7TGlzdH0gJHZhbHVlc1xuLy8vICAgQSBzaW5nbGUgdmFsdWUgb3IgbGlzdCBvZiB2YWx1ZXMgdG8gY2hlY2sgZm9yLlxuLy8vXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXG4vLy8gICBjb250YWlucygkbGlzdCwgJHZhbHVlKVxuLy8vXG4vLy8gQHJldHVybiB7Qm9vbH1cblxuQGZ1bmN0aW9uIGNvbnRhaW5zKCRsaXN0LCAkdmFsdWVzLi4uKSB7XG4gIEBlYWNoICR2YWx1ZSBpbiAkdmFsdWVzIHtcbiAgICBAaWYgdHlwZS1vZihpbmRleCgkbGlzdCwgJHZhbHVlKSkgIT0gXCJudW1iZXJcIiB7XG4gICAgICBAcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIEByZXR1cm4gdHJ1ZTtcbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIENoZWNrcyBpZiBhIGxpc3QgZG9lcyBub3QgY29udGFpbnMgYSB2YWx1ZS5cbi8vL1xuLy8vIEBhY2Nlc3MgcHJpdmF0ZVxuLy8vXG4vLy8gQHBhcmFtIHtMaXN0fSAkbGlzdFxuLy8vICAgVGhlIGxpc3QgdG8gY2hlY2sgYWdhaW5zdC5cbi8vL1xuLy8vIEByZXR1cm4ge0Jvb2x9XG5cbkBmdW5jdGlvbiBjb250YWlucy1mYWxzeSgkbGlzdCkge1xuICBAZWFjaCAkaXRlbSBpbiAkbGlzdCB7XG4gICAgQGlmIG5vdCAkaXRlbSB7XG4gICAgICBAcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgQHJldHVybiBmYWxzZTtcbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIENoZWNrcyBmb3IgYSB2YWxpZCBDU1MgbGVuZ3RoLlxuLy8vXG4vLy8gQHBhcmFtIHtTdHJpbmd9ICR2YWx1ZVxuXG5AZnVuY3Rpb24gaXMtbGVuZ3RoKCR2YWx1ZSkge1xuICBAcmV0dXJuIHR5cGUtb2YoJHZhbHVlKSAhPSBcIm51bGxcIiBhbmQgKHN0ci1zbGljZSgkdmFsdWUgKyBcIlwiLCAxLCA0KSA9PSBcImNhbGNcIlxuICAgICAgIG9yIGluZGV4KGF1dG8gaW5oZXJpdCBpbml0aWFsIDAsICR2YWx1ZSlcbiAgICAgICBvciAodHlwZS1vZigkdmFsdWUpID09IFwibnVtYmVyXCIgYW5kIG5vdCh1bml0bGVzcygkdmFsdWUpKSkpO1xufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG4vLy8gUHJvZ3JhbWF0aWNhbGx5IGRldGVybWluZXMgd2hldGhlciBhIGNvbG9yIGlzIGxpZ2h0IG9yIGRhcmsuXG4vLy9cbi8vLyBAbGluayBodHRwOi8vcm9ib3RzLnRob3VnaHRib3QuY29tL2Nsb3Nlci1sb29rLWNvbG9yLWxpZ2h0bmVzc1xuLy8vXG4vLy8gQHBhcmFtIHtDb2xvciAoSGV4KX0gJGNvbG9yXG4vLy9cbi8vLyBAZXhhbXBsZSBzY3NzIC0gVXNhZ2Vcbi8vLyAgIGlzLWxpZ2h0KCRjb2xvcilcbi8vL1xuLy8vIEByZXR1cm4ge0Jvb2x9XG5cbkBmdW5jdGlvbiBpcy1saWdodCgkaGV4LWNvbG9yKSB7XG4gICQtbG9jYWwtcmVkOiByZWQocmdiYSgkaGV4LWNvbG9yLCAxKSk7XG4gICQtbG9jYWwtZ3JlZW46IGdyZWVuKHJnYmEoJGhleC1jb2xvciwgMSkpO1xuICAkLWxvY2FsLWJsdWU6IGJsdWUocmdiYSgkaGV4LWNvbG9yLCAxKSk7XG4gICQtbG9jYWwtbGlnaHRuZXNzOiAoJC1sb2NhbC1yZWQgKiAwLjIxMjYgKyAkLWxvY2FsLWdyZWVuICogMC43MTUyICsgJC1sb2NhbC1ibHVlICogMC4wNzIyKSAvIDI1NTtcblxuICBAcmV0dXJuICQtbG9jYWwtbGlnaHRuZXNzID4gMC42O1xufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG4vLy8gQ2hlY2tzIGZvciBhIHZhbGlkIG51bWJlci5cbi8vL1xuLy8vIEBwYXJhbSB7TnVtYmVyfSAkdmFsdWVcbi8vL1xuLy8vIEByZXF1aXJlIHtmdW5jdGlvbn0gY29udGFpbnNcblxuQGZ1bmN0aW9uIGlzLW51bWJlcigkdmFsdWUpIHtcbiAgQHJldHVybiBjb250YWlucyhcIjBcIiBcIjFcIiBcIjJcIiBcIjNcIiBcIjRcIiBcIjVcIiBcIjZcIiBcIjdcIiBcIjhcIiBcIjlcIiAwIDEgMiAzIDQgNSA2IDcgOCA5LCAkdmFsdWUpO1xufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG4vLy8gQ2hlY2tzIGZvciBhIHZhbGlkIENTUyBzaXplLlxuLy8vXG4vLy8gQHBhcmFtIHtTdHJpbmd9ICR2YWx1ZVxuLy8vXG4vLy8gQHJlcXVpcmUge2Z1bmN0aW9ufSBjb250YWluc1xuLy8vIEByZXF1aXJlIHtmdW5jdGlvbn0gaXMtbGVuZ3RoXG5cbkBmdW5jdGlvbiBpcy1zaXplKCR2YWx1ZSkge1xuICBAcmV0dXJuIGlzLWxlbmd0aCgkdmFsdWUpXG4gICAgICAgICAgb3IgY29udGFpbnMoXCJmaWxsXCIgXCJmaXQtY29udGVudFwiIFwibWluLWNvbnRlbnRcIiBcIm1heC1jb250ZW50XCIsICR2YWx1ZSk7XG59XG4iLCIvLyBDb252ZXJ0IHBpeGVscyB0byBlbXNcbi8vIGVnLiBmb3IgYSByZWxhdGlvbmFsIHZhbHVlIG9mIDEycHggd3JpdGUgZW0oMTIpIHdoZW4gdGhlIHBhcmVudCBpcyAxNnB4XG4vLyBpZiB0aGUgcGFyZW50IGlzIGFub3RoZXIgdmFsdWUgc2F5IDI0cHggd3JpdGUgZW0oMTIsIDI0KVxuXG5AZnVuY3Rpb24gZW0oJHB4dmFsLCAkYmFzZTogJGVtLWJhc2UpIHtcbiAgQGlmIG5vdCB1bml0bGVzcygkcHh2YWwpIHtcbiAgICAkcHh2YWw6IHN0cmlwLXVuaXRzKCRweHZhbCk7XG4gIH1cbiAgQGlmIG5vdCB1bml0bGVzcygkYmFzZSkge1xuICAgICRiYXNlOiBzdHJpcC11bml0cygkYmFzZSk7XG4gIH1cbiAgQHJldHVybiAoJHB4dmFsIC8gJGJhc2UpICogMWVtO1xufVxuIiwiLy8gQ29udmVydCBwaXhlbHMgdG8gcmVtc1xuLy8gZWcuIGZvciBhIHJlbGF0aW9uYWwgdmFsdWUgb2YgMTJweCB3cml0ZSByZW0oMTIpXG4vLyBBc3N1bWVzICRlbS1iYXNlIGlzIHRoZSBmb250LXNpemUgb2YgPGh0bWw+XG5cbkBmdW5jdGlvbiByZW0oJHB4dmFsKSB7XG4gIEBpZiBub3QgdW5pdGxlc3MoJHB4dmFsKSB7XG4gICAgJHB4dmFsOiBzdHJpcC11bml0cygkcHh2YWwpO1xuICB9XG5cbiAgJGJhc2U6ICRlbS1iYXNlO1xuICBAaWYgbm90IHVuaXRsZXNzKCRiYXNlKSB7XG4gICAgJGJhc2U6IHN0cmlwLXVuaXRzKCRiYXNlKTtcbiAgfVxuICBAcmV0dXJuICgkcHh2YWwgLyAkYmFzZSkgKiAxcmVtO1xufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG4vLy8gTWl4ZXMgYSBjb2xvciB3aXRoIGJsYWNrLlxuLy8vXG4vLy8gQHBhcmFtIHtDb2xvcn0gJGNvbG9yXG4vLy9cbi8vLyBAcGFyYW0ge051bWJlciAoUGVyY2VudGFnZSl9ICRwZXJjZW50XG4vLy8gICBUaGUgYW1vdW50IG9mIGJsYWNrIHRvIGJlIG1peGVkIGluLlxuLy8vXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIGJhY2tncm91bmQtY29sb3I6IHNoYWRlKCNmZmJiNTIsIDYwJSk7XG4vLy8gICB9XG4vLy9cbi8vLyBAZXhhbXBsZSBjc3MgLSBDU1MgT3V0cHV0XG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIGJhY2tncm91bmQtY29sb3I6ICM2NjRhMjA7XG4vLy8gICB9XG4vLy9cbi8vLyBAcmV0dXJuIHtDb2xvcn1cblxuQGZ1bmN0aW9uIHNoYWRlKCRjb2xvciwgJHBlcmNlbnQpIHtcbiAgQHJldHVybiBtaXgoIzAwMCwgJGNvbG9yLCAkcGVyY2VudCk7XG59XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbi8vLyBTdHJpcHMgdGhlIHVuaXQgZnJvbSBhIG51bWJlci5cbi8vL1xuLy8vIEBwYXJhbSB7TnVtYmVyIChXaXRoIFVuaXQpfSAkdmFsdWVcbi8vL1xuLy8vIEBleGFtcGxlIHNjc3MgLSBVc2FnZVxuLy8vICAgJGRpbWVuc2lvbjogc3RyaXAtdW5pdHMoMTBlbSk7XG4vLy9cbi8vLyBAZXhhbXBsZSBjc3MgLSBDU1MgT3V0cHV0XG4vLy8gICAkZGltZW5zaW9uOiAxMDtcbi8vL1xuLy8vIEByZXR1cm4ge051bWJlciAoVW5pdGxlc3MpfVxuXG5AZnVuY3Rpb24gc3RyaXAtdW5pdHMoJHZhbHVlKSB7XG4gIEByZXR1cm4gKCR2YWx1ZSAvICgkdmFsdWUgKiAwICsgMSkpO1xufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG4vLy8gTWl4ZXMgYSBjb2xvciB3aXRoIHdoaXRlLlxuLy8vXG4vLy8gQHBhcmFtIHtDb2xvcn0gJGNvbG9yXG4vLy9cbi8vLyBAcGFyYW0ge051bWJlciAoUGVyY2VudGFnZSl9ICRwZXJjZW50XG4vLy8gICBUaGUgYW1vdW50IG9mIHdoaXRlIHRvIGJlIG1peGVkIGluLlxuLy8vXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIGJhY2tncm91bmQtY29sb3I6IHRpbnQoIzZlY2FhNiwgNDAlKTtcbi8vLyAgIH1cbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgYmFja2dyb3VuZC1jb2xvcjogI2E4ZGZjOTtcbi8vLyAgIH1cbi8vL1xuLy8vIEByZXR1cm4ge0NvbG9yfVxuXG5AZnVuY3Rpb24gdGludCgkY29sb3IsICRwZXJjZW50KSB7XG4gIEByZXR1cm4gbWl4KCNmZmYsICRjb2xvciwgJHBlcmNlbnQpO1xufVxuIiwiLy8gUmV0dXJuIHZlbmRvci1wcmVmaXhlZCBwcm9wZXJ0eSBuYW1lcyBpZiBhcHByb3ByaWF0ZVxuLy8gRXhhbXBsZTogdHJhbnNpdGlvbi1wcm9wZXJ0eS1uYW1lcygodHJhbnNmb3JtLCBjb2xvciwgYmFja2dyb3VuZCksIG1veikgLT4gLW1vei10cmFuc2Zvcm0sIGNvbG9yLCBiYWNrZ3JvdW5kXG4vLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi8vXG5AZnVuY3Rpb24gdHJhbnNpdGlvbi1wcm9wZXJ0eS1uYW1lcygkcHJvcHMsICR2ZW5kb3I6IGZhbHNlKSB7XG4gICRuZXctcHJvcHM6ICgpO1xuXG4gIEBlYWNoICRwcm9wIGluICRwcm9wcyB7XG4gICAgJG5ldy1wcm9wczogYXBwZW5kKCRuZXctcHJvcHMsIHRyYW5zaXRpb24tcHJvcGVydHktbmFtZSgkcHJvcCwgJHZlbmRvciksIGNvbW1hKTtcbiAgfVxuXG4gIEByZXR1cm4gJG5ldy1wcm9wcztcbn1cblxuQGZ1bmN0aW9uIHRyYW5zaXRpb24tcHJvcGVydHktbmFtZSgkcHJvcCwgJHZlbmRvcjogZmFsc2UpIHtcbiAgLy8gcHV0IG90aGVyIHByb3BlcnRpZXMgdGhhdCBuZWVkIHRvIGJlIHByZWZpeGVkIGhlcmUgYXN3ZWxsXG4gIEBpZiAkdmVuZG9yIGFuZCAkcHJvcCA9PSB0cmFuc2Zvcm0ge1xuICAgIEByZXR1cm4gdW5xdW90ZSgnLScrJHZlbmRvcisnLScrJHByb3ApO1xuICB9XG4gIEBlbHNlIHtcbiAgICBAcmV0dXJuICRwcm9wO1xuICB9XG59XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbi8vLyBDb252ZXJ0cyBzaG9ydGhhbmQgdG8gdGhlIDQtdmFsdWUgc3ludGF4LlxuLy8vXG4vLy8gQHBhcmFtIHtMaXN0fSAkc2hvcnRoYW5kXG4vLy9cbi8vLyBAZXhhbXBsZSBzY3NzIC0gVXNhZ2Vcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgbWFyZ2luOiB1bnBhY2soMWVtIDJlbSk7XG4vLy8gICB9XG4vLy9cbi8vLyBAZXhhbXBsZSBjc3MgLSBDU1MgT3V0cHV0XG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIG1hcmdpbjogMWVtIDJlbSAxZW0gMmVtO1xuLy8vICAgfVxuXG5AZnVuY3Rpb24gdW5wYWNrKCRzaG9ydGhhbmQpIHtcbiAgQGlmIGxlbmd0aCgkc2hvcnRoYW5kKSA9PSAxIHtcbiAgICBAcmV0dXJuIG50aCgkc2hvcnRoYW5kLCAxKSBudGgoJHNob3J0aGFuZCwgMSkgbnRoKCRzaG9ydGhhbmQsIDEpIG50aCgkc2hvcnRoYW5kLCAxKTtcbiAgfSBAZWxzZSBpZiBsZW5ndGgoJHNob3J0aGFuZCkgPT0gMiB7XG4gICAgQHJldHVybiBudGgoJHNob3J0aGFuZCwgMSkgbnRoKCRzaG9ydGhhbmQsIDIpIG50aCgkc2hvcnRoYW5kLCAxKSBudGgoJHNob3J0aGFuZCwgMik7XG4gIH0gQGVsc2UgaWYgbGVuZ3RoKCRzaG9ydGhhbmQpID09IDMge1xuICAgIEByZXR1cm4gbnRoKCRzaG9ydGhhbmQsIDEpIG50aCgkc2hvcnRoYW5kLCAyKSBudGgoJHNob3J0aGFuZCwgMykgbnRoKCRzaG9ydGhhbmQsIDIpO1xuICB9IEBlbHNlIHtcbiAgICBAcmV0dXJuICRzaG9ydGhhbmQ7XG4gIH1cbn1cbiIsIi8vIFNjYWxpbmcgVmFyaWFibGVzXG4kZ29sZGVuOiAgICAgICAgICAgMS42MTg7XG4kbWlub3Itc2Vjb25kOiAgICAgMS4wNjc7XG4kbWFqb3Itc2Vjb25kOiAgICAgMS4xMjU7XG4kbWlub3ItdGhpcmQ6ICAgICAgMS4yO1xuJG1ham9yLXRoaXJkOiAgICAgIDEuMjU7XG4kcGVyZmVjdC1mb3VydGg6ICAgMS4zMzM7XG4kYXVnbWVudGVkLWZvdXJ0aDogMS40MTQ7XG4kcGVyZmVjdC1maWZ0aDogICAgMS41O1xuJG1pbm9yLXNpeHRoOiAgICAgIDEuNjtcbiRtYWpvci1zaXh0aDogICAgICAxLjY2NztcbiRtaW5vci1zZXZlbnRoOiAgICAxLjc3ODtcbiRtYWpvci1zZXZlbnRoOiAgICAxLjg3NTtcbiRvY3RhdmU6ICAgICAgICAgICAyO1xuJG1ham9yLXRlbnRoOiAgICAgIDIuNTtcbiRtYWpvci1lbGV2ZW50aDogICAyLjY2NztcbiRtYWpvci10d2VsZnRoOiAgICAzO1xuJGRvdWJsZS1vY3RhdmU6ICAgIDQ7XG5cbiRtb2R1bGFyLXNjYWxlLXJhdGlvOiAkcGVyZmVjdC1mb3VydGggIWRlZmF1bHQ7XG4kbW9kdWxhci1zY2FsZS1iYXNlOiBlbSgkZW0tYmFzZSkgIWRlZmF1bHQ7XG5cbkBmdW5jdGlvbiBtb2R1bGFyLXNjYWxlKCRpbmNyZW1lbnQsICR2YWx1ZTogJG1vZHVsYXItc2NhbGUtYmFzZSwgJHJhdGlvOiAkbW9kdWxhci1zY2FsZS1yYXRpbykge1xuICAkdjE6IG50aCgkdmFsdWUsIDEpO1xuICAkdjI6IG50aCgkdmFsdWUsIGxlbmd0aCgkdmFsdWUpKTtcbiAgJHZhbHVlOiAkdjE7XG5cbiAgLy8gc2NhbGUgJHYyIHRvIGp1c3QgYWJvdmUgJHYxXG4gIEB3aGlsZSAkdjIgPiAkdjEge1xuICAgICR2MjogKCR2MiAvICRyYXRpbyk7IC8vIHdpbGwgYmUgb2ZmLWJ5LTFcbiAgfVxuICBAd2hpbGUgJHYyIDwgJHYxIHtcbiAgICAkdjI6ICgkdjIgKiAkcmF0aW8pOyAvLyB3aWxsIGZpeCBvZmYtYnktMVxuICB9XG5cbiAgLy8gY2hlY2sgQUZURVIgc2NhbGluZyAkdjIgdG8gcHJldmVudCBkb3VibGUtY291bnRpbmcgY29ybmVyLWNhc2VcbiAgJGRvdWJsZS1zdHJhbmRlZDogJHYyID4gJHYxO1xuXG4gIEBpZiAkaW5jcmVtZW50ID4gMCB7XG4gICAgQGZvciAkaSBmcm9tIDEgdGhyb3VnaCAkaW5jcmVtZW50IHtcbiAgICAgIEBpZiAkZG91YmxlLXN0cmFuZGVkIGFuZCAoJHYxICogJHJhdGlvKSA+ICR2MiB7XG4gICAgICAgICR2YWx1ZTogJHYyO1xuICAgICAgICAkdjI6ICgkdjIgKiAkcmF0aW8pO1xuICAgICAgfSBAZWxzZSB7XG4gICAgICAgICR2MTogKCR2MSAqICRyYXRpbyk7XG4gICAgICAgICR2YWx1ZTogJHYxO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIEBpZiAkaW5jcmVtZW50IDwgMCB7XG4gICAgLy8gYWRqdXN0ICR2MiB0byBqdXN0IGJlbG93ICR2MVxuICAgIEBpZiAkZG91YmxlLXN0cmFuZGVkIHtcbiAgICAgICR2MjogKCR2MiAvICRyYXRpbyk7XG4gICAgfVxuXG4gICAgQGZvciAkaSBmcm9tICRpbmNyZW1lbnQgdGhyb3VnaCAtMSB7XG4gICAgICBAaWYgJGRvdWJsZS1zdHJhbmRlZCBhbmQgKCR2MSAvICRyYXRpbykgPCAkdjIge1xuICAgICAgICAkdmFsdWU6ICR2MjtcbiAgICAgICAgJHYyOiAoJHYyIC8gJHJhdGlvKTtcbiAgICAgIH0gQGVsc2Uge1xuICAgICAgICAkdjE6ICgkdjEgLyAkcmF0aW8pO1xuICAgICAgICAkdmFsdWU6ICR2MTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBAcmV0dXJuICR2YWx1ZTtcbn1cbiIsIi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqLy9cbi8vIEhlbHBlciBmdW5jdGlvbiBmb3Igc3RyLXRvLW51bSBmbi5cbi8vIFNvdXJjZTogaHR0cDovL3Nhc3NtZWlzdGVyLmNvbS9naXN0Lzk2NDc0MDhcbi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqLy9cbkBmdW5jdGlvbiBfY29udmVydC11bml0cygkbnVtYmVyLCAkdW5pdCkge1xuICAkc3RyaW5nczogXCJweFwiLCBcImNtXCIsIFwibW1cIiwgXCIlXCIsIFwiY2hcIiwgXCJwaWNhXCIsIFwiaW5cIiwgXCJlbVwiLCBcInJlbVwiLCBcInB0XCIsIFwicGNcIiwgXCJleFwiLCBcInZ3XCIsIFwidmhcIiwgXCJ2bWluXCIsIFwidm1heFwiLCBcImRlZ1wiLCBcInJhZFwiLCBcImdyYWRcIiwgXCJ0dXJuXCI7XG4gICR1bml0czogICAxcHgsIDFjbSwgMW1tLCAxJSwgMWNoLCAxcGljYSwgMWluLCAxZW0sIDFyZW0sIDFwdCwgMXBjLCAxZXgsIDF2dywgMXZoLCAxdm1pbiwgMXZtYXgsIDFkZWcsIDFyYWQsIDFncmFkLCAxdHVybjtcbiAgJGluZGV4OiBpbmRleCgkc3RyaW5ncywgJHVuaXQpO1xuXG4gIEBpZiBub3QgJGluZGV4IHtcbiAgICBAd2FybiBcIlVua25vd24gdW5pdCBgI3skdW5pdH1gLlwiO1xuICAgIEByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBAaWYgdHlwZS1vZigkbnVtYmVyKSAhPSBcIm51bWJlclwiIHtcbiAgICBAd2FybiBcImAjeyRudW1iZXJ9IGlzIG5vdCBhIG51bWJlcmBcIjtcbiAgICBAcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgQHJldHVybiAkbnVtYmVyICogbnRoKCR1bml0cywgJGluZGV4KTtcbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIERpcmVjdGlvbmFsLXByb3BlcnR5IG1peGlucyBhcmUgc2hvcnRoYW5kcyBmb3Igd3JpdGluZyBwcm9wZXJ0aWVzIGxpa2UgdGhlIGZvbGxvd2luZ1xuLy8vXG4vLy8gQGlnbm9yZSBZb3UgY2FuIGFsc28gdXNlIGBmYWxzZWAgaW5zdGVhZCBvZiBgbnVsbGAuXG4vLy9cbi8vLyBAcGFyYW0ge0xpc3R9ICR2YWxzXG4vLy8gICBMaXN0IG9mIGRpcmVjdGlvbmFsIHZhbHVlc1xuLy8vXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIEBpbmNsdWRlIGJvcmRlci1zdHlsZShkb3R0ZWQgbnVsbCk7XG4vLy8gICAgIEBpbmNsdWRlIG1hcmdpbihudWxsIDAgMTBweCk7XG4vLy8gICB9XG4vLy9cbi8vLyBAZXhhbXBsZSBjc3MgLSBDU1MgT3V0cHV0XG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIGJvcmRlci1ib3R0b20tc3R5bGU6IGRvdHRlZDtcbi8vLyAgICAgYm9yZGVyLXRvcC1zdHlsZTogZG90dGVkO1xuLy8vICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuLy8vICAgICBtYXJnaW4tbGVmdDogMDtcbi8vLyAgICAgbWFyZ2luLXJpZ2h0OiAwO1xuLy8vICAgfVxuLy8vXG4vLy8gQHJlcXVpcmUge2Z1bmN0aW9ufSBjb250YWlucy1mYWxzeVxuLy8vXG4vLy8gQHJldHVybiB7TGlzdH1cblxuQGZ1bmN0aW9uIGNvbGxhcHNlLWRpcmVjdGlvbmFscygkdmFscykge1xuICAkb3V0cHV0OiBudWxsO1xuXG4gICRhOiBudGgoJHZhbHMsIDEpO1xuICAkYjogaWYobGVuZ3RoKCR2YWxzKSA8IDIsICRhLCBudGgoJHZhbHMsIDIpKTtcbiAgJGM6IGlmKGxlbmd0aCgkdmFscykgPCAzLCAkYSwgbnRoKCR2YWxzLCAzKSk7XG4gICRkOiBpZihsZW5ndGgoJHZhbHMpIDwgMiwgJGEsIG50aCgkdmFscywgaWYobGVuZ3RoKCR2YWxzKSA8IDQsIDIsIDQpKSk7XG5cbiAgQGlmICRhID09IDAgeyAkYTogMDsgfVxuICBAaWYgJGIgPT0gMCB7ICRiOiAwOyB9XG4gIEBpZiAkYyA9PSAwIHsgJGM6IDA7IH1cbiAgQGlmICRkID09IDAgeyAkZDogMDsgfVxuXG4gIEBpZiAkYSA9PSAkYiBhbmQgJGEgPT0gJGMgYW5kICRhID09ICRkIHsgJG91dHB1dDogJGE7ICAgICAgICAgIH1cbiAgQGVsc2UgaWYgJGEgPT0gJGMgYW5kICRiID09ICRkICAgICAgICAgeyAkb3V0cHV0OiAkYSAkYjsgICAgICAgfVxuICBAZWxzZSBpZiAkYiA9PSAkZCAgICAgICAgICAgICAgICAgICAgICB7ICRvdXRwdXQ6ICRhICRiICRjOyAgICB9XG4gIEBlbHNlICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgJG91dHB1dDogJGEgJGIgJGMgJGQ7IH1cblxuICBAcmV0dXJuICRvdXRwdXQ7XG59XG5cbi8vLyBPdXRwdXQgZGlyZWN0aW9uYWwgcHJvcGVydGllcywgZm9yIGluc3RhbmNlIGBtYXJnaW5gLlxuLy8vXG4vLy8gQGFjY2VzcyBwcml2YXRlXG4vLy9cbi8vLyBAcGFyYW0ge1N0cmluZ30gJHByZVxuLy8vICAgUHJlZml4IHRvIHVzZVxuLy8vIEBwYXJhbSB7U3RyaW5nfSAkc3VmXG4vLy8gICBTdWZmaXggdG8gdXNlXG4vLy8gQHBhcmFtIHtMaXN0fSAkdmFsc1xuLy8vICAgTGlzdCBvZiB2YWx1ZXNcbi8vL1xuLy8vIEByZXF1aXJlIHtmdW5jdGlvbn0gY29sbGFwc2UtZGlyZWN0aW9uYWxzXG4vLy8gQHJlcXVpcmUge2Z1bmN0aW9ufSBjb250YWlucy1mYWxzeVxuXG5AbWl4aW4gZGlyZWN0aW9uYWwtcHJvcGVydHkoJHByZSwgJHN1ZiwgJHZhbHMpIHtcbiAgLy8gUHJvcGVydHkgTmFtZXNcbiAgJHRvcDogICAgJHByZSArIFwiLXRvcFwiICAgICsgaWYoJHN1ZiwgXCItI3skc3VmfVwiLCBcIlwiKTtcbiAgJGJvdHRvbTogJHByZSArIFwiLWJvdHRvbVwiICsgaWYoJHN1ZiwgXCItI3skc3VmfVwiLCBcIlwiKTtcbiAgJGxlZnQ6ICAgJHByZSArIFwiLWxlZnRcIiAgICsgaWYoJHN1ZiwgXCItI3skc3VmfVwiLCBcIlwiKTtcbiAgJHJpZ2h0OiAgJHByZSArIFwiLXJpZ2h0XCIgICsgaWYoJHN1ZiwgXCItI3skc3VmfVwiLCBcIlwiKTtcbiAgJGFsbDogICAgJHByZSArICAgICAgICAgICAgIGlmKCRzdWYsIFwiLSN7JHN1Zn1cIiwgXCJcIik7XG5cbiAgJHZhbHM6IGNvbGxhcHNlLWRpcmVjdGlvbmFscygkdmFscyk7XG5cbiAgQGlmIGNvbnRhaW5zLWZhbHN5KCR2YWxzKSB7XG4gICAgQGlmIG50aCgkdmFscywgMSkgeyAjeyR0b3B9OiBudGgoJHZhbHMsIDEpOyB9XG5cbiAgICBAaWYgbGVuZ3RoKCR2YWxzKSA9PSAxIHtcbiAgICAgIEBpZiBudGgoJHZhbHMsIDEpIHsgI3skcmlnaHR9OiBudGgoJHZhbHMsIDEpOyB9XG4gICAgfSBAZWxzZSB7XG4gICAgICBAaWYgbnRoKCR2YWxzLCAyKSB7ICN7JHJpZ2h0fTogbnRoKCR2YWxzLCAyKTsgfVxuICAgIH1cblxuICAgIEBpZiBsZW5ndGgoJHZhbHMpID09IDIge1xuICAgICAgQGlmIG50aCgkdmFscywgMSkgeyAjeyRib3R0b219OiBudGgoJHZhbHMsIDEpOyB9XG4gICAgICBAaWYgbnRoKCR2YWxzLCAyKSB7ICN7JGxlZnR9OiAgIG50aCgkdmFscywgMik7IH1cbiAgICB9IEBlbHNlIGlmIGxlbmd0aCgkdmFscykgPT0gMyB7XG4gICAgICBAaWYgbnRoKCR2YWxzLCAzKSB7ICN7JGJvdHRvbX06IG50aCgkdmFscywgMyk7IH1cbiAgICAgIEBpZiBudGgoJHZhbHMsIDIpIHsgI3skbGVmdH06ICAgbnRoKCR2YWxzLCAyKTsgfVxuICAgIH0gQGVsc2UgaWYgbGVuZ3RoKCR2YWxzKSA9PSA0IHtcbiAgICAgIEBpZiBudGgoJHZhbHMsIDMpIHsgI3skYm90dG9tfTogbnRoKCR2YWxzLCAzKTsgfVxuICAgICAgQGlmIG50aCgkdmFscywgNCkgeyAjeyRsZWZ0fTogICBudGgoJHZhbHMsIDQpOyB9XG4gICAgfVxuICB9IEBlbHNlIHtcbiAgICAjeyRhbGx9OiAkdmFscztcbiAgfVxufVxuIiwiLy8gVXNlZCBmb3IgY3JlYXRpbmcgdGhlIHNvdXJjZSBzdHJpbmcgZm9yIGZvbnRzIHVzaW5nIEBmb250LWZhY2Vcbi8vIFJlZmVyZW5jZTogaHR0cDovL2dvby5nbC9SdTFiS1BcblxuQGZ1bmN0aW9uIGZvbnQtdXJsLXByZWZpeGVyKCRhc3NldC1waXBlbGluZSkge1xuICBAaWYgJGFzc2V0LXBpcGVsaW5lID09IHRydWUge1xuICAgIEByZXR1cm4gZm9udC11cmw7XG4gIH0gQGVsc2Uge1xuICAgIEByZXR1cm4gdXJsO1xuICB9XG59XG5cbkBmdW5jdGlvbiBmb250LXNvdXJjZS1kZWNsYXJhdGlvbihcbiAgJGZvbnQtZmFtaWx5LFxuICAkZmlsZS1wYXRoLFxuICAkYXNzZXQtcGlwZWxpbmUsXG4gICRmaWxlLWZvcm1hdHMsXG4gICRmb250LXVybCkge1xuXG4gICRzcmM6ICgpO1xuXG4gICRmb3JtYXRzLW1hcDogKFxuICAgIGVvdDogICBcIiN7JGZpbGUtcGF0aH0uZW90PyNpZWZpeFwiIGZvcm1hdChcImVtYmVkZGVkLW9wZW50eXBlXCIpLFxuICAgIHdvZmYyOiBcIiN7JGZpbGUtcGF0aH0ud29mZjJcIiBmb3JtYXQoXCJ3b2ZmMlwiKSxcbiAgICB3b2ZmOiAgXCIjeyRmaWxlLXBhdGh9LndvZmZcIiBmb3JtYXQoXCJ3b2ZmXCIpLFxuICAgIHR0ZjogICBcIiN7JGZpbGUtcGF0aH0udHRmXCIgZm9ybWF0KFwidHJ1ZXR5cGVcIiksXG4gICAgc3ZnOiAgIFwiI3skZmlsZS1wYXRofS5zdmcjI3skZm9udC1mYW1pbHl9XCIgZm9ybWF0KFwic3ZnXCIpXG4gICk7XG5cbiAgQGVhY2ggJGtleSwgJHZhbHVlcyBpbiAkZm9ybWF0cy1tYXAge1xuICAgIEBpZiBjb250YWlucygkZmlsZS1mb3JtYXRzLCAka2V5KSB7XG4gICAgICAkZmlsZS1wYXRoOiBudGgoJHZhbHVlcywgMSk7XG4gICAgICAkZm9udC1mb3JtYXQ6IG50aCgkdmFsdWVzLCAyKTtcblxuICAgICAgQGlmICRhc3NldC1waXBlbGluZSA9PSB0cnVlIHtcbiAgICAgICAgJHNyYzogYXBwZW5kKCRzcmMsIGZvbnQtdXJsKCRmaWxlLXBhdGgpICRmb250LWZvcm1hdCwgY29tbWEpO1xuICAgICAgfSBAZWxzZSB7XG4gICAgICAgICRzcmM6IGFwcGVuZCgkc3JjLCB1cmwoJGZpbGUtcGF0aCkgJGZvbnQtZm9ybWF0LCBjb21tYSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgQHJldHVybiAkc3JjO1xufVxuIiwiQGZ1bmN0aW9uIF9ncmFkaWVudC1wb3NpdGlvbnMtcGFyc2VyKCRncmFkaWVudC10eXBlLCAkZ3JhZGllbnQtcG9zaXRpb25zKSB7XG4gIEBpZiAkZ3JhZGllbnQtcG9zaXRpb25zXG4gIGFuZCAoJGdyYWRpZW50LXR5cGUgPT0gbGluZWFyKVxuICBhbmQgKHR5cGUtb2YoJGdyYWRpZW50LXBvc2l0aW9ucykgIT0gY29sb3IpIHtcbiAgICAkZ3JhZGllbnQtcG9zaXRpb25zOiBfbGluZWFyLXBvc2l0aW9ucy1wYXJzZXIoJGdyYWRpZW50LXBvc2l0aW9ucyk7XG4gIH1cbiAgQGVsc2UgaWYgJGdyYWRpZW50LXBvc2l0aW9uc1xuICBhbmQgKCRncmFkaWVudC10eXBlID09IHJhZGlhbClcbiAgYW5kICh0eXBlLW9mKCRncmFkaWVudC1wb3NpdGlvbnMpICE9IGNvbG9yKSB7XG4gICAgJGdyYWRpZW50LXBvc2l0aW9uczogX3JhZGlhbC1wb3NpdGlvbnMtcGFyc2VyKCRncmFkaWVudC1wb3NpdGlvbnMpO1xuICB9XG4gIEByZXR1cm4gJGdyYWRpZW50LXBvc2l0aW9ucztcbn1cbiIsIi8vIFByaXZhdGUgZnVuY3Rpb24gZm9yIGxpbmVhci1ncmFkaWVudC1wYXJzZXJcbkBmdW5jdGlvbiBfbGluZWFyLWFuZ2xlLXBhcnNlcigkaW1hZ2UsICRmaXJzdC12YWwsICRwcmVmaXgsICRzdWZmaXgpIHtcbiAgJG9mZnNldDogbnVsbDtcbiAgJHVuaXQtc2hvcnQ6ICBzdHItc2xpY2UoJGZpcnN0LXZhbCwgc3RyLWxlbmd0aCgkZmlyc3QtdmFsKSAtIDIsIHN0ci1sZW5ndGgoJGZpcnN0LXZhbCkpO1xuICAkdW5pdC1sb25nOiAgIHN0ci1zbGljZSgkZmlyc3QtdmFsLCBzdHItbGVuZ3RoKCRmaXJzdC12YWwpIC0gMywgc3RyLWxlbmd0aCgkZmlyc3QtdmFsKSk7XG5cbiAgQGlmICgkdW5pdC1sb25nID09IFwiZ3JhZFwiKSBvclxuICAgICAgKCR1bml0LWxvbmcgPT0gXCJ0dXJuXCIpIHtcbiAgICAkb2Zmc2V0OiBpZigkdW5pdC1sb25nID09IFwiZ3JhZFwiLCAtMTAwZ3JhZCAqIDMsIC0wLjc1dHVybik7XG4gIH1cblxuICBAZWxzZSBpZiAoJHVuaXQtc2hvcnQgPT0gXCJkZWdcIikgb3JcbiAgICAgICAgICAgKCR1bml0LXNob3J0ID09IFwicmFkXCIpIHtcbiAgICAkb2Zmc2V0OiBpZigkdW5pdC1zaG9ydCA9PSBcImRlZ1wiLCAtOTAgKiAzLCAxLjZyYWQpO1xuICB9XG5cbiAgQGlmICRvZmZzZXQge1xuICAgICRudW06IF9zdHItdG8tbnVtKCRmaXJzdC12YWwpO1xuXG4gICAgQHJldHVybiAoXG4gICAgICB3ZWJraXQtaW1hZ2U6IC13ZWJraXQtICsgJHByZWZpeCArICgkb2Zmc2V0IC0gJG51bSkgKyAkc3VmZml4LFxuICAgICAgc3BlYy1pbWFnZTogJGltYWdlXG4gICAgKTtcbiAgfVxufVxuIiwiQGZ1bmN0aW9uIF9saW5lYXItZ3JhZGllbnQtcGFyc2VyKCRpbWFnZSkge1xuICAkaW1hZ2U6IHVucXVvdGUoJGltYWdlKTtcbiAgJGdyYWRpZW50czogKCk7XG4gICRzdGFydDogc3RyLWluZGV4KCRpbWFnZSwgXCIoXCIpO1xuICAkZW5kOiBzdHItaW5kZXgoJGltYWdlLCBcIixcIik7XG4gICRmaXJzdC12YWw6IHN0ci1zbGljZSgkaW1hZ2UsICRzdGFydCArIDEsICRlbmQgLSAxKTtcblxuICAkcHJlZml4OiBzdHItc2xpY2UoJGltYWdlLCAwLCAkc3RhcnQpO1xuICAkc3VmZml4OiBzdHItc2xpY2UoJGltYWdlLCAkZW5kLCBzdHItbGVuZ3RoKCRpbWFnZSkpO1xuXG4gICRoYXMtbXVsdGlwbGUtdmFsczogc3RyLWluZGV4KCRmaXJzdC12YWwsIFwiIFwiKTtcbiAgJGhhcy1zaW5nbGUtcG9zaXRpb246IHVucXVvdGUoX3Bvc2l0aW9uLWZsaXBwZXIoJGZpcnN0LXZhbCkgKyBcIlwiKTtcbiAgJGhhcy1hbmdsZTogaXMtbnVtYmVyKHN0ci1zbGljZSgkZmlyc3QtdmFsLCAwLCAwKSk7XG5cbiAgQGlmICRoYXMtbXVsdGlwbGUtdmFscyB7XG4gICAgJGdyYWRpZW50czogX2xpbmVhci1zaWRlLWNvcm5lci1wYXJzZXIoJGltYWdlLCAkZmlyc3QtdmFsLCAkcHJlZml4LCAkc3VmZml4LCAkaGFzLW11bHRpcGxlLXZhbHMpO1xuICB9XG5cbiAgQGVsc2UgaWYgJGhhcy1zaW5nbGUtcG9zaXRpb24gIT0gXCJcIiB7XG4gICAgJHBvczogdW5xdW90ZSgkaGFzLXNpbmdsZS1wb3NpdGlvbiArIFwiXCIpO1xuXG4gICAgJGdyYWRpZW50czogKFxuICAgICAgd2Via2l0LWltYWdlOiAtd2Via2l0LSArICRpbWFnZSxcbiAgICAgIHNwZWMtaW1hZ2U6ICRwcmVmaXggKyBcInRvIFwiICsgJHBvcyArICRzdWZmaXhcbiAgICApO1xuICB9XG5cbiAgQGVsc2UgaWYgJGhhcy1hbmdsZSB7XG4gICAgLy8gUm90YXRlIGRlZ3JlZSBmb3Igd2Via2l0XG4gICAgJGdyYWRpZW50czogX2xpbmVhci1hbmdsZS1wYXJzZXIoJGltYWdlLCAkZmlyc3QtdmFsLCAkcHJlZml4LCAkc3VmZml4KTtcbiAgfVxuXG4gIEBlbHNlIHtcbiAgICAkZ3JhZGllbnRzOiAoXG4gICAgICB3ZWJraXQtaW1hZ2U6IC13ZWJraXQtICsgJGltYWdlLFxuICAgICAgc3BlYy1pbWFnZTogJGltYWdlXG4gICAgKTtcbiAgfVxuXG4gIEByZXR1cm4gJGdyYWRpZW50cztcbn1cbiIsIkBmdW5jdGlvbiBfbGluZWFyLXBvc2l0aW9ucy1wYXJzZXIoJHBvcykge1xuICAkdHlwZTogdHlwZS1vZihudGgoJHBvcywgMSkpO1xuICAkc3BlYzogbnVsbDtcbiAgJGRlZ3JlZTogbnVsbDtcbiAgJHNpZGU6IG51bGw7XG4gICRjb3JuZXI6IG51bGw7XG4gICRsZW5ndGg6IGxlbmd0aCgkcG9zKTtcbiAgLy8gUGFyc2UgU2lkZSBhbmQgY29ybmVyIHBvc2l0aW9uc1xuICBAaWYgKCRsZW5ndGggPiAxKSB7XG4gICAgQGlmIG50aCgkcG9zLCAxKSA9PSBcInRvXCIgeyAvLyBOZXdlciBzeW50YXhcbiAgICAgICRzaWRlOiBudGgoJHBvcywgMik7XG5cbiAgICAgIEBpZiAkbGVuZ3RoID09IDIgeyAvLyBlZy4gdG8gdG9wXG4gICAgICAgIC8vIFN3YXAgZm9yIGJhY2t3YXJkcyBjb21wYXRhYmlsaXR5XG4gICAgICAgICRkZWdyZWU6IF9wb3NpdGlvbi1mbGlwcGVyKG50aCgkcG9zLCAyKSk7XG4gICAgICB9XG4gICAgICBAZWxzZSBpZiAkbGVuZ3RoID09IDMgeyAvLyBlZy4gdG8gdG9wIGxlZnRcbiAgICAgICAgJGNvcm5lcjogbnRoKCRwb3MsIDMpO1xuICAgICAgfVxuICAgIH1cbiAgICBAZWxzZSBpZiAkbGVuZ3RoID09IDIgeyAvLyBPbGRlciBzeW50YXggKFwidG9wIGxlZnRcIilcbiAgICAgICRzaWRlOiBfcG9zaXRpb24tZmxpcHBlcihudGgoJHBvcywgMSkpO1xuICAgICAgJGNvcm5lcjogX3Bvc2l0aW9uLWZsaXBwZXIobnRoKCRwb3MsIDIpKTtcbiAgICB9XG5cbiAgICBAaWYgKFwiI3skc2lkZX0gI3skY29ybmVyfVwiID09IFwibGVmdCB0b3BcIikgb3IgKFwiI3skc2lkZX0gI3skY29ybmVyfVwiID09IFwidG9wIGxlZnRcIikge1xuICAgICAgJGRlZ3JlZTogX3Bvc2l0aW9uLWZsaXBwZXIoI3skc2lkZX0pIF9wb3NpdGlvbi1mbGlwcGVyKCN7JGNvcm5lcn0pO1xuICAgIH1cbiAgICBAZWxzZSBpZiAoXCIjeyRzaWRlfSAjeyRjb3JuZXJ9XCIgPT0gXCJyaWdodCB0b3BcIikgb3IgKFwiI3skc2lkZX0gI3skY29ybmVyfVwiID09IFwidG9wIHJpZ2h0XCIpIHtcbiAgICAgICRkZWdyZWU6IF9wb3NpdGlvbi1mbGlwcGVyKCN7JHNpZGV9KSBfcG9zaXRpb24tZmxpcHBlcigjeyRjb3JuZXJ9KTtcbiAgICB9XG4gICAgQGVsc2UgaWYgKFwiI3skc2lkZX0gI3skY29ybmVyfVwiID09IFwicmlnaHQgYm90dG9tXCIpIG9yIChcIiN7JHNpZGV9ICN7JGNvcm5lcn1cIiA9PSBcImJvdHRvbSByaWdodFwiKSB7XG4gICAgICAkZGVncmVlOiBfcG9zaXRpb24tZmxpcHBlcigjeyRzaWRlfSkgX3Bvc2l0aW9uLWZsaXBwZXIoI3skY29ybmVyfSk7XG4gICAgfVxuICAgIEBlbHNlIGlmIChcIiN7JHNpZGV9ICN7JGNvcm5lcn1cIiA9PSBcImxlZnQgYm90dG9tXCIpIG9yIChcIiN7JHNpZGV9ICN7JGNvcm5lcn1cIiA9PSBcImJvdHRvbSBsZWZ0XCIpIHtcbiAgICAgICRkZWdyZWU6IF9wb3NpdGlvbi1mbGlwcGVyKCN7JHNpZGV9KSBfcG9zaXRpb24tZmxpcHBlcigjeyRjb3JuZXJ9KTtcbiAgICB9XG4gICAgJHNwZWM6IHRvICRzaWRlICRjb3JuZXI7XG4gIH1cbiAgQGVsc2UgaWYgJGxlbmd0aCA9PSAxIHtcbiAgICAvLyBTd2FwIGZvciBiYWNrd2FyZHMgY29tcGF0YWJpbGl0eVxuICAgIEBpZiAkdHlwZSA9PSBzdHJpbmcge1xuICAgICAgJGRlZ3JlZTogJHBvcztcbiAgICAgICRzcGVjOiB0byBfcG9zaXRpb24tZmxpcHBlcigkcG9zKTtcbiAgICB9XG4gICAgQGVsc2Uge1xuICAgICAgJGRlZ3JlZTogLTI3MCAtICRwb3M7IC8vcm90YXRlIHRoZSBncmFkaWVudCBvcHBvc2l0ZSBmcm9tIHNwZWNcbiAgICAgICRzcGVjOiAkcG9zO1xuICAgIH1cbiAgfVxuICAkZGVncmVlOiB1bnF1b3RlKCRkZWdyZWUgKyBcIixcIik7XG4gICRzcGVjOiAgIHVucXVvdGUoJHNwZWMgKyBcIixcIik7XG4gIEByZXR1cm4gJGRlZ3JlZSAkc3BlYztcbn1cblxuQGZ1bmN0aW9uIF9wb3NpdGlvbi1mbGlwcGVyKCRwb3MpIHtcbiAgQHJldHVybiBpZigkcG9zID09IGxlZnQsIHJpZ2h0LCBudWxsKVxuICAgICAgICAgaWYoJHBvcyA9PSByaWdodCwgbGVmdCwgbnVsbClcbiAgICAgICAgIGlmKCRwb3MgPT0gdG9wLCBib3R0b20sIG51bGwpXG4gICAgICAgICBpZigkcG9zID09IGJvdHRvbSwgdG9wLCBudWxsKTtcbn1cbiIsIi8vIFByaXZhdGUgZnVuY3Rpb24gZm9yIGxpbmVhci1ncmFkaWVudC1wYXJzZXJcbkBmdW5jdGlvbiBfbGluZWFyLXNpZGUtY29ybmVyLXBhcnNlcigkaW1hZ2UsICRmaXJzdC12YWwsICRwcmVmaXgsICRzdWZmaXgsICRoYXMtbXVsdGlwbGUtdmFscykge1xuICAkdmFsLTE6IHN0ci1zbGljZSgkZmlyc3QtdmFsLCAwLCAkaGFzLW11bHRpcGxlLXZhbHMgLSAxICk7XG4gICR2YWwtMjogc3RyLXNsaWNlKCRmaXJzdC12YWwsICRoYXMtbXVsdGlwbGUtdmFscyArIDEsIHN0ci1sZW5ndGgoJGZpcnN0LXZhbCkpO1xuICAkdmFsLTM6IG51bGw7XG4gICRoYXMtdmFsLTM6IHN0ci1pbmRleCgkdmFsLTIsIFwiIFwiKTtcblxuICBAaWYgJGhhcy12YWwtMyB7XG4gICAgJHZhbC0zOiBzdHItc2xpY2UoJHZhbC0yLCAkaGFzLXZhbC0zICsgMSwgc3RyLWxlbmd0aCgkdmFsLTIpKTtcbiAgICAkdmFsLTI6IHN0ci1zbGljZSgkdmFsLTIsIDAsICRoYXMtdmFsLTMgLSAxKTtcbiAgfVxuXG4gICRwb3M6IF9wb3NpdGlvbi1mbGlwcGVyKCR2YWwtMSkgX3Bvc2l0aW9uLWZsaXBwZXIoJHZhbC0yKSBfcG9zaXRpb24tZmxpcHBlcigkdmFsLTMpO1xuICAkcG9zOiB1bnF1b3RlKCRwb3MgKyBcIlwiKTtcblxuICAvLyBVc2Ugb2xkIHNwZWMgZm9yIHdlYmtpdFxuICBAaWYgJHZhbC0xID09IFwidG9cIiB7XG4gICAgQHJldHVybiAoXG4gICAgICB3ZWJraXQtaW1hZ2U6IC13ZWJraXQtICsgJHByZWZpeCArICRwb3MgKyAkc3VmZml4LFxuICAgICAgc3BlYy1pbWFnZTogJGltYWdlXG4gICAgKTtcbiAgfVxuXG4gIC8vIEJyaW5nIHRoZSBjb2RlIHVwIHRvIHNwZWNcbiAgQGVsc2Uge1xuICAgIEByZXR1cm4gKFxuICAgICAgd2Via2l0LWltYWdlOiAtd2Via2l0LSArICRpbWFnZSxcbiAgICAgIHNwZWMtaW1hZ2U6ICRwcmVmaXggKyBcInRvIFwiICsgJHBvcyArICRzdWZmaXhcbiAgICApO1xuICB9XG59XG4iLCJAZnVuY3Rpb24gX3JhZGlhbC1hcmctcGFyc2VyKCRnMSwgJGcyLCAkcG9zLCAkc2hhcGUtc2l6ZSkge1xuICBAZWFjaCAkdmFsdWUgaW4gJGcxLCAkZzIge1xuICAgICRmaXJzdC12YWw6IG50aCgkdmFsdWUsIDEpO1xuICAgICRwb3MtdHlwZTogIHR5cGUtb2YoJGZpcnN0LXZhbCk7XG4gICAgJHNwZWMtYXQtaW5kZXg6IG51bGw7XG5cbiAgICAvLyBEZXRlcm1pbmUgaWYgc3BlYyB3YXMgcGFzc2VkIHRvIG1peGluXG4gICAgQGlmIHR5cGUtb2YoJHZhbHVlKSA9PSBsaXN0IHtcbiAgICAgICRzcGVjLWF0LWluZGV4OiBpZihpbmRleCgkdmFsdWUsIGF0KSwgaW5kZXgoJHZhbHVlLCBhdCksIGZhbHNlKTtcbiAgICB9XG4gICAgQGlmICRzcGVjLWF0LWluZGV4IHtcbiAgICAgIEBpZiAkc3BlYy1hdC1pbmRleCA+IDEge1xuICAgICAgICBAZm9yICRpIGZyb20gMSB0aHJvdWdoICgkc3BlYy1hdC1pbmRleCAtIDEpIHtcbiAgICAgICAgICAkc2hhcGUtc2l6ZTogJHNoYXBlLXNpemUgbnRoKCR2YWx1ZSwgJGkpO1xuICAgICAgICB9XG4gICAgICAgIEBmb3IgJGkgZnJvbSAoJHNwZWMtYXQtaW5kZXggKyAxKSB0aHJvdWdoIGxlbmd0aCgkdmFsdWUpIHtcbiAgICAgICAgICAkcG9zOiAkcG9zIG50aCgkdmFsdWUsICRpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgQGVsc2UgaWYgJHNwZWMtYXQtaW5kZXggPT0gMSB7XG4gICAgICAgIEBmb3IgJGkgZnJvbSAoJHNwZWMtYXQtaW5kZXggKyAxKSB0aHJvdWdoIGxlbmd0aCgkdmFsdWUpIHtcbiAgICAgICAgICAkcG9zOiAkcG9zIG50aCgkdmFsdWUsICRpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgJGcxOiBudWxsO1xuICAgIH1cblxuICAgIC8vIElmIG5vdCBzcGVjIGNhbGN1bGF0ZSBjb3JyZWN0IHZhbHVlc1xuICAgIEBlbHNlIHtcbiAgICAgIEBpZiAoJHBvcy10eXBlICE9IGNvbG9yKSBvciAoJGZpcnN0LXZhbCAhPSBcInRyYW5zcGFyZW50XCIpIHtcbiAgICAgICAgQGlmICgkcG9zLXR5cGUgPT0gbnVtYmVyKVxuICAgICAgICBvciAoJGZpcnN0LXZhbCA9PSBcImNlbnRlclwiKVxuICAgICAgICBvciAoJGZpcnN0LXZhbCA9PSBcInRvcFwiKVxuICAgICAgICBvciAoJGZpcnN0LXZhbCA9PSBcInJpZ2h0XCIpXG4gICAgICAgIG9yICgkZmlyc3QtdmFsID09IFwiYm90dG9tXCIpXG4gICAgICAgIG9yICgkZmlyc3QtdmFsID09IFwibGVmdFwiKSB7XG5cbiAgICAgICAgICAkcG9zOiAkdmFsdWU7XG5cbiAgICAgICAgICBAaWYgJHBvcyA9PSAkZzEge1xuICAgICAgICAgICAgJGcxOiBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIEBlbHNlIGlmXG4gICAgICAgICAgICgkZmlyc3QtdmFsID09IFwiZWxsaXBzZVwiKVxuICAgICAgICBvciAoJGZpcnN0LXZhbCA9PSBcImNpcmNsZVwiKVxuICAgICAgICBvciAoJGZpcnN0LXZhbCA9PSBcImNsb3Nlc3Qtc2lkZVwiKVxuICAgICAgICBvciAoJGZpcnN0LXZhbCA9PSBcImNsb3Nlc3QtY29ybmVyXCIpXG4gICAgICAgIG9yICgkZmlyc3QtdmFsID09IFwiZmFydGhlc3Qtc2lkZVwiKVxuICAgICAgICBvciAoJGZpcnN0LXZhbCA9PSBcImZhcnRoZXN0LWNvcm5lclwiKVxuICAgICAgICBvciAoJGZpcnN0LXZhbCA9PSBcImNvbnRhaW5cIilcbiAgICAgICAgb3IgKCRmaXJzdC12YWwgPT0gXCJjb3ZlclwiKSB7XG5cbiAgICAgICAgICAkc2hhcGUtc2l6ZTogJHZhbHVlO1xuXG4gICAgICAgICAgQGlmICR2YWx1ZSA9PSAkZzEge1xuICAgICAgICAgICAgJGcxOiBudWxsO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIEBlbHNlIGlmICR2YWx1ZSA9PSAkZzIge1xuICAgICAgICAgICAgJGcyOiBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBAcmV0dXJuICRnMSwgJGcyLCAkcG9zLCAkc2hhcGUtc2l6ZTtcbn1cbiIsIkBmdW5jdGlvbiBfcmFkaWFsLXBvc2l0aW9ucy1wYXJzZXIoJGdyYWRpZW50LXBvcykge1xuICAkc2hhcGUtc2l6ZTogbnRoKCRncmFkaWVudC1wb3MsIDEpO1xuICAkcG9zOiAgICAgICAgbnRoKCRncmFkaWVudC1wb3MsIDIpO1xuICAkc2hhcGUtc2l6ZS1zcGVjOiBfc2hhcGUtc2l6ZS1zdHJpcHBlcigkc2hhcGUtc2l6ZSk7XG5cbiAgJHByZS1zcGVjOiB1bnF1b3RlKGlmKCRwb3MsIFwiI3skcG9zfSwgXCIsIG51bGwpKVxuICAgICAgICAgICAgIHVucXVvdGUoaWYoJHNoYXBlLXNpemUsIFwiI3skc2hhcGUtc2l6ZX0sXCIsIG51bGwpKTtcbiAgJHBvcy1zcGVjOiBpZigkcG9zLCBcImF0ICN7JHBvc31cIiwgbnVsbCk7XG5cbiAgJHNwZWM6IFwiI3skc2hhcGUtc2l6ZS1zcGVjfSAjeyRwb3Mtc3BlY31cIjtcblxuICAvLyBBZGQgY29tbWFcbiAgQGlmICgkc3BlYyAhPSBcIiAgXCIpIHtcbiAgICAkc3BlYzogXCIjeyRzcGVjfSxcIjtcbiAgfVxuXG4gIEByZXR1cm4gJHByZS1zcGVjICRzcGVjO1xufVxuIiwiQGZ1bmN0aW9uIF9yYWRpYWwtZ3JhZGllbnQtcGFyc2VyKCRpbWFnZSkge1xuICAkaW1hZ2U6IHVucXVvdGUoJGltYWdlKTtcbiAgJGdyYWRpZW50czogKCk7XG4gICRzdGFydDogc3RyLWluZGV4KCRpbWFnZSwgXCIoXCIpO1xuICAkZW5kOiBzdHItaW5kZXgoJGltYWdlLCBcIixcIik7XG4gICRmaXJzdC12YWw6IHN0ci1zbGljZSgkaW1hZ2UsICRzdGFydCArIDEsICRlbmQgLSAxKTtcblxuICAkcHJlZml4OiBzdHItc2xpY2UoJGltYWdlLCAwLCAkc3RhcnQpO1xuICAkc3VmZml4OiBzdHItc2xpY2UoJGltYWdlLCAkZW5kLCBzdHItbGVuZ3RoKCRpbWFnZSkpO1xuXG4gICRpcy1zcGVjLXN5bnRheDogc3RyLWluZGV4KCRmaXJzdC12YWwsIFwiYXRcIik7XG5cbiAgQGlmICRpcy1zcGVjLXN5bnRheCBhbmQgJGlzLXNwZWMtc3ludGF4ID4gMSB7XG4gICAgJGtleXdvcmQ6IHN0ci1zbGljZSgkZmlyc3QtdmFsLCAxLCAkaXMtc3BlYy1zeW50YXggLSAyKTtcbiAgICAkcG9zOiBzdHItc2xpY2UoJGZpcnN0LXZhbCwgJGlzLXNwZWMtc3ludGF4ICsgMywgc3RyLWxlbmd0aCgkZmlyc3QtdmFsKSk7XG4gICAgJHBvczogYXBwZW5kKCRwb3MsICRrZXl3b3JkLCBjb21tYSk7XG5cbiAgICAkZ3JhZGllbnRzOiAoXG4gICAgICB3ZWJraXQtaW1hZ2U6IC13ZWJraXQtICsgJHByZWZpeCArICRwb3MgKyAkc3VmZml4LFxuICAgICAgc3BlYy1pbWFnZTogJGltYWdlXG4gICAgKTtcbiAgfVxuXG4gIEBlbHNlIGlmICRpcy1zcGVjLXN5bnRheCA9PSAxIHtcbiAgICAkcG9zOiBzdHItc2xpY2UoJGZpcnN0LXZhbCwgJGlzLXNwZWMtc3ludGF4ICsgMywgc3RyLWxlbmd0aCgkZmlyc3QtdmFsKSk7XG5cbiAgICAkZ3JhZGllbnRzOiAoXG4gICAgICB3ZWJraXQtaW1hZ2U6IC13ZWJraXQtICsgJHByZWZpeCArICRwb3MgKyAkc3VmZml4LFxuICAgICAgc3BlYy1pbWFnZTogJGltYWdlXG4gICAgKTtcbiAgfVxuXG4gIEBlbHNlIGlmIHN0ci1pbmRleCgkaW1hZ2UsIFwiY292ZXJcIikgb3Igc3RyLWluZGV4KCRpbWFnZSwgXCJjb250YWluXCIpIHtcbiAgICBAd2FybiBcIlJhZGlhbC1ncmFkaWVudCBuZWVkcyB0byBiZSB1cGRhdGVkIHRvIGNvbmZvcm0gdG8gbGF0ZXN0IHNwZWMuXCI7XG5cbiAgICAkZ3JhZGllbnRzOiAoXG4gICAgICB3ZWJraXQtaW1hZ2U6IG51bGwsXG4gICAgICBzcGVjLWltYWdlOiAkaW1hZ2VcbiAgICApO1xuICB9XG5cbiAgQGVsc2Uge1xuICAgICRncmFkaWVudHM6IChcbiAgICAgIHdlYmtpdC1pbWFnZTogLXdlYmtpdC0gKyAkaW1hZ2UsXG4gICAgICBzcGVjLWltYWdlOiAkaW1hZ2VcbiAgICApO1xuICB9XG5cbiAgQHJldHVybiAkZ3JhZGllbnRzO1xufVxuIiwiLy8gVXNlciBmb3IgbGluZWFyIGFuZCByYWRpYWwgZ3JhZGllbnRzIHdpdGhpbiBiYWNrZ3JvdW5kLWltYWdlIG9yIGJvcmRlci1pbWFnZSBwcm9wZXJ0aWVzXG5cbkBmdW5jdGlvbiBfcmVuZGVyLWdyYWRpZW50cygkZ3JhZGllbnQtcG9zaXRpb25zLCAkZ3JhZGllbnRzLCAkZ3JhZGllbnQtdHlwZSwgJHZlbmRvcjogZmFsc2UpIHtcbiAgJHByZS1zcGVjOiBudWxsO1xuICAkc3BlYzogbnVsbDtcbiAgJHZlbmRvci1ncmFkaWVudHM6IG51bGw7XG4gIEBpZiAkZ3JhZGllbnQtdHlwZSA9PSBsaW5lYXIge1xuICAgIEBpZiAkZ3JhZGllbnQtcG9zaXRpb25zIHtcbiAgICAgICRwcmUtc3BlYzogbnRoKCRncmFkaWVudC1wb3NpdGlvbnMsIDEpO1xuICAgICAgJHNwZWM6ICAgICBudGgoJGdyYWRpZW50LXBvc2l0aW9ucywgMik7XG4gICAgfVxuICB9XG4gIEBlbHNlIGlmICRncmFkaWVudC10eXBlID09IHJhZGlhbCB7XG4gICAgJHByZS1zcGVjOiBudGgoJGdyYWRpZW50LXBvc2l0aW9ucywgMSk7XG4gICAgJHNwZWM6ICAgICBudGgoJGdyYWRpZW50LXBvc2l0aW9ucywgMik7XG4gIH1cblxuICBAaWYgJHZlbmRvciB7XG4gICAgJHZlbmRvci1ncmFkaWVudHM6IC0jeyR2ZW5kb3J9LSN7JGdyYWRpZW50LXR5cGV9LWdyYWRpZW50KCN7JHByZS1zcGVjfSAkZ3JhZGllbnRzKTtcbiAgfVxuICBAZWxzZSBpZiAkdmVuZG9yID09IGZhbHNlIHtcbiAgICAkdmVuZG9yLWdyYWRpZW50czogXCIjeyRncmFkaWVudC10eXBlfS1ncmFkaWVudCgjeyRzcGVjfSAjeyRncmFkaWVudHN9KVwiO1xuICAgICR2ZW5kb3ItZ3JhZGllbnRzOiB1bnF1b3RlKCR2ZW5kb3ItZ3JhZGllbnRzKTtcbiAgfVxuICBAcmV0dXJuICR2ZW5kb3ItZ3JhZGllbnRzO1xufVxuIiwiQGZ1bmN0aW9uIF9zaGFwZS1zaXplLXN0cmlwcGVyKCRzaGFwZS1zaXplKSB7XG4gICRzaGFwZS1zaXplLXNwZWM6IG51bGw7XG4gIEBlYWNoICR2YWx1ZSBpbiAkc2hhcGUtc2l6ZSB7XG4gICAgQGlmICgkdmFsdWUgPT0gXCJjb3ZlclwiKSBvciAoJHZhbHVlID09IFwiY29udGFpblwiKSB7XG4gICAgICAkdmFsdWU6IG51bGw7XG4gICAgfVxuICAgICRzaGFwZS1zaXplLXNwZWM6IFwiI3skc2hhcGUtc2l6ZS1zcGVjfSAjeyR2YWx1ZX1cIjtcbiAgfVxuICBAcmV0dXJuICRzaGFwZS1zaXplLXNwZWM7XG59XG4iLCIvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi8vXG4vLyBIZWxwZXIgZnVuY3Rpb24gZm9yIGxpbmVhci9yYWRpYWwtZ3JhZGllbnQtcGFyc2Vycy5cbi8vIFNvdXJjZTogaHR0cDovL3Nhc3NtZWlzdGVyLmNvbS9naXN0Lzk2NDc0MDhcbi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqLy9cbkBmdW5jdGlvbiBfc3RyLXRvLW51bSgkc3RyaW5nKSB7XG4gIC8vIE1hdHJpY2VzXG4gICRzdHJpbmdzOiBcIjBcIiBcIjFcIiBcIjJcIiBcIjNcIiBcIjRcIiBcIjVcIiBcIjZcIiBcIjdcIiBcIjhcIiBcIjlcIjtcbiAgJG51bWJlcnM6ICAwICAgMSAgIDIgICAzICAgNCAgIDUgICA2ICAgNyAgIDggICA5O1xuXG4gIC8vIFJlc3VsdFxuICAkcmVzdWx0OiAwO1xuICAkZGl2aWRlcjogMDtcbiAgJG1pbnVzOiBmYWxzZTtcblxuICAvLyBMb29waW5nIHRocm91Z2ggYWxsIGNoYXJhY3RlcnNcbiAgQGZvciAkaSBmcm9tIDEgdGhyb3VnaCBzdHItbGVuZ3RoKCRzdHJpbmcpIHtcbiAgICAkY2hhcmFjdGVyOiBzdHItc2xpY2UoJHN0cmluZywgJGksICRpKTtcbiAgICAkaW5kZXg6IGluZGV4KCRzdHJpbmdzLCAkY2hhcmFjdGVyKTtcblxuICAgIEBpZiAkY2hhcmFjdGVyID09IFwiLVwiIHtcbiAgICAgICRtaW51czogdHJ1ZTtcbiAgICB9XG5cbiAgICBAZWxzZSBpZiAkY2hhcmFjdGVyID09IFwiLlwiIHtcbiAgICAgICRkaXZpZGVyOiAxO1xuICAgIH1cblxuICAgIEBlbHNlIHtcbiAgICAgIEBpZiBub3QgJGluZGV4IHtcbiAgICAgICAgJHJlc3VsdDogaWYoJG1pbnVzLCAkcmVzdWx0ICogLTEsICRyZXN1bHQpO1xuICAgICAgICBAcmV0dXJuIF9jb252ZXJ0LXVuaXRzKCRyZXN1bHQsIHN0ci1zbGljZSgkc3RyaW5nLCAkaSkpO1xuICAgICAgfVxuXG4gICAgICAkbnVtYmVyOiBudGgoJG51bWJlcnMsICRpbmRleCk7XG5cbiAgICAgIEBpZiAkZGl2aWRlciA9PSAwIHtcbiAgICAgICAgJHJlc3VsdDogJHJlc3VsdCAqIDEwO1xuICAgICAgfVxuXG4gICAgICBAZWxzZSB7XG4gICAgICAgIC8vIE1vdmUgdGhlIGRlY2ltYWwgZG90IHRvIHRoZSBsZWZ0XG4gICAgICAgICRkaXZpZGVyOiAkZGl2aWRlciAqIDEwO1xuICAgICAgICAkbnVtYmVyOiAkbnVtYmVyIC8gJGRpdmlkZXI7XG4gICAgICB9XG5cbiAgICAgICRyZXN1bHQ6ICRyZXN1bHQgKyAkbnVtYmVyO1xuICAgIH1cbiAgfVxuICBAcmV0dXJuIGlmKCRtaW51cywgJHJlc3VsdCAqIC0xLCAkcmVzdWx0KTtcbn1cbiIsIi8vIGh0dHA6Ly93d3cudzMub3JnL1RSL2NzczMtYW5pbWF0aW9ucy8jdGhlLWFuaW1hdGlvbi1uYW1lLXByb3BlcnR5LVxuLy8gRWFjaCBvZiB0aGVzZSBtaXhpbnMgc3VwcG9ydCBjb21tYSBzZXBhcmF0ZWQgbGlzdHMgb2YgdmFsdWVzLCB3aGljaCBhbGxvd3MgZGlmZmVyZW50IHRyYW5zaXRpb25zIGZvciBpbmRpdmlkdWFsIHByb3BlcnRpZXMgdG8gYmUgZGVzY3JpYmVkIGluIGEgc2luZ2xlIHN0eWxlIHJ1bGUuIEVhY2ggdmFsdWUgaW4gdGhlIGxpc3QgY29ycmVzcG9uZHMgdG8gdGhlIHZhbHVlIGF0IHRoYXQgc2FtZSBwb3NpdGlvbiBpbiB0aGUgb3RoZXIgcHJvcGVydGllcy5cblxuQG1peGluIGFuaW1hdGlvbigkYW5pbWF0aW9ucy4uLikge1xuICBAaW5jbHVkZSBwcmVmaXhlcihhbmltYXRpb24sICRhbmltYXRpb25zLCB3ZWJraXQgbW96IHNwZWMpO1xufVxuXG5AbWl4aW4gYW5pbWF0aW9uLW5hbWUoJG5hbWVzLi4uKSB7XG4gIEBpbmNsdWRlIHByZWZpeGVyKGFuaW1hdGlvbi1uYW1lLCAkbmFtZXMsIHdlYmtpdCBtb3ogc3BlYyk7XG59XG5cbkBtaXhpbiBhbmltYXRpb24tZHVyYXRpb24oJHRpbWVzLi4uKSB7XG4gIEBpbmNsdWRlIHByZWZpeGVyKGFuaW1hdGlvbi1kdXJhdGlvbiwgJHRpbWVzLCB3ZWJraXQgbW96IHNwZWMpO1xufVxuXG5AbWl4aW4gYW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbigkbW90aW9ucy4uLikge1xuICAvLyBlYXNlIHwgbGluZWFyIHwgZWFzZS1pbiB8IGVhc2Utb3V0IHwgZWFzZS1pbi1vdXRcbiAgQGluY2x1ZGUgcHJlZml4ZXIoYW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbiwgJG1vdGlvbnMsIHdlYmtpdCBtb3ogc3BlYyk7XG59XG5cbkBtaXhpbiBhbmltYXRpb24taXRlcmF0aW9uLWNvdW50KCR2YWx1ZXMuLi4pIHtcbiAgLy8gaW5maW5pdGUgfCA8bnVtYmVyPlxuICBAaW5jbHVkZSBwcmVmaXhlcihhbmltYXRpb24taXRlcmF0aW9uLWNvdW50LCAkdmFsdWVzLCB3ZWJraXQgbW96IHNwZWMpO1xufVxuXG5AbWl4aW4gYW5pbWF0aW9uLWRpcmVjdGlvbigkZGlyZWN0aW9ucy4uLikge1xuICAvLyBub3JtYWwgfCBhbHRlcm5hdGVcbiAgQGluY2x1ZGUgcHJlZml4ZXIoYW5pbWF0aW9uLWRpcmVjdGlvbiwgJGRpcmVjdGlvbnMsIHdlYmtpdCBtb3ogc3BlYyk7XG59XG5cbkBtaXhpbiBhbmltYXRpb24tcGxheS1zdGF0ZSgkc3RhdGVzLi4uKSB7XG4gIC8vIHJ1bm5pbmcgfCBwYXVzZWRcbiAgQGluY2x1ZGUgcHJlZml4ZXIoYW5pbWF0aW9uLXBsYXktc3RhdGUsICRzdGF0ZXMsIHdlYmtpdCBtb3ogc3BlYyk7XG59XG5cbkBtaXhpbiBhbmltYXRpb24tZGVsYXkoJHRpbWVzLi4uKSB7XG4gIEBpbmNsdWRlIHByZWZpeGVyKGFuaW1hdGlvbi1kZWxheSwgJHRpbWVzLCB3ZWJraXQgbW96IHNwZWMpO1xufVxuXG5AbWl4aW4gYW5pbWF0aW9uLWZpbGwtbW9kZSgkbW9kZXMuLi4pIHtcbiAgLy8gbm9uZSB8IGZvcndhcmRzIHwgYmFja3dhcmRzIHwgYm90aFxuICBAaW5jbHVkZSBwcmVmaXhlcihhbmltYXRpb24tZmlsbC1tb2RlLCAkbW9kZXMsIHdlYmtpdCBtb3ogc3BlYyk7XG59XG4iLCJAbWl4aW4gYXBwZWFyYW5jZSgkdmFsdWUpIHtcbiAgQGluY2x1ZGUgcHJlZml4ZXIoYXBwZWFyYW5jZSwgJHZhbHVlLCB3ZWJraXQgbW96IG1zIG8gc3BlYyk7XG59XG4iLCJAbWl4aW4gYmFja2ZhY2UtdmlzaWJpbGl0eSgkdmlzaWJpbGl0eSkge1xuICBAaW5jbHVkZSBwcmVmaXhlcihiYWNrZmFjZS12aXNpYmlsaXR5LCAkdmlzaWJpbGl0eSwgd2Via2l0IHNwZWMpO1xufVxuIiwiLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovL1xuLy8gQmFja2dyb3VuZCBwcm9wZXJ0eSBmb3IgYWRkaW5nIG11bHRpcGxlIGJhY2tncm91bmRzIHVzaW5nIHNob3J0aGFuZFxuLy8gbm90YXRpb24uXG4vLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi8vXG5cbkBtaXhpbiBiYWNrZ3JvdW5kKCRiYWNrZ3JvdW5kcy4uLikge1xuICAkd2Via2l0LWJhY2tncm91bmRzOiAoKTtcbiAgJHNwZWMtYmFja2dyb3VuZHM6ICgpO1xuXG4gIEBlYWNoICRiYWNrZ3JvdW5kIGluICRiYWNrZ3JvdW5kcyB7XG4gICAgJHdlYmtpdC1iYWNrZ3JvdW5kOiAoKTtcbiAgICAkc3BlYy1iYWNrZ3JvdW5kOiAoKTtcbiAgICAkYmFja2dyb3VuZC10eXBlOiB0eXBlLW9mKCRiYWNrZ3JvdW5kKTtcblxuICAgIEBpZiAkYmFja2dyb3VuZC10eXBlID09IHN0cmluZyBvciAkYmFja2dyb3VuZC10eXBlID09IGxpc3Qge1xuICAgICAgJGJhY2tncm91bmQtc3RyOiBpZigkYmFja2dyb3VuZC10eXBlID09IGxpc3QsIG50aCgkYmFja2dyb3VuZCwgMSksICRiYWNrZ3JvdW5kKTtcblxuICAgICAgJHVybC1zdHI6ICAgICAgIHN0ci1zbGljZSgkYmFja2dyb3VuZC1zdHIsIDAsIDMpO1xuICAgICAgJGdyYWRpZW50LXR5cGU6IHN0ci1zbGljZSgkYmFja2dyb3VuZC1zdHIsIDAsIDYpO1xuXG4gICAgICBAaWYgJHVybC1zdHIgPT0gXCJ1cmxcIiB7XG4gICAgICAgICR3ZWJraXQtYmFja2dyb3VuZDogJGJhY2tncm91bmQ7XG4gICAgICAgICRzcGVjLWJhY2tncm91bmQ6ICAgJGJhY2tncm91bmQ7XG4gICAgICB9XG5cbiAgICAgIEBlbHNlIGlmICRncmFkaWVudC10eXBlID09IFwibGluZWFyXCIge1xuICAgICAgICAkZ3JhZGllbnRzOiBfbGluZWFyLWdyYWRpZW50LXBhcnNlcihcIiN7JGJhY2tncm91bmR9XCIpO1xuICAgICAgICAkd2Via2l0LWJhY2tncm91bmQ6IG1hcC1nZXQoJGdyYWRpZW50cywgd2Via2l0LWltYWdlKTtcbiAgICAgICAgJHNwZWMtYmFja2dyb3VuZDogICBtYXAtZ2V0KCRncmFkaWVudHMsIHNwZWMtaW1hZ2UpO1xuICAgICAgfVxuXG4gICAgICBAZWxzZSBpZiAkZ3JhZGllbnQtdHlwZSA9PSBcInJhZGlhbFwiIHtcbiAgICAgICAgJGdyYWRpZW50czogX3JhZGlhbC1ncmFkaWVudC1wYXJzZXIoXCIjeyRiYWNrZ3JvdW5kfVwiKTtcbiAgICAgICAgJHdlYmtpdC1iYWNrZ3JvdW5kOiBtYXAtZ2V0KCRncmFkaWVudHMsIHdlYmtpdC1pbWFnZSk7XG4gICAgICAgICRzcGVjLWJhY2tncm91bmQ6ICAgbWFwLWdldCgkZ3JhZGllbnRzLCBzcGVjLWltYWdlKTtcbiAgICAgIH1cblxuICAgICAgQGVsc2Uge1xuICAgICAgICAkd2Via2l0LWJhY2tncm91bmQ6ICRiYWNrZ3JvdW5kO1xuICAgICAgICAkc3BlYy1iYWNrZ3JvdW5kOiAgICRiYWNrZ3JvdW5kO1xuICAgICAgfVxuICAgIH1cblxuICAgIEBlbHNlIHtcbiAgICAgICR3ZWJraXQtYmFja2dyb3VuZDogJGJhY2tncm91bmQ7XG4gICAgICAkc3BlYy1iYWNrZ3JvdW5kOiAgICRiYWNrZ3JvdW5kO1xuICAgIH1cblxuICAgICR3ZWJraXQtYmFja2dyb3VuZHM6IGFwcGVuZCgkd2Via2l0LWJhY2tncm91bmRzLCAkd2Via2l0LWJhY2tncm91bmQsIGNvbW1hKTtcbiAgICAkc3BlYy1iYWNrZ3JvdW5kczogICBhcHBlbmQoJHNwZWMtYmFja2dyb3VuZHMsICAgJHNwZWMtYmFja2dyb3VuZCwgICBjb21tYSk7XG4gIH1cblxuICBiYWNrZ3JvdW5kOiAkd2Via2l0LWJhY2tncm91bmRzO1xuICBiYWNrZ3JvdW5kOiAkc3BlYy1iYWNrZ3JvdW5kcztcbn1cbiIsIi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqLy9cbi8vIEJhY2tncm91bmQtaW1hZ2UgcHJvcGVydHkgZm9yIGFkZGluZyBtdWx0aXBsZSBiYWNrZ3JvdW5kIGltYWdlcyB3aXRoXG4vLyBncmFkaWVudHMsIG9yIGZvciBzdHJpbmdpbmcgbXVsdGlwbGUgZ3JhZGllbnRzIHRvZ2V0aGVyLlxuLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovL1xuXG5AbWl4aW4gYmFja2dyb3VuZC1pbWFnZSgkaW1hZ2VzLi4uKSB7XG4gICR3ZWJraXQtaW1hZ2VzOiAoKTtcbiAgJHNwZWMtaW1hZ2VzOiAoKTtcblxuICBAZWFjaCAkaW1hZ2UgaW4gJGltYWdlcyB7XG4gICAgJHdlYmtpdC1pbWFnZTogKCk7XG4gICAgJHNwZWMtaW1hZ2U6ICgpO1xuXG4gICAgQGlmICh0eXBlLW9mKCRpbWFnZSkgPT0gc3RyaW5nKSB7XG4gICAgICAkdXJsLXN0cjogICAgICAgc3RyLXNsaWNlKCRpbWFnZSwgMCwgMyk7XG4gICAgICAkZ3JhZGllbnQtdHlwZTogc3RyLXNsaWNlKCRpbWFnZSwgMCwgNik7XG5cbiAgICAgIEBpZiAkdXJsLXN0ciA9PSBcInVybFwiIHtcbiAgICAgICAgJHdlYmtpdC1pbWFnZTogJGltYWdlO1xuICAgICAgICAkc3BlYy1pbWFnZTogICAkaW1hZ2U7XG4gICAgICB9XG5cbiAgICAgIEBlbHNlIGlmICRncmFkaWVudC10eXBlID09IFwibGluZWFyXCIge1xuICAgICAgICAkZ3JhZGllbnRzOiBfbGluZWFyLWdyYWRpZW50LXBhcnNlcigkaW1hZ2UpO1xuICAgICAgICAkd2Via2l0LWltYWdlOiAgbWFwLWdldCgkZ3JhZGllbnRzLCB3ZWJraXQtaW1hZ2UpO1xuICAgICAgICAkc3BlYy1pbWFnZTogICAgbWFwLWdldCgkZ3JhZGllbnRzLCBzcGVjLWltYWdlKTtcbiAgICAgIH1cblxuICAgICAgQGVsc2UgaWYgJGdyYWRpZW50LXR5cGUgPT0gXCJyYWRpYWxcIiB7XG4gICAgICAgICRncmFkaWVudHM6IF9yYWRpYWwtZ3JhZGllbnQtcGFyc2VyKCRpbWFnZSk7XG4gICAgICAgICR3ZWJraXQtaW1hZ2U6IG1hcC1nZXQoJGdyYWRpZW50cywgd2Via2l0LWltYWdlKTtcbiAgICAgICAgJHNwZWMtaW1hZ2U6ICAgbWFwLWdldCgkZ3JhZGllbnRzLCBzcGVjLWltYWdlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAkd2Via2l0LWltYWdlczogYXBwZW5kKCR3ZWJraXQtaW1hZ2VzLCAkd2Via2l0LWltYWdlLCBjb21tYSk7XG4gICAgJHNwZWMtaW1hZ2VzOiAgIGFwcGVuZCgkc3BlYy1pbWFnZXMsICAgJHNwZWMtaW1hZ2UsICAgY29tbWEpO1xuICB9XG5cbiAgYmFja2dyb3VuZC1pbWFnZTogJHdlYmtpdC1pbWFnZXM7XG4gIGJhY2tncm91bmQtaW1hZ2U6ICRzcGVjLWltYWdlcztcbn1cbiIsIkBtaXhpbiBib3JkZXItaW1hZ2UoJGJvcmRlcnMuLi4pIHtcbiAgJHdlYmtpdC1ib3JkZXJzOiAoKTtcbiAgJHNwZWMtYm9yZGVyczogKCk7XG5cbiAgQGVhY2ggJGJvcmRlciBpbiAkYm9yZGVycyB7XG4gICAgJHdlYmtpdC1ib3JkZXI6ICgpO1xuICAgICRzcGVjLWJvcmRlcjogKCk7XG4gICAgJGJvcmRlci10eXBlOiB0eXBlLW9mKCRib3JkZXIpO1xuXG4gICAgQGlmICRib3JkZXItdHlwZSA9PSBzdHJpbmcgb3IgbGlzdCB7XG4gICAgICAkYm9yZGVyLXN0cjogaWYoJGJvcmRlci10eXBlID09IGxpc3QsIG50aCgkYm9yZGVyLCAxKSwgJGJvcmRlcik7XG5cbiAgICAgICR1cmwtc3RyOiAgICAgICBzdHItc2xpY2UoJGJvcmRlci1zdHIsIDAsIDMpO1xuICAgICAgJGdyYWRpZW50LXR5cGU6IHN0ci1zbGljZSgkYm9yZGVyLXN0ciwgMCwgNik7XG5cbiAgICAgIEBpZiAkdXJsLXN0ciA9PSBcInVybFwiIHtcbiAgICAgICAgJHdlYmtpdC1ib3JkZXI6ICRib3JkZXI7XG4gICAgICAgICRzcGVjLWJvcmRlcjogICAkYm9yZGVyO1xuICAgICAgfVxuXG4gICAgICBAZWxzZSBpZiAkZ3JhZGllbnQtdHlwZSA9PSBcImxpbmVhclwiIHtcbiAgICAgICAgJGdyYWRpZW50czogX2xpbmVhci1ncmFkaWVudC1wYXJzZXIoXCIjeyRib3JkZXJ9XCIpO1xuICAgICAgICAkd2Via2l0LWJvcmRlcjogbWFwLWdldCgkZ3JhZGllbnRzLCB3ZWJraXQtaW1hZ2UpO1xuICAgICAgICAkc3BlYy1ib3JkZXI6ICAgbWFwLWdldCgkZ3JhZGllbnRzLCBzcGVjLWltYWdlKTtcbiAgICAgIH1cblxuICAgICAgQGVsc2UgaWYgJGdyYWRpZW50LXR5cGUgPT0gXCJyYWRpYWxcIiB7XG4gICAgICAgICRncmFkaWVudHM6IF9yYWRpYWwtZ3JhZGllbnQtcGFyc2VyKFwiI3skYm9yZGVyfVwiKTtcbiAgICAgICAgJHdlYmtpdC1ib3JkZXI6IG1hcC1nZXQoJGdyYWRpZW50cywgd2Via2l0LWltYWdlKTtcbiAgICAgICAgJHNwZWMtYm9yZGVyOiAgIG1hcC1nZXQoJGdyYWRpZW50cywgc3BlYy1pbWFnZSk7XG4gICAgICB9XG5cbiAgICAgIEBlbHNlIHtcbiAgICAgICAgJHdlYmtpdC1ib3JkZXI6ICRib3JkZXI7XG4gICAgICAgICRzcGVjLWJvcmRlcjogICAkYm9yZGVyO1xuICAgICAgfVxuICAgIH1cblxuICAgIEBlbHNlIHtcbiAgICAgICR3ZWJraXQtYm9yZGVyOiAkYm9yZGVyO1xuICAgICAgJHNwZWMtYm9yZGVyOiAgICRib3JkZXI7XG4gICAgfVxuXG4gICAgJHdlYmtpdC1ib3JkZXJzOiBhcHBlbmQoJHdlYmtpdC1ib3JkZXJzLCAkd2Via2l0LWJvcmRlciwgY29tbWEpO1xuICAgICRzcGVjLWJvcmRlcnM6ICAgYXBwZW5kKCRzcGVjLWJvcmRlcnMsICAgJHNwZWMtYm9yZGVyLCAgIGNvbW1hKTtcbiAgfVxuXG4gIC13ZWJraXQtYm9yZGVyLWltYWdlOiAkd2Via2l0LWJvcmRlcnM7XG4gICAgICAgICAgYm9yZGVyLWltYWdlOiAkc3BlYy1ib3JkZXJzO1xuICAgICAgICAgIGJvcmRlci1zdHlsZTogc29saWQ7XG59XG5cbi8vRXhhbXBsZXM6XG4vLyBAaW5jbHVkZSBib3JkZXItaW1hZ2UodXJsKFwiaW1hZ2UucG5nXCIpKTtcbi8vIEBpbmNsdWRlIGJvcmRlci1pbWFnZSh1cmwoXCJpbWFnZS5wbmdcIikgMjAgc3RyZXRjaCk7XG4vLyBAaW5jbHVkZSBib3JkZXItaW1hZ2UobGluZWFyLWdyYWRpZW50KDQ1ZGVnLCBvcmFuZ2UsIHllbGxvdykpO1xuLy8gQGluY2x1ZGUgYm9yZGVyLWltYWdlKGxpbmVhci1ncmFkaWVudCg0NWRlZywgb3JhbmdlLCB5ZWxsb3cpIHN0cmV0Y2gpO1xuLy8gQGluY2x1ZGUgYm9yZGVyLWltYWdlKGxpbmVhci1ncmFkaWVudCg0NWRlZywgb3JhbmdlLCB5ZWxsb3cpIDIwIDMwIDQwIDUwIHN0cmV0Y2ggcm91bmQpO1xuLy8gQGluY2x1ZGUgYm9yZGVyLWltYWdlKHJhZGlhbC1ncmFkaWVudCh0b3AsIGNvdmVyLCBvcmFuZ2UsIHllbGxvdywgb3JhbmdlKSk7XG4iLCJAbWl4aW4gY2FsYygkcHJvcGVydHksICR2YWx1ZSkge1xuICAjeyRwcm9wZXJ0eX06IC13ZWJraXQtY2FsYygjeyR2YWx1ZX0pO1xuICAjeyRwcm9wZXJ0eX06IGNhbGMoI3skdmFsdWV9KTtcbn1cbiIsIkBtaXhpbiBjb2x1bW5zKCRhcmc6IGF1dG8pIHtcbiAgLy8gPGNvbHVtbi1jb3VudD4gfHwgPGNvbHVtbi13aWR0aD5cbiAgQGluY2x1ZGUgcHJlZml4ZXIoY29sdW1ucywgJGFyZywgd2Via2l0IG1veiBzcGVjKTtcbn1cblxuQG1peGluIGNvbHVtbi1jb3VudCgkaW50OiBhdXRvKSB7XG4gIC8vIGF1dG8gfHwgaW50ZWdlclxuICBAaW5jbHVkZSBwcmVmaXhlcihjb2x1bW4tY291bnQsICRpbnQsIHdlYmtpdCBtb3ogc3BlYyk7XG59XG5cbkBtaXhpbiBjb2x1bW4tZ2FwKCRsZW5ndGg6IG5vcm1hbCkge1xuICAvLyBub3JtYWwgfHwgbGVuZ3RoXG4gIEBpbmNsdWRlIHByZWZpeGVyKGNvbHVtbi1nYXAsICRsZW5ndGgsIHdlYmtpdCBtb3ogc3BlYyk7XG59XG5cbkBtaXhpbiBjb2x1bW4tZmlsbCgkYXJnOiBhdXRvKSB7XG4gIC8vIGF1dG8gfHwgbGVuZ3RoXG4gIEBpbmNsdWRlIHByZWZpeGVyKGNvbHVtbi1maWxsLCAkYXJnLCB3ZWJraXQgbW96IHNwZWMpO1xufVxuXG5AbWl4aW4gY29sdW1uLXJ1bGUoJGFyZykge1xuICAvLyA8Ym9yZGVyLXdpZHRoPiB8fCA8Ym9yZGVyLXN0eWxlPiB8fCA8Y29sb3I+XG4gIEBpbmNsdWRlIHByZWZpeGVyKGNvbHVtbi1ydWxlLCAkYXJnLCB3ZWJraXQgbW96IHNwZWMpO1xufVxuXG5AbWl4aW4gY29sdW1uLXJ1bGUtY29sb3IoJGNvbG9yKSB7XG4gIEBpbmNsdWRlIHByZWZpeGVyKGNvbHVtbi1ydWxlLWNvbG9yLCAkY29sb3IsIHdlYmtpdCBtb3ogc3BlYyk7XG59XG5cbkBtaXhpbiBjb2x1bW4tcnVsZS1zdHlsZSgkc3R5bGU6IG5vbmUpIHtcbiAgLy8gbm9uZSB8IGhpZGRlbiB8IGRhc2hlZCB8IGRvdHRlZCB8IGRvdWJsZSB8IGdyb292ZSB8IGluc2V0IHwgaW5zZXQgfCBvdXRzZXQgfCByaWRnZSB8IHNvbGlkXG4gIEBpbmNsdWRlIHByZWZpeGVyKGNvbHVtbi1ydWxlLXN0eWxlLCAkc3R5bGUsIHdlYmtpdCBtb3ogc3BlYyk7XG59XG5cbkBtaXhpbiBjb2x1bW4tcnVsZS13aWR0aCAoJHdpZHRoOiBub25lKSB7XG4gIEBpbmNsdWRlIHByZWZpeGVyKGNvbHVtbi1ydWxlLXdpZHRoLCAkd2lkdGgsIHdlYmtpdCBtb3ogc3BlYyk7XG59XG5cbkBtaXhpbiBjb2x1bW4tc3BhbigkYXJnOiBub25lKSB7XG4gIC8vIG5vbmUgfHwgYWxsXG4gIEBpbmNsdWRlIHByZWZpeGVyKGNvbHVtbi1zcGFuLCAkYXJnLCB3ZWJraXQgbW96IHNwZWMpO1xufVxuXG5AbWl4aW4gY29sdW1uLXdpZHRoKCRsZW5ndGg6IGF1dG8pIHtcbiAgLy8gYXV0byB8fCBsZW5ndGhcbiAgQGluY2x1ZGUgcHJlZml4ZXIoY29sdW1uLXdpZHRoLCAkbGVuZ3RoLCB3ZWJraXQgbW96IHNwZWMpO1xufVxuIiwiQG1peGluIGZpbHRlcigkZnVuY3Rpb246IG5vbmUpIHtcbiAgLy8gPGZpbHRlci1mdW5jdGlvbj4gWzxmaWx0ZXItZnVuY3Rpb25dKiB8IG5vbmVcbiAgQGluY2x1ZGUgcHJlZml4ZXIoZmlsdGVyLCAkZnVuY3Rpb24sIHdlYmtpdCBzcGVjKTtcbn1cbiIsIi8vIENTUzMgRmxleGlibGUgQm94IE1vZGVsIGFuZCBwcm9wZXJ0eSBkZWZhdWx0c1xuXG4vLyBDdXN0b20gc2hvcnRoYW5kIG5vdGF0aW9uIGZvciBmbGV4Ym94XG5AbWl4aW4gYm94KCRvcmllbnQ6IGlubGluZS1heGlzLCAkcGFjazogc3RhcnQsICRhbGlnbjogc3RyZXRjaCkge1xuICBAaW5jbHVkZSBkaXNwbGF5LWJveDtcbiAgQGluY2x1ZGUgYm94LW9yaWVudCgkb3JpZW50KTtcbiAgQGluY2x1ZGUgYm94LXBhY2soJHBhY2spO1xuICBAaW5jbHVkZSBib3gtYWxpZ24oJGFsaWduKTtcbn1cblxuQG1peGluIGRpc3BsYXktYm94IHtcbiAgZGlzcGxheTogLXdlYmtpdC1ib3g7XG4gIGRpc3BsYXk6IC1tb3otYm94O1xuICBkaXNwbGF5OiAtbXMtZmxleGJveDsgLy8gSUUgMTBcbiAgZGlzcGxheTogYm94O1xufVxuXG5AbWl4aW4gYm94LW9yaWVudCgkb3JpZW50OiBpbmxpbmUtYXhpcykge1xuLy8gaG9yaXpvbnRhbHx2ZXJ0aWNhbHxpbmxpbmUtYXhpc3xibG9jay1heGlzfGluaGVyaXRcbiAgQGluY2x1ZGUgcHJlZml4ZXIoYm94LW9yaWVudCwgJG9yaWVudCwgd2Via2l0IG1veiBzcGVjKTtcbn1cblxuQG1peGluIGJveC1wYWNrKCRwYWNrOiBzdGFydCkge1xuLy8gc3RhcnR8ZW5kfGNlbnRlcnxqdXN0aWZ5XG4gIEBpbmNsdWRlIHByZWZpeGVyKGJveC1wYWNrLCAkcGFjaywgd2Via2l0IG1veiBzcGVjKTtcbiAgLW1zLWZsZXgtcGFjazogJHBhY2s7IC8vIElFIDEwXG59XG5cbkBtaXhpbiBib3gtYWxpZ24oJGFsaWduOiBzdHJldGNoKSB7XG4vLyBzdGFydHxlbmR8Y2VudGVyfGJhc2VsaW5lfHN0cmV0Y2hcbiAgQGluY2x1ZGUgcHJlZml4ZXIoYm94LWFsaWduLCAkYWxpZ24sIHdlYmtpdCBtb3ogc3BlYyk7XG4gIC1tcy1mbGV4LWFsaWduOiAkYWxpZ247IC8vIElFIDEwXG59XG5cbkBtaXhpbiBib3gtZGlyZWN0aW9uKCRkaXJlY3Rpb246IG5vcm1hbCkge1xuLy8gbm9ybWFsfHJldmVyc2V8aW5oZXJpdFxuICBAaW5jbHVkZSBwcmVmaXhlcihib3gtZGlyZWN0aW9uLCAkZGlyZWN0aW9uLCB3ZWJraXQgbW96IHNwZWMpO1xuICAtbXMtZmxleC1kaXJlY3Rpb246ICRkaXJlY3Rpb247IC8vIElFIDEwXG59XG5cbkBtaXhpbiBib3gtbGluZXMoJGxpbmVzOiBzaW5nbGUpIHtcbi8vIHNpbmdsZXxtdWx0aXBsZVxuICBAaW5jbHVkZSBwcmVmaXhlcihib3gtbGluZXMsICRsaW5lcywgd2Via2l0IG1veiBzcGVjKTtcbn1cblxuQG1peGluIGJveC1vcmRpbmFsLWdyb3VwKCRpbnQ6IDEpIHtcbiAgQGluY2x1ZGUgcHJlZml4ZXIoYm94LW9yZGluYWwtZ3JvdXAsICRpbnQsIHdlYmtpdCBtb3ogc3BlYyk7XG4gIC1tcy1mbGV4LW9yZGVyOiAkaW50OyAvLyBJRSAxMFxufVxuXG5AbWl4aW4gYm94LWZsZXgoJHZhbHVlOiAwKSB7XG4gIEBpbmNsdWRlIHByZWZpeGVyKGJveC1mbGV4LCAkdmFsdWUsIHdlYmtpdCBtb3ogc3BlYyk7XG4gIC1tcy1mbGV4OiAkdmFsdWU7IC8vIElFIDEwXG59XG5cbkBtaXhpbiBib3gtZmxleC1ncm91cCgkaW50OiAxKSB7XG4gIEBpbmNsdWRlIHByZWZpeGVyKGJveC1mbGV4LWdyb3VwLCAkaW50LCB3ZWJraXQgbW96IHNwZWMpO1xufVxuXG4vLyBDU1MzIEZsZXhpYmxlIEJveCBNb2RlbCBhbmQgcHJvcGVydHkgZGVmYXVsdHNcbi8vIFVuaWZpZWQgYXR0cmlidXRlcyBmb3IgMjAwOSwgMjAxMSwgYW5kIDIwMTIgZmxhdm91cnMuXG5cbi8vIDIwMDkgLSBkaXNwbGF5IChib3ggfCBpbmxpbmUtYm94KVxuLy8gMjAxMSAtIGRpc3BsYXkgKGZsZXhib3ggfCBpbmxpbmUtZmxleGJveClcbi8vIDIwMTIgLSBkaXNwbGF5IChmbGV4IHwgaW5saW5lLWZsZXgpXG5AbWl4aW4gZGlzcGxheSgkdmFsdWUpIHtcbi8vIGZsZXggfCBpbmxpbmUtZmxleFxuICBAaWYgJHZhbHVlID09IFwiZmxleFwiIHtcbiAgICAvLyAyMDA5XG4gICAgZGlzcGxheTogLXdlYmtpdC1ib3g7XG4gICAgZGlzcGxheTogLW1vei1ib3g7XG4gICAgZGlzcGxheTogYm94O1xuXG4gICAgLy8gMjAxMlxuICAgIGRpc3BsYXk6IC13ZWJraXQtZmxleDtcbiAgICBkaXNwbGF5OiAtbW96LWZsZXg7XG4gICAgZGlzcGxheTogLW1zLWZsZXhib3g7IC8vIDIwMTEgKElFIDEwKVxuICAgIGRpc3BsYXk6IGZsZXg7XG4gIH0gQGVsc2UgaWYgJHZhbHVlID09IFwiaW5saW5lLWZsZXhcIiB7XG4gICAgZGlzcGxheTogLXdlYmtpdC1pbmxpbmUtYm94O1xuICAgIGRpc3BsYXk6IC1tb3otaW5saW5lLWJveDtcbiAgICBkaXNwbGF5OiBpbmxpbmUtYm94O1xuXG4gICAgZGlzcGxheTogLXdlYmtpdC1pbmxpbmUtZmxleDtcbiAgICBkaXNwbGF5OiAtbW96LWlubGluZS1mbGV4O1xuICAgIGRpc3BsYXk6IC1tcy1pbmxpbmUtZmxleGJveDtcbiAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgfSBAZWxzZSB7XG4gICAgZGlzcGxheTogJHZhbHVlO1xuICB9XG59XG5cbi8vIDIwMDkgLSBib3gtZmxleCAoaW50ZWdlcilcbi8vIDIwMTEgLSBmbGV4IChkZWNpbWFsIHwgd2lkdGggZGVjaW1hbClcbi8vIDIwMTIgLSBmbGV4IChpbnRlZ2VyIGludGVnZXIgd2lkdGgpXG5AbWl4aW4gZmxleCgkdmFsdWUpIHtcblxuICAvLyBHcmFiIGZsZXgtZ3JvdyBmb3Igb2xkZXIgYnJvd3NlcnMuXG4gICRmbGV4LWdyb3c6IG50aCgkdmFsdWUsIDEpO1xuXG4gIC8vIDIwMDlcbiAgQGluY2x1ZGUgcHJlZml4ZXIoYm94LWZsZXgsICRmbGV4LWdyb3csIHdlYmtpdCBtb3ogc3BlYyk7XG5cbiAgLy8gMjAxMSAoSUUgMTApLCAyMDEyXG4gIEBpbmNsdWRlIHByZWZpeGVyKGZsZXgsICR2YWx1ZSwgd2Via2l0IG1veiBtcyBzcGVjKTtcbn1cblxuLy8gMjAwOSAtIGJveC1vcmllbnQgKCBob3Jpem9udGFsIHwgdmVydGljYWwgfCBpbmxpbmUtYXhpcyB8IGJsb2NrLWF4aXMpXG4vLyAgICAgIC0gYm94LWRpcmVjdGlvbiAobm9ybWFsIHwgcmV2ZXJzZSlcbi8vIDIwMTEgLSBmbGV4LWRpcmVjdGlvbiAocm93IHwgcm93LXJldmVyc2UgfCBjb2x1bW4gfCBjb2x1bW4tcmV2ZXJzZSlcbi8vIDIwMTIgLSBmbGV4LWRpcmVjdGlvbiAocm93IHwgcm93LXJldmVyc2UgfCBjb2x1bW4gfCBjb2x1bW4tcmV2ZXJzZSlcbkBtaXhpbiBmbGV4LWRpcmVjdGlvbigkdmFsdWU6IHJvdykge1xuXG4gIC8vIEFsdCB2YWx1ZXMuXG4gICR2YWx1ZS0yMDA5OiAkdmFsdWU7XG4gICR2YWx1ZS0yMDExOiAkdmFsdWU7XG4gICRkaXJlY3Rpb246IG5vcm1hbDtcblxuICBAaWYgJHZhbHVlID09IHJvdyB7XG4gICAgJHZhbHVlLTIwMDk6IGhvcml6b250YWw7XG4gIH0gQGVsc2UgaWYgJHZhbHVlID09IFwicm93LXJldmVyc2VcIiB7XG4gICAgJHZhbHVlLTIwMDk6IGhvcml6b250YWw7XG4gICAgJGRpcmVjdGlvbjogcmV2ZXJzZTtcbiAgfSBAZWxzZSBpZiAkdmFsdWUgPT0gY29sdW1uIHtcbiAgICAkdmFsdWUtMjAwOTogdmVydGljYWw7XG4gIH0gQGVsc2UgaWYgJHZhbHVlID09IFwiY29sdW1uLXJldmVyc2VcIiB7XG4gICAgJHZhbHVlLTIwMDk6IHZlcnRpY2FsO1xuICAgICRkaXJlY3Rpb246IHJldmVyc2U7XG4gIH1cblxuICAvLyAyMDA5XG4gIEBpbmNsdWRlIHByZWZpeGVyKGJveC1vcmllbnQsICR2YWx1ZS0yMDA5LCB3ZWJraXQgbW96IHNwZWMpO1xuICBAaW5jbHVkZSBwcmVmaXhlcihib3gtZGlyZWN0aW9uLCAkZGlyZWN0aW9uLCB3ZWJraXQgbW96IHNwZWMpO1xuXG4gIC8vIDIwMTJcbiAgQGluY2x1ZGUgcHJlZml4ZXIoZmxleC1kaXJlY3Rpb24sICR2YWx1ZSwgd2Via2l0IG1veiBzcGVjKTtcblxuICAvLyAyMDExIChJRSAxMClcbiAgLW1zLWZsZXgtZGlyZWN0aW9uOiAkdmFsdWU7XG59XG5cbi8vIDIwMDkgLSBib3gtbGluZXMgKHNpbmdsZSB8IG11bHRpcGxlKVxuLy8gMjAxMSAtIGZsZXgtd3JhcCAobm93cmFwIHwgd3JhcCB8IHdyYXAtcmV2ZXJzZSlcbi8vIDIwMTIgLSBmbGV4LXdyYXAgKG5vd3JhcCB8IHdyYXAgfCB3cmFwLXJldmVyc2UpXG5AbWl4aW4gZmxleC13cmFwKCR2YWx1ZTogbm93cmFwKSB7XG4gIC8vIEFsdCB2YWx1ZXNcbiAgJGFsdC12YWx1ZTogJHZhbHVlO1xuICBAaWYgJHZhbHVlID09IG5vd3JhcCB7XG4gICAgJGFsdC12YWx1ZTogc2luZ2xlO1xuICB9IEBlbHNlIGlmICR2YWx1ZSA9PSB3cmFwIHtcbiAgICAkYWx0LXZhbHVlOiBtdWx0aXBsZTtcbiAgfSBAZWxzZSBpZiAkdmFsdWUgPT0gXCJ3cmFwLXJldmVyc2VcIiB7XG4gICAgJGFsdC12YWx1ZTogbXVsdGlwbGU7XG4gIH1cblxuICBAaW5jbHVkZSBwcmVmaXhlcihib3gtbGluZXMsICRhbHQtdmFsdWUsIHdlYmtpdCBtb3ogc3BlYyk7XG4gIEBpbmNsdWRlIHByZWZpeGVyKGZsZXgtd3JhcCwgJHZhbHVlLCB3ZWJraXQgbW96IG1zIHNwZWMpO1xufVxuXG4vLyAyMDA5IC0gVE9ETzogcGFyc2UgdmFsdWVzIGludG8gZmxleC1kaXJlY3Rpb24vZmxleC13cmFwXG4vLyAyMDExIC0gVE9ETzogcGFyc2UgdmFsdWVzIGludG8gZmxleC1kaXJlY3Rpb24vZmxleC13cmFwXG4vLyAyMDEyIC0gZmxleC1mbG93IChmbGV4LWRpcmVjdGlvbiB8fCBmbGV4LXdyYXApXG5AbWl4aW4gZmxleC1mbG93KCR2YWx1ZSkge1xuICBAaW5jbHVkZSBwcmVmaXhlcihmbGV4LWZsb3csICR2YWx1ZSwgd2Via2l0IG1veiBzcGVjKTtcbn1cblxuLy8gMjAwOSAtIGJveC1vcmRpbmFsLWdyb3VwIChpbnRlZ2VyKVxuLy8gMjAxMSAtIGZsZXgtb3JkZXIgKGludGVnZXIpXG4vLyAyMDEyIC0gb3JkZXIgKGludGVnZXIpXG5AbWl4aW4gb3JkZXIoJGludDogMCkge1xuICAvLyAyMDA5XG4gIEBpbmNsdWRlIHByZWZpeGVyKGJveC1vcmRpbmFsLWdyb3VwLCAkaW50LCB3ZWJraXQgbW96IHNwZWMpO1xuXG4gIC8vIDIwMTJcbiAgQGluY2x1ZGUgcHJlZml4ZXIob3JkZXIsICRpbnQsIHdlYmtpdCBtb3ogc3BlYyk7XG5cbiAgLy8gMjAxMSAoSUUgMTApXG4gIC1tcy1mbGV4LW9yZGVyOiAkaW50O1xufVxuXG4vLyAyMDEyIC0gZmxleC1ncm93IChudW1iZXIpXG5AbWl4aW4gZmxleC1ncm93KCRudW1iZXI6IDApIHtcbiAgQGluY2x1ZGUgcHJlZml4ZXIoZmxleC1ncm93LCAkbnVtYmVyLCB3ZWJraXQgbW96IHNwZWMpO1xuICAtbXMtZmxleC1wb3NpdGl2ZTogJG51bWJlcjtcbn1cblxuLy8gMjAxMiAtIGZsZXgtc2hyaW5rIChudW1iZXIpXG5AbWl4aW4gZmxleC1zaHJpbmsoJG51bWJlcjogMSkge1xuICBAaW5jbHVkZSBwcmVmaXhlcihmbGV4LXNocmluaywgJG51bWJlciwgd2Via2l0IG1veiBzcGVjKTtcbiAgLW1zLWZsZXgtbmVnYXRpdmU6ICRudW1iZXI7XG59XG5cbi8vIDIwMTIgLSBmbGV4LWJhc2lzIChudW1iZXIpXG5AbWl4aW4gZmxleC1iYXNpcygkd2lkdGg6IGF1dG8pIHtcbiAgQGluY2x1ZGUgcHJlZml4ZXIoZmxleC1iYXNpcywgJHdpZHRoLCB3ZWJraXQgbW96IHNwZWMpO1xuICAtbXMtZmxleC1wcmVmZXJyZWQtc2l6ZTogJHdpZHRoO1xufVxuXG4vLyAyMDA5IC0gYm94LXBhY2sgKHN0YXJ0IHwgZW5kIHwgY2VudGVyIHwganVzdGlmeSlcbi8vIDIwMTEgLSBmbGV4LXBhY2sgKHN0YXJ0IHwgZW5kIHwgY2VudGVyIHwganVzdGlmeSlcbi8vIDIwMTIgLSBqdXN0aWZ5LWNvbnRlbnQgKGZsZXgtc3RhcnQgfCBmbGV4LWVuZCB8IGNlbnRlciB8IHNwYWNlLWJldHdlZW4gfCBzcGFjZS1hcm91bmQpXG5AbWl4aW4ganVzdGlmeS1jb250ZW50KCR2YWx1ZTogZmxleC1zdGFydCkge1xuXG4gIC8vIEFsdCB2YWx1ZXMuXG4gICRhbHQtdmFsdWU6ICR2YWx1ZTtcbiAgQGlmICR2YWx1ZSA9PSBcImZsZXgtc3RhcnRcIiB7XG4gICAgJGFsdC12YWx1ZTogc3RhcnQ7XG4gIH0gQGVsc2UgaWYgJHZhbHVlID09IFwiZmxleC1lbmRcIiB7XG4gICAgJGFsdC12YWx1ZTogZW5kO1xuICB9IEBlbHNlIGlmICR2YWx1ZSA9PSBcInNwYWNlLWJldHdlZW5cIiB7XG4gICAgJGFsdC12YWx1ZToganVzdGlmeTtcbiAgfSBAZWxzZSBpZiAkdmFsdWUgPT0gXCJzcGFjZS1hcm91bmRcIiB7XG4gICAgJGFsdC12YWx1ZTogZGlzdHJpYnV0ZTtcbiAgfVxuXG4gIC8vIDIwMDlcbiAgQGluY2x1ZGUgcHJlZml4ZXIoYm94LXBhY2ssICRhbHQtdmFsdWUsIHdlYmtpdCBtb3ogc3BlYyk7XG5cbiAgLy8gMjAxMlxuICBAaW5jbHVkZSBwcmVmaXhlcihqdXN0aWZ5LWNvbnRlbnQsICR2YWx1ZSwgd2Via2l0IG1veiBtcyBvIHNwZWMpO1xuXG4gIC8vIDIwMTEgKElFIDEwKVxuICAtbXMtZmxleC1wYWNrOiAkYWx0LXZhbHVlO1xufVxuXG4vLyAyMDA5IC0gYm94LWFsaWduIChzdGFydCB8IGVuZCB8IGNlbnRlciB8IGJhc2VsaW5lIHwgc3RyZXRjaClcbi8vIDIwMTEgLSBmbGV4LWFsaWduIChzdGFydCB8IGVuZCB8IGNlbnRlciB8IGJhc2VsaW5lIHwgc3RyZXRjaClcbi8vIDIwMTIgLSBhbGlnbi1pdGVtcyAoZmxleC1zdGFydCB8IGZsZXgtZW5kIHwgY2VudGVyIHwgYmFzZWxpbmUgfCBzdHJldGNoKVxuQG1peGluIGFsaWduLWl0ZW1zKCR2YWx1ZTogc3RyZXRjaCkge1xuXG4gICRhbHQtdmFsdWU6ICR2YWx1ZTtcblxuICBAaWYgJHZhbHVlID09IFwiZmxleC1zdGFydFwiIHtcbiAgICAkYWx0LXZhbHVlOiBzdGFydDtcbiAgfSBAZWxzZSBpZiAkdmFsdWUgPT0gXCJmbGV4LWVuZFwiIHtcbiAgICAkYWx0LXZhbHVlOiBlbmQ7XG4gIH1cblxuICAvLyAyMDA5XG4gIEBpbmNsdWRlIHByZWZpeGVyKGJveC1hbGlnbiwgJGFsdC12YWx1ZSwgd2Via2l0IG1veiBzcGVjKTtcblxuICAvLyAyMDEyXG4gIEBpbmNsdWRlIHByZWZpeGVyKGFsaWduLWl0ZW1zLCAkdmFsdWUsIHdlYmtpdCBtb3ogbXMgbyBzcGVjKTtcblxuICAvLyAyMDExIChJRSAxMClcbiAgLW1zLWZsZXgtYWxpZ246ICRhbHQtdmFsdWU7XG59XG5cbi8vIDIwMTEgLSBmbGV4LWl0ZW0tYWxpZ24gKGF1dG8gfCBzdGFydCB8IGVuZCB8IGNlbnRlciB8IGJhc2VsaW5lIHwgc3RyZXRjaClcbi8vIDIwMTIgLSBhbGlnbi1zZWxmIChhdXRvIHwgZmxleC1zdGFydCB8IGZsZXgtZW5kIHwgY2VudGVyIHwgYmFzZWxpbmUgfCBzdHJldGNoKVxuQG1peGluIGFsaWduLXNlbGYoJHZhbHVlOiBhdXRvKSB7XG5cbiAgJHZhbHVlLTIwMTE6ICR2YWx1ZTtcbiAgQGlmICR2YWx1ZSA9PSBcImZsZXgtc3RhcnRcIiB7XG4gICAgJHZhbHVlLTIwMTE6IHN0YXJ0O1xuICB9IEBlbHNlIGlmICR2YWx1ZSA9PSBcImZsZXgtZW5kXCIge1xuICAgICR2YWx1ZS0yMDExOiBlbmQ7XG4gIH1cblxuICAvLyAyMDEyXG4gIEBpbmNsdWRlIHByZWZpeGVyKGFsaWduLXNlbGYsICR2YWx1ZSwgd2Via2l0IG1veiBzcGVjKTtcblxuICAvLyAyMDExIChJRSAxMClcbiAgLW1zLWZsZXgtaXRlbS1hbGlnbjogJHZhbHVlLTIwMTE7XG59XG5cbi8vIDIwMTEgLSBmbGV4LWxpbmUtcGFjayAoc3RhcnQgfCBlbmQgfCBjZW50ZXIgfCBqdXN0aWZ5IHwgZGlzdHJpYnV0ZSB8IHN0cmV0Y2gpXG4vLyAyMDEyIC0gYWxpZ24tY29udGVudCAoZmxleC1zdGFydCB8IGZsZXgtZW5kIHwgY2VudGVyIHwgc3BhY2UtYmV0d2VlbiB8IHNwYWNlLWFyb3VuZCB8IHN0cmV0Y2gpXG5AbWl4aW4gYWxpZ24tY29udGVudCgkdmFsdWU6IHN0cmV0Y2gpIHtcblxuICAkdmFsdWUtMjAxMTogJHZhbHVlO1xuICBAaWYgJHZhbHVlID09IFwiZmxleC1zdGFydFwiIHtcbiAgICAkdmFsdWUtMjAxMTogc3RhcnQ7XG4gIH0gQGVsc2UgaWYgJHZhbHVlID09IFwiZmxleC1lbmRcIiB7XG4gICAgJHZhbHVlLTIwMTE6IGVuZDtcbiAgfSBAZWxzZSBpZiAkdmFsdWUgPT0gXCJzcGFjZS1iZXR3ZWVuXCIge1xuICAgICR2YWx1ZS0yMDExOiBqdXN0aWZ5O1xuICB9IEBlbHNlIGlmICR2YWx1ZSA9PSBcInNwYWNlLWFyb3VuZFwiIHtcbiAgICAkdmFsdWUtMjAxMTogZGlzdHJpYnV0ZTtcbiAgfVxuXG4gIC8vIDIwMTJcbiAgQGluY2x1ZGUgcHJlZml4ZXIoYWxpZ24tY29udGVudCwgJHZhbHVlLCB3ZWJraXQgbW96IHNwZWMpO1xuXG4gIC8vIDIwMTEgKElFIDEwKVxuICAtbXMtZmxleC1saW5lLXBhY2s6ICR2YWx1ZS0yMDExO1xufVxuIiwiQG1peGluIGZvbnQtZmFjZShcbiAgJGZvbnQtZmFtaWx5LFxuICAkZmlsZS1wYXRoLFxuICAkd2VpZ2h0OiBub3JtYWwsXG4gICRzdHlsZTogbm9ybWFsLFxuICAkYXNzZXQtcGlwZWxpbmU6ICRhc3NldC1waXBlbGluZSxcbiAgJGZpbGUtZm9ybWF0czogZW90IHdvZmYyIHdvZmYgdHRmIHN2Zykge1xuXG4gICRmb250LXVybC1wcmVmaXg6IGZvbnQtdXJsLXByZWZpeGVyKCRhc3NldC1waXBlbGluZSk7XG5cbiAgQGZvbnQtZmFjZSB7XG4gICAgZm9udC1mYW1pbHk6ICRmb250LWZhbWlseTtcbiAgICBmb250LXN0eWxlOiAkc3R5bGU7XG4gICAgZm9udC13ZWlnaHQ6ICR3ZWlnaHQ7XG5cbiAgICBzcmM6IGZvbnQtc291cmNlLWRlY2xhcmF0aW9uKFxuICAgICAgJGZvbnQtZmFtaWx5LFxuICAgICAgJGZpbGUtcGF0aCxcbiAgICAgICRhc3NldC1waXBlbGluZSxcbiAgICAgICRmaWxlLWZvcm1hdHMsXG4gICAgICAkZm9udC11cmwtcHJlZml4XG4gICAgKTtcbiAgfVxufVxuIiwiQG1peGluIGZvbnQtZmVhdHVyZS1zZXR0aW5ncygkc2V0dGluZ3MuLi4pIHtcbiAgQGlmIGxlbmd0aCgkc2V0dGluZ3MpID09IDAgeyAkc2V0dGluZ3M6IG5vbmU7IH1cbiAgQGluY2x1ZGUgcHJlZml4ZXIoZm9udC1mZWF0dXJlLXNldHRpbmdzLCAkc2V0dGluZ3MsIHdlYmtpdCBtb3ogbXMgc3BlYyk7XG59XG4iLCIvLyBIaURQSSBtaXhpbi4gRGVmYXVsdCB2YWx1ZSBzZXQgdG8gMS4zIHRvIHRhcmdldCBHb29nbGUgTmV4dXMgNyAoaHR0cDovL2JqYW5nby5jb20vYXJ0aWNsZXMvbWluLWRldmljZS1waXhlbC1yYXRpby8pXG5AbWl4aW4gaGlkcGkoJHJhdGlvOiAxLjMpIHtcbiAgQG1lZGlhIG9ubHkgc2NyZWVuIGFuZCAoLXdlYmtpdC1taW4tZGV2aWNlLXBpeGVsLXJhdGlvOiAkcmF0aW8pLFxuICBvbmx5IHNjcmVlbiBhbmQgKG1pbi0tbW96LWRldmljZS1waXhlbC1yYXRpbzogJHJhdGlvKSxcbiAgb25seSBzY3JlZW4gYW5kICgtby1taW4tZGV2aWNlLXBpeGVsLXJhdGlvOiAjeyRyYXRpb30vMSksXG4gIG9ubHkgc2NyZWVuIGFuZCAobWluLXJlc29sdXRpb246IHJvdW5kKCRyYXRpbyAqIDk2ZHBpKSksXG4gIG9ubHkgc2NyZWVuIGFuZCAobWluLXJlc29sdXRpb246ICRyYXRpbyAqIDFkcHB4KSB7XG4gICAgQGNvbnRlbnQ7XG4gIH1cbn1cbiIsIkBtaXhpbiBoeXBoZW5zKCRoeXBoZW5hdGlvbjogbm9uZSkge1xuICAvLyBub25lIHwgbWFudWFsIHwgYXV0b1xuICBAaW5jbHVkZSBwcmVmaXhlcihoeXBoZW5zLCAkaHlwaGVuYXRpb24sIHdlYmtpdCBtb3ogbXMgc3BlYyk7XG59XG4iLCJAbWl4aW4gaW1hZ2UtcmVuZGVyaW5nICgkbW9kZTphdXRvKSB7XG5cbiAgQGlmICgkbW9kZSA9PSBjcmlzcC1lZGdlcykge1xuICAgIC1tcy1pbnRlcnBvbGF0aW9uLW1vZGU6IG5lYXJlc3QtbmVpZ2hib3I7IC8vIElFOCtcbiAgICBpbWFnZS1yZW5kZXJpbmc6IC1tb3otY3Jpc3AtZWRnZXM7XG4gICAgaW1hZ2UtcmVuZGVyaW5nOiAtby1jcmlzcC1lZGdlcztcbiAgICBpbWFnZS1yZW5kZXJpbmc6IC13ZWJraXQtb3B0aW1pemUtY29udHJhc3Q7XG4gICAgaW1hZ2UtcmVuZGVyaW5nOiBjcmlzcC1lZGdlcztcbiAgfVxuXG4gIEBlbHNlIHtcbiAgICBpbWFnZS1yZW5kZXJpbmc6ICRtb2RlO1xuICB9XG59XG4iLCIvLyBBZGRzIGtleWZyYW1lcyBibG9ja3MgZm9yIHN1cHBvcnRlZCBwcmVmaXhlcywgcmVtb3ZpbmcgcmVkdW5kYW50IHByZWZpeGVzIGluIHRoZSBibG9jaydzIGNvbnRlbnRcbkBtaXhpbiBrZXlmcmFtZXMoJG5hbWUpIHtcbiAgJG9yaWdpbmFsLXByZWZpeC1mb3Itd2Via2l0OiAgICAkcHJlZml4LWZvci13ZWJraXQ7XG4gICRvcmlnaW5hbC1wcmVmaXgtZm9yLW1vemlsbGE6ICAgJHByZWZpeC1mb3ItbW96aWxsYTtcbiAgJG9yaWdpbmFsLXByZWZpeC1mb3ItbWljcm9zb2Z0OiAkcHJlZml4LWZvci1taWNyb3NvZnQ7XG4gICRvcmlnaW5hbC1wcmVmaXgtZm9yLW9wZXJhOiAgICAgJHByZWZpeC1mb3Itb3BlcmE7XG4gICRvcmlnaW5hbC1wcmVmaXgtZm9yLXNwZWM6ICAgICAgJHByZWZpeC1mb3Itc3BlYztcblxuICBAaWYgJG9yaWdpbmFsLXByZWZpeC1mb3Itd2Via2l0IHtcbiAgICBAaW5jbHVkZSBkaXNhYmxlLXByZWZpeC1mb3ItYWxsKCk7XG4gICAgJHByZWZpeC1mb3Itd2Via2l0OiB0cnVlICFnbG9iYWw7XG4gICAgQC13ZWJraXQta2V5ZnJhbWVzICN7JG5hbWV9IHtcbiAgICAgIEBjb250ZW50O1xuICAgIH1cbiAgfVxuXG4gIEBpZiAkb3JpZ2luYWwtcHJlZml4LWZvci1tb3ppbGxhIHtcbiAgICBAaW5jbHVkZSBkaXNhYmxlLXByZWZpeC1mb3ItYWxsKCk7XG4gICAgJHByZWZpeC1mb3ItbW96aWxsYTogdHJ1ZSAhZ2xvYmFsO1xuICAgIEAtbW96LWtleWZyYW1lcyAjeyRuYW1lfSB7XG4gICAgICBAY29udGVudDtcbiAgICB9XG4gIH1cblxuICAkcHJlZml4LWZvci13ZWJraXQ6ICAgICRvcmlnaW5hbC1wcmVmaXgtZm9yLXdlYmtpdCAgICAhZ2xvYmFsO1xuICAkcHJlZml4LWZvci1tb3ppbGxhOiAgICRvcmlnaW5hbC1wcmVmaXgtZm9yLW1vemlsbGEgICAhZ2xvYmFsO1xuICAkcHJlZml4LWZvci1taWNyb3NvZnQ6ICRvcmlnaW5hbC1wcmVmaXgtZm9yLW1pY3Jvc29mdCAhZ2xvYmFsO1xuICAkcHJlZml4LWZvci1vcGVyYTogICAgICRvcmlnaW5hbC1wcmVmaXgtZm9yLW9wZXJhICAgICAhZ2xvYmFsO1xuICAkcHJlZml4LWZvci1zcGVjOiAgICAgICRvcmlnaW5hbC1wcmVmaXgtZm9yLXNwZWMgICAgICAhZ2xvYmFsO1xuXG4gIEBpZiAkb3JpZ2luYWwtcHJlZml4LWZvci1zcGVjIHtcbiAgICBAa2V5ZnJhbWVzICN7JG5hbWV9IHtcbiAgICAgIEBjb250ZW50O1xuICAgIH1cbiAgfVxufVxuIiwiQG1peGluIGxpbmVhci1ncmFkaWVudCgkcG9zLCAkZzEsICRnMjogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgJGczOiBudWxsLCAkZzQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICRnNTogbnVsbCwgJGc2OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAkZzc6IG51bGwsICRnODogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgJGc5OiBudWxsLCAkZzEwOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAkZmFsbGJhY2s6IG51bGwpIHtcbiAgLy8gRGV0ZWN0IHdoYXQgdHlwZSBvZiB2YWx1ZSBleGlzdHMgaW4gJHBvc1xuICAkcG9zLXR5cGU6IHR5cGUtb2YobnRoKCRwb3MsIDEpKTtcbiAgJHBvcy1zcGVjOiBudWxsO1xuICAkcG9zLWRlZ3JlZTogbnVsbDtcblxuICAvLyBJZiAkcG9zIGlzIG1pc3NpbmcgZnJvbSBtaXhpbiwgcmVhc3NpZ24gdmFycyBhbmQgYWRkIGRlZmF1bHQgcG9zaXRpb25cbiAgQGlmICgkcG9zLXR5cGUgPT0gY29sb3IpIG9yIChudGgoJHBvcywgMSkgPT0gXCJ0cmFuc3BhcmVudFwiKSAge1xuICAgICRnMTA6ICRnOTsgJGc5OiAkZzg7ICRnODogJGc3OyAkZzc6ICRnNjsgJGc2OiAkZzU7XG4gICAgJGc1OiAkZzQ7ICRnNDogJGczOyAkZzM6ICRnMjsgJGcyOiAkZzE7ICRnMTogJHBvcztcbiAgICAkcG9zOiBudWxsO1xuICB9XG5cbiAgQGlmICRwb3Mge1xuICAgICRwb3NpdGlvbnM6IF9saW5lYXItcG9zaXRpb25zLXBhcnNlcigkcG9zKTtcbiAgICAkcG9zLWRlZ3JlZTogbnRoKCRwb3NpdGlvbnMsIDEpO1xuICAgICRwb3Mtc3BlYzogICBudGgoJHBvc2l0aW9ucywgMik7XG4gIH1cblxuICAkZnVsbDogJGcxLCAkZzIsICRnMywgJGc0LCAkZzUsICRnNiwgJGc3LCAkZzgsICRnOSwgJGcxMDtcblxuICAvLyBTZXQgJGcxIGFzIHRoZSBkZWZhdWx0IGZhbGxiYWNrIGNvbG9yXG4gICRmYWxsYmFjay1jb2xvcjogbnRoKCRnMSwgMSk7XG5cbiAgLy8gSWYgJGZhbGxiYWNrIGlzIGEgY29sb3IgdXNlIHRoYXQgY29sb3IgYXMgdGhlIGZhbGxiYWNrIGNvbG9yXG4gIEBpZiAodHlwZS1vZigkZmFsbGJhY2spID09IGNvbG9yKSBvciAoJGZhbGxiYWNrID09IFwidHJhbnNwYXJlbnRcIikge1xuICAgICRmYWxsYmFjay1jb2xvcjogJGZhbGxiYWNrO1xuICB9XG5cbiAgYmFja2dyb3VuZC1jb2xvcjogJGZhbGxiYWNrLWNvbG9yO1xuICBiYWNrZ3JvdW5kLWltYWdlOiAtd2Via2l0LWxpbmVhci1ncmFkaWVudCgkcG9zLWRlZ3JlZSAkZnVsbCk7IC8vIFNhZmFyaSA1LjErLCBDaHJvbWVcbiAgYmFja2dyb3VuZC1pbWFnZTogdW5xdW90ZShcImxpbmVhci1ncmFkaWVudCgjeyRwb3Mtc3BlY30jeyRmdWxsfSlcIik7XG59XG4iLCJAbWl4aW4gcGVyc3BlY3RpdmUoJGRlcHRoOiBub25lKSB7XG4gIC8vIG5vbmUgfCA8bGVuZ3RoPlxuICBAaW5jbHVkZSBwcmVmaXhlcihwZXJzcGVjdGl2ZSwgJGRlcHRoLCB3ZWJraXQgbW96IHNwZWMpO1xufVxuXG5AbWl4aW4gcGVyc3BlY3RpdmUtb3JpZ2luKCR2YWx1ZTogNTAlIDUwJSkge1xuICBAaW5jbHVkZSBwcmVmaXhlcihwZXJzcGVjdGl2ZS1vcmlnaW4sICR2YWx1ZSwgd2Via2l0IG1veiBzcGVjKTtcbn1cbiIsIkBtaXhpbiBwbGFjZWhvbGRlciB7XG4gICRwbGFjZWhvbGRlcnM6IFwiOi13ZWJraXQtaW5wdXRcIiBcIjotbW96XCIgXCItbW96XCIgXCItbXMtaW5wdXRcIjtcbiAgQGVhY2ggJHBsYWNlaG9sZGVyIGluICRwbGFjZWhvbGRlcnMge1xuICAgICY6I3skcGxhY2Vob2xkZXJ9LXBsYWNlaG9sZGVyIHtcbiAgICAgIEBjb250ZW50O1xuICAgIH1cbiAgfVxufVxuIiwiLy8gUmVxdWlyZXMgU2FzcyAzLjErXG5AbWl4aW4gcmFkaWFsLWdyYWRpZW50KCRnMSwgJGcyLFxuICAgICAgICAgICAgICAgICAgICAgICAkZzM6IG51bGwsICRnNDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgJGc1OiBudWxsLCAkZzY6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICRnNzogbnVsbCwgJGc4OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAkZzk6IG51bGwsICRnMTA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICRwb3M6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICRzaGFwZS1zaXplOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAkZmFsbGJhY2s6IG51bGwpIHtcblxuICAkZGF0YTogX3JhZGlhbC1hcmctcGFyc2VyKCRnMSwgJGcyLCAkcG9zLCAkc2hhcGUtc2l6ZSk7XG4gICRnMTogIG50aCgkZGF0YSwgMSk7XG4gICRnMjogIG50aCgkZGF0YSwgMik7XG4gICRwb3M6IG50aCgkZGF0YSwgMyk7XG4gICRzaGFwZS1zaXplOiBudGgoJGRhdGEsIDQpO1xuXG4gICRmdWxsOiAkZzEsICRnMiwgJGczLCAkZzQsICRnNSwgJGc2LCAkZzcsICRnOCwgJGc5LCAkZzEwO1xuXG4gIC8vIFN0cmlwIGRlcHJlY2F0ZWQgY292ZXIvY29udGFpbiBmb3Igc3BlY1xuICAkc2hhcGUtc2l6ZS1zcGVjOiBfc2hhcGUtc2l6ZS1zdHJpcHBlcigkc2hhcGUtc2l6ZSk7XG5cbiAgLy8gU2V0ICRnMSBhcyB0aGUgZGVmYXVsdCBmYWxsYmFjayBjb2xvclxuICAkZmlyc3QtY29sb3I6IG50aCgkZnVsbCwgMSk7XG4gICRmYWxsYmFjay1jb2xvcjogbnRoKCRmaXJzdC1jb2xvciwgMSk7XG5cbiAgQGlmICh0eXBlLW9mKCRmYWxsYmFjaykgPT0gY29sb3IpIG9yICgkZmFsbGJhY2sgPT0gXCJ0cmFuc3BhcmVudFwiKSB7XG4gICAgJGZhbGxiYWNrLWNvbG9yOiAkZmFsbGJhY2s7XG4gIH1cblxuICAvLyBBZGQgQ29tbWFzIGFuZCBzcGFjZXNcbiAgJHNoYXBlLXNpemU6IGlmKCRzaGFwZS1zaXplLCBcIiN7JHNoYXBlLXNpemV9LCBcIiwgbnVsbCk7XG4gICRwb3M6ICAgICAgICBpZigkcG9zLCBcIiN7JHBvc30sIFwiLCBudWxsKTtcbiAgJHBvcy1zcGVjOiAgIGlmKCRwb3MsIFwiYXQgI3skcG9zfVwiLCBudWxsKTtcbiAgJHNoYXBlLXNpemUtc3BlYzogaWYoKCRzaGFwZS1zaXplLXNwZWMgIT0gXCIgXCIpIGFuZCAoJHBvcyA9PSBudWxsKSwgXCIjeyRzaGFwZS1zaXplLXNwZWN9LCBcIiwgXCIjeyRzaGFwZS1zaXplLXNwZWN9IFwiKTtcblxuICBiYWNrZ3JvdW5kLWNvbG9yOiAgJGZhbGxiYWNrLWNvbG9yO1xuICBiYWNrZ3JvdW5kLWltYWdlOiAtd2Via2l0LXJhZGlhbC1ncmFkaWVudCh1bnF1b3RlKCN7JHBvc30jeyRzaGFwZS1zaXplfSN7JGZ1bGx9KSk7XG4gIGJhY2tncm91bmQtaW1hZ2U6IHVucXVvdGUoXCJyYWRpYWwtZ3JhZGllbnQoI3skc2hhcGUtc2l6ZS1zcGVjfSN7JHBvcy1zcGVjfSN7JGZ1bGx9KVwiKTtcbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcclxuXHJcbi8vLyBPdXRwdXRzIHRoZSBzcGVjIGFuZCBwcmVmaXhlZCB2ZXJzaW9ucyBvZiB0aGUgYDo6c2VsZWN0aW9uYCBwc2V1ZG8tZWxlbWVudC5cclxuLy8vXHJcbi8vLyBAcGFyYW0ge0Jvb2x9ICRjdXJyZW50LXNlbGVjdG9yIFtmYWxzZV1cclxuLy8vICAgSWYgc2V0IHRvIGB0cnVlYCwgaXQgdGFrZXMgdGhlIGN1cnJlbnQgZWxlbWVudCBpbnRvIGNvbnNpZGVyYXRpb24uXHJcbi8vL1xyXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXHJcbi8vLyAgIC5lbGVtZW50IHtcclxuLy8vICAgICBAaW5jbHVkZSBzZWxlY3Rpb24odHJ1ZSkge1xyXG4vLy8gICAgICAgYmFja2dyb3VuZC1jb2xvcjogI2ZmYmI1MjtcclxuLy8vICAgICB9XHJcbi8vLyAgIH1cclxuLy8vXHJcbi8vLyBAZXhhbXBsZSBjc3MgLSBDU1MgT3V0cHV0XHJcbi8vLyAgIC5lbGVtZW50OjotbW96LXNlbGVjdGlvbiB7XHJcbi8vLyAgICAgYmFja2dyb3VuZC1jb2xvcjogI2ZmYmI1MjtcclxuLy8vICAgfVxyXG4vLy9cclxuLy8vICAgLmVsZW1lbnQ6OnNlbGVjdGlvbiB7XHJcbi8vLyAgICAgYmFja2dyb3VuZC1jb2xvcjogI2ZmYmI1MjtcclxuLy8vICAgfVxyXG5cclxuQG1peGluIHNlbGVjdGlvbigkY3VycmVudC1zZWxlY3RvcjogZmFsc2UpIHtcclxuICBAaWYgJGN1cnJlbnQtc2VsZWN0b3Ige1xyXG4gICAgJjo6LW1vei1zZWxlY3Rpb24ge1xyXG4gICAgICBAY29udGVudDtcclxuICAgIH1cclxuXHJcbiAgICAmOjpzZWxlY3Rpb24ge1xyXG4gICAgICBAY29udGVudDtcclxuICAgIH1cclxuICB9IEBlbHNlIHtcclxuICAgIDo6LW1vei1zZWxlY3Rpb24ge1xyXG4gICAgICBAY29udGVudDtcclxuICAgIH1cclxuXHJcbiAgICA6OnNlbGVjdGlvbiB7XHJcbiAgICAgIEBjb250ZW50O1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iLCJAbWl4aW4gdGV4dC1kZWNvcmF0aW9uKCR2YWx1ZSkge1xuLy8gPHRleHQtZGVjb3JhdGlvbi1saW5lPiB8fCA8dGV4dC1kZWNvcmF0aW9uLXN0eWxlPiB8fCA8dGV4dC1kZWNvcmF0aW9uLWNvbG9yPlxuICBAaW5jbHVkZSBwcmVmaXhlcih0ZXh0LWRlY29yYXRpb24sICR2YWx1ZSwgbW96KTtcbn1cblxuQG1peGluIHRleHQtZGVjb3JhdGlvbi1saW5lKCRsaW5lOiBub25lKSB7XG4vLyBub25lIHx8IHVuZGVybGluZSB8fCBvdmVybGluZSB8fCBsaW5lLXRocm91Z2hcbiAgQGluY2x1ZGUgcHJlZml4ZXIodGV4dC1kZWNvcmF0aW9uLWxpbmUsICRsaW5lLCBtb3opO1xufVxuXG5AbWl4aW4gdGV4dC1kZWNvcmF0aW9uLXN0eWxlKCRzdHlsZTogc29saWQpIHtcbi8vIHNvbGlkIHx8IGRvdWJsZSB8fCBkb3R0ZWQgfHwgZGFzaGVkIHx8IHdhdnlcbiAgQGluY2x1ZGUgcHJlZml4ZXIodGV4dC1kZWNvcmF0aW9uLXN0eWxlLCAkc3R5bGUsIG1veiB3ZWJraXQpO1xufVxuXG5AbWl4aW4gdGV4dC1kZWNvcmF0aW9uLWNvbG9yKCRjb2xvcjogY3VycmVudENvbG9yKSB7XG4vLyBjdXJyZW50Q29sb3IgfHwgPGNvbG9yPlxuICBAaW5jbHVkZSBwcmVmaXhlcih0ZXh0LWRlY29yYXRpb24tY29sb3IsICRjb2xvciwgbW96KTtcbn1cbiIsIkBtaXhpbiB0cmFuc2Zvcm0oJHByb3BlcnR5OiBub25lKSB7XG4gIC8vIG5vbmUgfCA8dHJhbnNmb3JtLWZ1bmN0aW9uPlxuICBAaW5jbHVkZSBwcmVmaXhlcih0cmFuc2Zvcm0sICRwcm9wZXJ0eSwgd2Via2l0IG1veiBtcyBvIHNwZWMpO1xufVxuXG5AbWl4aW4gdHJhbnNmb3JtLW9yaWdpbigkYXhlczogNTAlKSB7XG4gIC8vIHgtYXhpcyAtIGxlZnQgfCBjZW50ZXIgfCByaWdodCAgfCBsZW5ndGggfCAlXG4gIC8vIHktYXhpcyAtIHRvcCAgfCBjZW50ZXIgfCBib3R0b20gfCBsZW5ndGggfCAlXG4gIC8vIHotYXhpcyAtICAgICAgICAgICAgICAgICAgICAgICAgICBsZW5ndGhcbiAgQGluY2x1ZGUgcHJlZml4ZXIodHJhbnNmb3JtLW9yaWdpbiwgJGF4ZXMsIHdlYmtpdCBtb3ogbXMgbyBzcGVjKTtcbn1cblxuQG1peGluIHRyYW5zZm9ybS1zdHlsZSgkc3R5bGU6IGZsYXQpIHtcbiAgQGluY2x1ZGUgcHJlZml4ZXIodHJhbnNmb3JtLXN0eWxlLCAkc3R5bGUsIHdlYmtpdCBtb3ogbXMgbyBzcGVjKTtcbn1cbiIsIi8vIFNob3J0aGFuZCBtaXhpbi4gU3VwcG9ydHMgbXVsdGlwbGUgcGFyZW50aGVzZXMtZGVsaW1pbmF0ZWQgdmFsdWVzIGZvciBlYWNoIHZhcmlhYmxlLlxuLy8gRXhhbXBsZTogQGluY2x1ZGUgdHJhbnNpdGlvbiAoYWxsIDJzIGVhc2UtaW4tb3V0KTtcbi8vICAgICAgICAgIEBpbmNsdWRlIHRyYW5zaXRpb24gKG9wYWNpdHkgMXMgZWFzZS1pbiAycywgd2lkdGggMnMgZWFzZS1vdXQpO1xuLy8gICAgICAgICAgQGluY2x1ZGUgdHJhbnNpdGlvbi1wcm9wZXJ0eSAodHJhbnNmb3JtLCBvcGFjaXR5KTtcblxuQG1peGluIHRyYW5zaXRpb24oJHByb3BlcnRpZXMuLi4pIHtcbiAgLy8gRml4IGZvciB2ZW5kb3ItcHJlZml4IHRyYW5zZm9ybSBwcm9wZXJ0eVxuICAkbmVlZHMtcHJlZml4ZXM6IGZhbHNlO1xuICAkd2Via2l0OiAoKTtcbiAgJG1vejogKCk7XG4gICRzcGVjOiAoKTtcblxuICAvLyBDcmVhdGUgbGlzdHMgZm9yIHZlbmRvci1wcmVmaXhlZCB0cmFuc2Zvcm1cbiAgQGVhY2ggJGxpc3QgaW4gJHByb3BlcnRpZXMge1xuICAgIEBpZiBudGgoJGxpc3QsIDEpID09IFwidHJhbnNmb3JtXCIge1xuICAgICAgJG5lZWRzLXByZWZpeGVzOiB0cnVlO1xuICAgICAgJGxpc3QxOiAtd2Via2l0LXRyYW5zZm9ybTtcbiAgICAgICRsaXN0MjogLW1vei10cmFuc2Zvcm07XG4gICAgICAkbGlzdDM6ICgpO1xuXG4gICAgICBAZWFjaCAkdmFyIGluICRsaXN0IHtcbiAgICAgICAgJGxpc3QzOiBqb2luKCRsaXN0MywgJHZhcik7XG5cbiAgICAgICAgQGlmICR2YXIgIT0gXCJ0cmFuc2Zvcm1cIiB7XG4gICAgICAgICAgJGxpc3QxOiBqb2luKCRsaXN0MSwgJHZhcik7XG4gICAgICAgICAgJGxpc3QyOiBqb2luKCRsaXN0MiwgJHZhcik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgJHdlYmtpdDogYXBwZW5kKCR3ZWJraXQsICRsaXN0MSk7XG4gICAgICAkbW96OiAgICBhcHBlbmQoJG1veiwgICAgJGxpc3QyKTtcbiAgICAgICRzcGVjOiAgIGFwcGVuZCgkc3BlYywgICAkbGlzdDMpO1xuICAgIH0gQGVsc2Uge1xuICAgICAgJHdlYmtpdDogYXBwZW5kKCR3ZWJraXQsICRsaXN0LCBjb21tYSk7XG4gICAgICAkbW96OiAgICBhcHBlbmQoJG1veiwgICAgJGxpc3QsIGNvbW1hKTtcbiAgICAgICRzcGVjOiAgIGFwcGVuZCgkc3BlYywgICAkbGlzdCwgY29tbWEpO1xuICAgIH1cbiAgfVxuXG4gIEBpZiAkbmVlZHMtcHJlZml4ZXMge1xuICAgIC13ZWJraXQtdHJhbnNpdGlvbjogJHdlYmtpdDtcbiAgICAgICAtbW96LXRyYW5zaXRpb246ICRtb3o7XG4gICAgICAgICAgICB0cmFuc2l0aW9uOiAkc3BlYztcbiAgfSBAZWxzZSB7XG4gICAgQGlmIGxlbmd0aCgkcHJvcGVydGllcykgPj0gMSB7XG4gICAgICBAaW5jbHVkZSBwcmVmaXhlcih0cmFuc2l0aW9uLCAkcHJvcGVydGllcywgd2Via2l0IG1veiBzcGVjKTtcbiAgICB9IEBlbHNlIHtcbiAgICAgICRwcm9wZXJ0aWVzOiBhbGwgMC4xNXMgZWFzZS1vdXQgMHM7XG4gICAgICBAaW5jbHVkZSBwcmVmaXhlcih0cmFuc2l0aW9uLCAkcHJvcGVydGllcywgd2Via2l0IG1veiBzcGVjKTtcbiAgICB9XG4gIH1cbn1cblxuQG1peGluIHRyYW5zaXRpb24tcHJvcGVydHkoJHByb3BlcnRpZXMuLi4pIHtcbiAgLXdlYmtpdC10cmFuc2l0aW9uLXByb3BlcnR5OiB0cmFuc2l0aW9uLXByb3BlcnR5LW5hbWVzKCRwcm9wZXJ0aWVzLCBcIndlYmtpdFwiKTtcbiAgICAgLW1vei10cmFuc2l0aW9uLXByb3BlcnR5OiB0cmFuc2l0aW9uLXByb3BlcnR5LW5hbWVzKCRwcm9wZXJ0aWVzLCBcIm1velwiKTtcbiAgICAgICAgICB0cmFuc2l0aW9uLXByb3BlcnR5OiB0cmFuc2l0aW9uLXByb3BlcnR5LW5hbWVzKCRwcm9wZXJ0aWVzLCBmYWxzZSk7XG59XG5cbkBtaXhpbiB0cmFuc2l0aW9uLWR1cmF0aW9uKCR0aW1lcy4uLikge1xuICBAaW5jbHVkZSBwcmVmaXhlcih0cmFuc2l0aW9uLWR1cmF0aW9uLCAkdGltZXMsIHdlYmtpdCBtb3ogc3BlYyk7XG59XG5cbkBtaXhpbiB0cmFuc2l0aW9uLXRpbWluZy1mdW5jdGlvbigkbW90aW9ucy4uLikge1xuICAvLyBlYXNlIHwgbGluZWFyIHwgZWFzZS1pbiB8IGVhc2Utb3V0IHwgZWFzZS1pbi1vdXQgfCBjdWJpYy1iZXppZXIoKVxuICBAaW5jbHVkZSBwcmVmaXhlcih0cmFuc2l0aW9uLXRpbWluZy1mdW5jdGlvbiwgJG1vdGlvbnMsIHdlYmtpdCBtb3ogc3BlYyk7XG59XG5cbkBtaXhpbiB0cmFuc2l0aW9uLWRlbGF5KCR0aW1lcy4uLikge1xuICBAaW5jbHVkZSBwcmVmaXhlcih0cmFuc2l0aW9uLWRlbGF5LCAkdGltZXMsIHdlYmtpdCBtb3ogc3BlYyk7XG59XG4iLCJAbWl4aW4gdXNlci1zZWxlY3QoJHZhbHVlOiBub25lKSB7XG4gIEBpbmNsdWRlIHByZWZpeGVyKHVzZXItc2VsZWN0LCAkdmFsdWUsIHdlYmtpdCBtb3ogbXMgc3BlYyk7XG59XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbi8vLyBQcm92aWRlcyBhIHF1aWNrIG1ldGhvZCBmb3IgdGFyZ2V0aW5nIGBib3JkZXItY29sb3JgIG9uIHNwZWNpZmljIHNpZGVzIG9mIGEgYm94LiBVc2UgYSBgbnVsbGAgdmFsdWUgdG8g4oCcc2tpcOKAnSBhIHNpZGUuXG4vLy9cbi8vLyBAcGFyYW0ge0FyZ2xpc3R9ICR2YWxzXG4vLy8gICBMaXN0IG9mIGFyZ3VtZW50c1xuLy8vXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIEBpbmNsdWRlIGJvcmRlci1jb2xvcigjYTYwYjU1ICM3NmNkOWMgbnVsbCAjZThhZTFhKTtcbi8vLyAgIH1cbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgYm9yZGVyLWxlZnQtY29sb3I6ICNlOGFlMWE7XG4vLy8gICAgIGJvcmRlci1yaWdodC1jb2xvcjogIzc2Y2Q5Yztcbi8vLyAgICAgYm9yZGVyLXRvcC1jb2xvcjogI2E2MGI1NTtcbi8vLyAgIH1cbi8vL1xuLy8vIEByZXF1aXJlIHttaXhpbn0gZGlyZWN0aW9uYWwtcHJvcGVydHlcbi8vL1xuLy8vIEBvdXRwdXQgYGJvcmRlci1jb2xvcmBcblxuQG1peGluIGJvcmRlci1jb2xvcigkdmFscy4uLikge1xuICBAaW5jbHVkZSBkaXJlY3Rpb25hbC1wcm9wZXJ0eShib3JkZXIsIGNvbG9yLCAkdmFscy4uLik7XG59XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbi8vLyBQcm92aWRlcyBhIHF1aWNrIG1ldGhvZCBmb3IgdGFyZ2V0aW5nIGBib3JkZXItcmFkaXVzYCBvbiBib3RoIGNvcm5lcnMgb24gdGhlIHNpZGUgb2YgYSBib3guXG4vLy9cbi8vLyBAcGFyYW0ge051bWJlcn0gJHJhZGlpXG4vLy8gICBMaXN0IG9mIGFyZ3VtZW50c1xuLy8vXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXG4vLy8gICAuZWxlbWVudC1vbmUge1xuLy8vICAgICBAaW5jbHVkZSBib3JkZXItdG9wLXJhZGl1cyg1cHgpO1xuLy8vICAgfVxuLy8vXG4vLy8gICAuZWxlbWVudC10d28ge1xuLy8vICAgICBAaW5jbHVkZSBib3JkZXItbGVmdC1yYWRpdXMoM3B4KTtcbi8vLyAgIH1cbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgIC5lbGVtZW50LW9uZSB7XG4vLy8gICAgIGJvcmRlci10b3AtbGVmdC1yYWRpdXM6IDVweDtcbi8vLyAgICAgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6IDVweDtcbi8vLyAgIH1cbi8vL1xuLy8vICAgLmVsZW1lbnQtdHdvIHtcbi8vLyAgICAgYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1czogM3B4O1xuLy8vICAgICBib3JkZXItdG9wLWxlZnQtcmFkaXVzOiAzcHg7XG4vLy8gICB9XG4vLy9cbi8vLyBAb3V0cHV0IGBib3JkZXItcmFkaXVzYFxuXG5AbWl4aW4gYm9yZGVyLXRvcC1yYWRpdXMoJHJhZGlpKSB7XG4gIGJvcmRlci10b3AtbGVmdC1yYWRpdXM6ICRyYWRpaTtcbiAgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6ICRyYWRpaTtcbn1cblxuQG1peGluIGJvcmRlci1yaWdodC1yYWRpdXMoJHJhZGlpKSB7XG4gIGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiAkcmFkaWk7XG4gIGJvcmRlci10b3AtcmlnaHQtcmFkaXVzOiAkcmFkaWk7XG59XG5cbkBtaXhpbiBib3JkZXItYm90dG9tLXJhZGl1cygkcmFkaWkpIHtcbiAgYm9yZGVyLWJvdHRvbS1sZWZ0LXJhZGl1czogJHJhZGlpO1xuICBib3JkZXItYm90dG9tLXJpZ2h0LXJhZGl1czogJHJhZGlpO1xufVxuXG5AbWl4aW4gYm9yZGVyLWxlZnQtcmFkaXVzKCRyYWRpaSkge1xuICBib3JkZXItYm90dG9tLWxlZnQtcmFkaXVzOiAkcmFkaWk7XG4gIGJvcmRlci10b3AtbGVmdC1yYWRpdXM6ICRyYWRpaTtcbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIFByb3ZpZGVzIGEgcXVpY2sgbWV0aG9kIGZvciB0YXJnZXRpbmcgYGJvcmRlci1zdHlsZWAgb24gc3BlY2lmaWMgc2lkZXMgb2YgYSBib3guIFVzZSBhIGBudWxsYCB2YWx1ZSB0byDigJxza2lw4oCdIGEgc2lkZS5cbi8vL1xuLy8vIEBwYXJhbSB7QXJnbGlzdH0gJHZhbHNcbi8vLyAgIExpc3Qgb2YgYXJndW1lbnRzXG4vLy9cbi8vLyBAZXhhbXBsZSBzY3NzIC0gVXNhZ2Vcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgQGluY2x1ZGUgYm9yZGVyLXN0eWxlKGRhc2hlZCBudWxsIHNvbGlkKTtcbi8vLyAgIH1cbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgYm9yZGVyLWJvdHRvbS1zdHlsZTogc29saWQ7XG4vLy8gICAgIGJvcmRlci10b3Atc3R5bGU6IGRhc2hlZDtcbi8vLyAgIH1cbi8vL1xuLy8vIEByZXF1aXJlIHttaXhpbn0gZGlyZWN0aW9uYWwtcHJvcGVydHlcbi8vL1xuLy8vIEBvdXRwdXQgYGJvcmRlci1zdHlsZWBcblxuQG1peGluIGJvcmRlci1zdHlsZSgkdmFscy4uLikge1xuICBAaW5jbHVkZSBkaXJlY3Rpb25hbC1wcm9wZXJ0eShib3JkZXIsIHN0eWxlLCAkdmFscy4uLik7XG59XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbi8vLyBQcm92aWRlcyBhIHF1aWNrIG1ldGhvZCBmb3IgdGFyZ2V0aW5nIGBib3JkZXItd2lkdGhgIG9uIHNwZWNpZmljIHNpZGVzIG9mIGEgYm94LiBVc2UgYSBgbnVsbGAgdmFsdWUgdG8g4oCcc2tpcOKAnSBhIHNpZGUuXG4vLy9cbi8vLyBAcGFyYW0ge0FyZ2xpc3R9ICR2YWxzXG4vLy8gICBMaXN0IG9mIGFyZ3VtZW50c1xuLy8vXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIEBpbmNsdWRlIGJvcmRlci13aWR0aCgxZW0gbnVsbCAyMHB4KTtcbi8vLyAgIH1cbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgYm9yZGVyLWJvdHRvbS13aWR0aDogMjBweDtcbi8vLyAgICAgYm9yZGVyLXRvcC13aWR0aDogMWVtO1xuLy8vICAgfVxuLy8vXG4vLy8gQHJlcXVpcmUge21peGlufSBkaXJlY3Rpb25hbC1wcm9wZXJ0eVxuLy8vXG4vLy8gQG91dHB1dCBgYm9yZGVyLXdpZHRoYFxuXG5AbWl4aW4gYm9yZGVyLXdpZHRoKCR2YWxzLi4uKSB7XG4gIEBpbmNsdWRlIGRpcmVjdGlvbmFsLXByb3BlcnR5KGJvcmRlciwgd2lkdGgsICR2YWxzLi4uKTtcbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIEdlbmVyYXRlcyB2YXJpYWJsZXMgZm9yIGFsbCBidXR0b25zLiBQbGVhc2Ugbm90ZSB0aGF0IHlvdSBtdXN0IHVzZSBpbnRlcnBvbGF0aW9uIG9uIHRoZSB2YXJpYWJsZTogYCN7JGFsbC1idXR0b25zfWAuXG4vLy9cbi8vLyBAZXhhbXBsZSBzY3NzIC0gVXNhZ2Vcbi8vLyAgICN7JGFsbC1idXR0b25zfSB7XG4vLy8gICAgIGJhY2tncm91bmQtY29sb3I6ICNmMDA7XG4vLy8gICB9XG4vLy9cbi8vLyAgICN7JGFsbC1idXR0b25zLWZvY3VzfSxcbi8vLyAgICN7JGFsbC1idXR0b25zLWhvdmVyfSB7XG4vLy8gICAgIGJhY2tncm91bmQtY29sb3I6ICMwZjA7XG4vLy8gICB9XG4vLy9cbi8vLyAgICN7JGFsbC1idXR0b25zLWFjdGl2ZX0ge1xuLy8vICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjMDBmO1xuLy8vICAgfVxuLy8vXG4vLy8gQGV4YW1wbGUgY3NzIC0gQ1NTIE91dHB1dFxuLy8vICAgYnV0dG9uLFxuLy8vICAgaW5wdXRbdHlwZT1cImJ1dHRvblwiXSxcbi8vLyAgIGlucHV0W3R5cGU9XCJyZXNldFwiXSxcbi8vLyAgIGlucHV0W3R5cGU9XCJzdWJtaXRcIl0ge1xuLy8vICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjZjAwO1xuLy8vICAgfVxuLy8vXG4vLy8gICBidXR0b246Zm9jdXMsXG4vLy8gICBpbnB1dFt0eXBlPVwiYnV0dG9uXCJdOmZvY3VzLFxuLy8vICAgaW5wdXRbdHlwZT1cInJlc2V0XCJdOmZvY3VzLFxuLy8vICAgaW5wdXRbdHlwZT1cInN1Ym1pdFwiXTpmb2N1cyxcbi8vLyAgIGJ1dHRvbjpob3Zlcixcbi8vLyAgIGlucHV0W3R5cGU9XCJidXR0b25cIl06aG92ZXIsXG4vLy8gICBpbnB1dFt0eXBlPVwicmVzZXRcIl06aG92ZXIsXG4vLy8gICBpbnB1dFt0eXBlPVwic3VibWl0XCJdOmhvdmVyIHtcbi8vLyAgICAgYmFja2dyb3VuZC1jb2xvcjogIzBmMDtcbi8vLyAgIH1cbi8vL1xuLy8vICAgYnV0dG9uOmFjdGl2ZSxcbi8vLyAgIGlucHV0W3R5cGU9XCJidXR0b25cIl06YWN0aXZlLFxuLy8vICAgaW5wdXRbdHlwZT1cInJlc2V0XCJdOmFjdGl2ZSxcbi8vLyAgIGlucHV0W3R5cGU9XCJzdWJtaXRcIl06YWN0aXZlIHtcbi8vLyAgICAgYmFja2dyb3VuZC1jb2xvcjogIzAwZjtcbi8vLyAgIH1cbi8vL1xuLy8vIEByZXF1aXJlIGFzc2lnbi1pbnB1dHNcbi8vL1xuLy8vIEB0eXBlIExpc3Rcbi8vL1xuLy8vIEB0b2RvIFJlbW92ZSBkb3VibGUgYXNzaWduZWQgdmFyaWFibGVzIChMaW5lcyA1OeKAkzYyKSBpbiB2NS4wLjBcblxuJGJ1dHRvbnMtbGlzdDogJ2J1dHRvbicsXG4gICAgICAgICAgICAgICAnaW5wdXRbdHlwZT1cImJ1dHRvblwiXScsXG4gICAgICAgICAgICAgICAnaW5wdXRbdHlwZT1cInJlc2V0XCJdJyxcbiAgICAgICAgICAgICAgICdpbnB1dFt0eXBlPVwic3VibWl0XCJdJztcblxuJGFsbC1idXR0b25zOiAgICAgICAgYXNzaWduLWlucHV0cygkYnV0dG9ucy1saXN0KTtcbiRhbGwtYnV0dG9ucy1hY3RpdmU6IGFzc2lnbi1pbnB1dHMoJGJ1dHRvbnMtbGlzdCwgYWN0aXZlKTtcbiRhbGwtYnV0dG9ucy1mb2N1czogIGFzc2lnbi1pbnB1dHMoJGJ1dHRvbnMtbGlzdCwgZm9jdXMpO1xuJGFsbC1idXR0b25zLWhvdmVyOiAgYXNzaWduLWlucHV0cygkYnV0dG9ucy1saXN0LCBob3Zlcik7XG5cbiRhbGwtYnV0dG9uLWlucHV0czogICAgICAgICRhbGwtYnV0dG9ucztcbiRhbGwtYnV0dG9uLWlucHV0cy1hY3RpdmU6ICRhbGwtYnV0dG9ucy1hY3RpdmU7XG4kYWxsLWJ1dHRvbi1pbnB1dHMtZm9jdXM6ICAkYWxsLWJ1dHRvbnMtZm9jdXM7XG4kYWxsLWJ1dHRvbi1pbnB1dHMtaG92ZXI6ICAkYWxsLWJ1dHRvbnMtaG92ZXI7XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbi8vLyBQcm92aWRlcyBhbiBlYXN5IHdheSB0byBpbmNsdWRlIGEgY2xlYXJmaXggZm9yIGNvbnRhaW5pbmcgZmxvYXRzLlxuLy8vXG4vLy8gQGxpbmsgaHR0cDovL2Nzc21vam8uY29tL2xhdGVzdF9uZXdfY2xlYXJmaXhfc29fZmFyL1xuLy8vXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIEBpbmNsdWRlIGNsZWFyZml4O1xuLy8vICAgfVxuLy8vXG4vLy8gQGV4YW1wbGUgY3NzIC0gQ1NTIE91dHB1dFxuLy8vICAgLmVsZW1lbnQ6OmFmdGVyIHtcbi8vLyAgICAgY2xlYXI6IGJvdGg7XG4vLy8gICAgIGNvbnRlbnQ6IFwiXCI7XG4vLy8gICAgIGRpc3BsYXk6IHRhYmxlO1xuLy8vICAgfVxuXG5AbWl4aW4gY2xlYXJmaXgge1xuICAmOjphZnRlciB7XG4gICAgY2xlYXI6IGJvdGg7XG4gICAgY29udGVudDogXCJcIjtcbiAgICBkaXNwbGF5OiB0YWJsZTtcbiAgfVxufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG4vLy8gVHJ1bmNhdGVzIHRleHQgYW5kIGFkZHMgYW4gZWxsaXBzaXMgdG8gcmVwcmVzZW50IG92ZXJmbG93LlxuLy8vXG4vLy8gQHBhcmFtIHtOdW1iZXJ9ICR3aWR0aCBbMTAwJV1cbi8vLyAgIE1heC13aWR0aCBmb3IgdGhlIHN0cmluZyB0byByZXNwZWN0IGJlZm9yZSBiZWluZyB0cnVuY2F0ZWRcbi8vL1xuLy8vIEBleGFtcGxlIHNjc3MgLSBVc2FnZVxuLy8vICAgLmVsZW1lbnQge1xuLy8vICAgICBAaW5jbHVkZSBlbGxpcHNpcztcbi8vLyAgIH1cbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xuLy8vICAgICBtYXgtd2lkdGg6IDEwMCU7XG4vLy8gICAgIG92ZXJmbG93OiBoaWRkZW47XG4vLy8gICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuLy8vICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuLy8vICAgICB3b3JkLXdyYXA6IG5vcm1hbDtcbi8vLyAgIH1cblxuQG1peGluIGVsbGlwc2lzKCR3aWR0aDogMTAwJSkge1xuICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG4gIG1heC13aWR0aDogJHdpZHRoO1xuICBvdmVyZmxvdzogaGlkZGVuO1xuICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgd29yZC13cmFwOiBub3JtYWw7XG59XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbi8vLyBHZW9yZ2lhIGZvbnQgc3RhY2suXG4vLy9cbi8vLyBAdHlwZSBMaXN0XG5cbiRnZW9yZ2lhOiBcIkdlb3JnaWFcIiwgXCJDYW1icmlhXCIsIFwiVGltZXMgTmV3IFJvbWFuXCIsIFwiVGltZXNcIiwgc2VyaWY7XG5cbi8vLyBIZWx2ZXRpY2EgZm9udCBzdGFjay5cbi8vL1xuLy8vIEB0eXBlIExpc3RcblxuJGhlbHZldGljYTogXCJIZWx2ZXRpY2EgTmV1ZVwiLCBcIkhlbHZldGljYVwiLCBcIlJvYm90b1wiLCBcIkFyaWFsXCIsIHNhbnMtc2VyaWY7XG5cbi8vLyBMdWNpZGEgR3JhbmRlIGZvbnQgc3RhY2suXG4vLy9cbi8vLyBAdHlwZSBMaXN0XG5cbiRsdWNpZGEtZ3JhbmRlOiBcIkx1Y2lkYSBHcmFuZGVcIiwgXCJUYWhvbWFcIiwgXCJWZXJkYW5hXCIsIFwiQXJpYWxcIiwgc2Fucy1zZXJpZjtcblxuLy8vIE1vbm9zcGFjZSBmb250IHN0YWNrLlxuLy8vXG4vLy8gQHR5cGUgTGlzdFxuXG4kbW9ub3NwYWNlOiBcIkJpdHN0cmVhbSBWZXJhIFNhbnMgTW9ub1wiLCBcIkNvbnNvbGFzXCIsIFwiQ291cmllclwiLCBtb25vc3BhY2U7XG5cbi8vLyBWZXJkYW5hIGZvbnQgc3RhY2suXG4vLy9cbi8vLyBAdHlwZSBMaXN0XG5cbiR2ZXJkYW5hOiBcIlZlcmRhbmFcIiwgXCJHZW5ldmFcIiwgc2Fucy1zZXJpZjtcbiIsIi8vLyBIaWRlcyB0aGUgdGV4dCBpbiBhbiBlbGVtZW50LCBjb21tb25seSB1c2VkIHRvIHNob3cgYW4gaW1hZ2UuIFNvbWUgZWxlbWVudHMgd2lsbCBuZWVkIGJsb2NrLWxldmVsIHN0eWxlcyBhcHBsaWVkLlxuLy8vXG4vLy8gQGxpbmsgaHR0cDovL3plbGRtYW4uY29tLzIwMTIvMDMvMDEvcmVwbGFjaW5nLXRoZS05OTk5cHgtaGFjay1uZXctaW1hZ2UtcmVwbGFjZW1lbnRcbi8vL1xuLy8vIEBleGFtcGxlIHNjc3MgLSBVc2FnZVxuLy8vICAgLmVsZW1lbnQge1xuLy8vICAgICBAaW5jbHVkZSBoaWRlLXRleHQ7XG4vLy8gICB9XG4vLy9cbi8vLyBAZXhhbXBsZSBjc3MgLSBDU1MgT3V0cHV0XG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIG92ZXJmbG93OiBoaWRkZW47XG4vLy8gICAgIHRleHQtaW5kZW50OiAxMDElO1xuLy8vICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuLy8vICAgfVxuLy8vXG4vLy8gQHRvZG8gUmVtb3ZlIGhlaWdodCBhcmd1bWVudCBpbiB2NS4wLjBcblxuQG1peGluIGhpZGUtdGV4dCgkaGVpZ2h0OiBudWxsKSB7XG4gIG92ZXJmbG93OiBoaWRkZW47XG4gIHRleHQtaW5kZW50OiAxMDElO1xuICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuXG4gIEBpZiAkaGVpZ2h0IHtcbiAgICBAd2FybiBcIlRoZSBgaGlkZS10ZXh0YCBtaXhpbiBoYXMgY2hhbmdlZCBhbmQgbm8gbG9uZ2VyIHJlcXVpcmVzIGEgaGVpZ2h0LiBUaGUgaGVpZ2h0IGFyZ3VtZW50IHdpbGwgbm8gbG9uZ2VyIGJlIGFjY2VwdGVkIGluIHY1LjAuMFwiO1xuICB9XG59XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbi8vLyBQcm92aWRlcyBhIHF1aWNrIG1ldGhvZCBmb3IgdGFyZ2V0aW5nIGBtYXJnaW5gIG9uIHNwZWNpZmljIHNpZGVzIG9mIGEgYm94LiBVc2UgYSBgbnVsbGAgdmFsdWUgdG8g4oCcc2tpcOKAnSBhIHNpZGUuXG4vLy9cbi8vLyBAcGFyYW0ge0FyZ2xpc3R9ICR2YWxzXG4vLy8gICBMaXN0IG9mIGFyZ3VtZW50c1xuLy8vXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIEBpbmNsdWRlIG1hcmdpbihudWxsIDEwcHggM2VtIDIwdmgpO1xuLy8vICAgfVxuLy8vXG4vLy8gQGV4YW1wbGUgY3NzIC0gQ1NTIE91dHB1dFxuLy8vICAgLmVsZW1lbnQge1xuLy8vICAgICBtYXJnaW4tYm90dG9tOiAzZW07XG4vLy8gICAgIG1hcmdpbi1sZWZ0OiAyMHZoO1xuLy8vICAgICBtYXJnaW4tcmlnaHQ6IDEwcHg7XG4vLy8gICB9XG4vLy9cbi8vLyBAcmVxdWlyZSB7bWl4aW59IGRpcmVjdGlvbmFsLXByb3BlcnR5XG4vLy9cbi8vLyBAb3V0cHV0IGBtYXJnaW5gXG5cbkBtaXhpbiBtYXJnaW4oJHZhbHMuLi4pIHtcbiAgQGluY2x1ZGUgZGlyZWN0aW9uYWwtcHJvcGVydHkobWFyZ2luLCBmYWxzZSwgJHZhbHMuLi4pO1xufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG4vLy8gUHJvdmlkZXMgYSBxdWljayBtZXRob2QgZm9yIHRhcmdldGluZyBgcGFkZGluZ2Agb24gc3BlY2lmaWMgc2lkZXMgb2YgYSBib3guIFVzZSBhIGBudWxsYCB2YWx1ZSB0byDigJxza2lw4oCdIGEgc2lkZS5cbi8vL1xuLy8vIEBwYXJhbSB7QXJnbGlzdH0gJHZhbHNcbi8vLyAgIExpc3Qgb2YgYXJndW1lbnRzXG4vLy9cbi8vLyBAZXhhbXBsZSBzY3NzIC0gVXNhZ2Vcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgQGluY2x1ZGUgcGFkZGluZygxMnZoIG51bGwgMTBweCA1JSk7XG4vLy8gICB9XG4vLy9cbi8vLyBAZXhhbXBsZSBjc3MgLSBDU1MgT3V0cHV0XG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIHBhZGRpbmctYm90dG9tOiAxMHB4O1xuLy8vICAgICBwYWRkaW5nLWxlZnQ6IDUlO1xuLy8vICAgICBwYWRkaW5nLXRvcDogMTJ2aDtcbi8vLyAgIH1cbi8vL1xuLy8vIEByZXF1aXJlIHttaXhpbn0gZGlyZWN0aW9uYWwtcHJvcGVydHlcbi8vL1xuLy8vIEBvdXRwdXQgYHBhZGRpbmdgXG5cbkBtaXhpbiBwYWRkaW5nKCR2YWxzLi4uKSB7XG4gIEBpbmNsdWRlIGRpcmVjdGlvbmFsLXByb3BlcnR5KHBhZGRpbmcsIGZhbHNlLCAkdmFscy4uLik7XG59XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbi8vLyBQcm92aWRlcyBhIHF1aWNrIG1ldGhvZCBmb3Igc2V0dGluZyBhbiBlbGVtZW504oCZcyBwb3NpdGlvbi4gVXNlIGEgYG51bGxgIHZhbHVlIHRvIOKAnHNraXDigJ0gYSBzaWRlLlxuLy8vXG4vLy8gQHBhcmFtIHtQb3NpdGlvbn0gJHBvc2l0aW9uIFtyZWxhdGl2ZV1cbi8vLyAgIEEgQ1NTIHBvc2l0aW9uIHZhbHVlXG4vLy9cbi8vLyBAcGFyYW0ge0FyZ2xpc3R9ICRjb29yZGluYXRlcyBbbnVsbCBudWxsIG51bGwgbnVsbF1cbi8vLyAgIExpc3Qgb2YgdmFsdWVzIHRoYXQgY29ycmVzcG9uZCB0byB0aGUgNC12YWx1ZSBzeW50YXggZm9yIHRoZSBlZGdlcyBvZiBhIGJveFxuLy8vXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIEBpbmNsdWRlIHBvc2l0aW9uKGFic29sdXRlLCAwIG51bGwgbnVsbCAxMGVtKTtcbi8vLyAgIH1cbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgbGVmdDogMTBlbTtcbi8vLyAgICAgcG9zaXRpb246IGFic29sdXRlO1xuLy8vICAgICB0b3A6IDA7XG4vLy8gICB9XG4vLy9cbi8vLyBAcmVxdWlyZSB7ZnVuY3Rpb259IGlzLWxlbmd0aFxuLy8vIEByZXF1aXJlIHtmdW5jdGlvbn0gdW5wYWNrXG5cbkBtaXhpbiBwb3NpdGlvbigkcG9zaXRpb246IHJlbGF0aXZlLCAkY29vcmRpbmF0ZXM6IG51bGwgbnVsbCBudWxsIG51bGwpIHtcbiAgQGlmIHR5cGUtb2YoJHBvc2l0aW9uKSA9PSBsaXN0IHtcbiAgICAkY29vcmRpbmF0ZXM6ICRwb3NpdGlvbjtcbiAgICAkcG9zaXRpb246IHJlbGF0aXZlO1xuICB9XG5cbiAgJGNvb3JkaW5hdGVzOiB1bnBhY2soJGNvb3JkaW5hdGVzKTtcblxuICAkb2Zmc2V0czogKFxuICAgIHRvcDogICAgbnRoKCRjb29yZGluYXRlcywgMSksXG4gICAgcmlnaHQ6ICBudGgoJGNvb3JkaW5hdGVzLCAyKSxcbiAgICBib3R0b206IG50aCgkY29vcmRpbmF0ZXMsIDMpLFxuICAgIGxlZnQ6ICAgbnRoKCRjb29yZGluYXRlcywgNClcbiAgKTtcblxuICBwb3NpdGlvbjogJHBvc2l0aW9uO1xuXG4gIEBlYWNoICRvZmZzZXQsICR2YWx1ZSBpbiAkb2Zmc2V0cyB7XG4gICAgQGlmIGlzLWxlbmd0aCgkdmFsdWUpIHtcbiAgICAgICN7JG9mZnNldH06ICR2YWx1ZTtcbiAgICB9XG4gIH1cbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIEEgbWl4aW4gZm9yIGdlbmVyYXRpbmcgdmVuZG9yIHByZWZpeGVzIG9uIG5vbi1zdGFuZGFyZGl6ZWQgcHJvcGVydGllcy5cbi8vL1xuLy8vIEBwYXJhbSB7U3RyaW5nfSAkcHJvcGVydHlcbi8vLyAgIFByb3BlcnR5IHRvIHByZWZpeFxuLy8vXG4vLy8gQHBhcmFtIHsqfSAkdmFsdWVcbi8vLyAgIFZhbHVlIHRvIHVzZVxuLy8vXG4vLy8gQHBhcmFtIHtMaXN0fSAkcHJlZml4ZXNcbi8vLyAgIFByZWZpeGVzIHRvIGRlZmluZVxuLy8vXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIEBpbmNsdWRlIHByZWZpeGVyKGJvcmRlci1yYWRpdXMsIDEwcHgsIHdlYmtpdCBtcyBzcGVjKTtcbi8vLyAgIH1cbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgLXdlYmtpdC1ib3JkZXItcmFkaXVzOiAxMHB4O1xuLy8vICAgICAtbW96LWJvcmRlci1yYWRpdXM6IDEwcHg7XG4vLy8gICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4vLy8gICB9XG4vLy9cbi8vLyBAcmVxdWlyZSB7dmFyaWFibGV9ICRwcmVmaXgtZm9yLXdlYmtpdFxuLy8vIEByZXF1aXJlIHt2YXJpYWJsZX0gJHByZWZpeC1mb3ItbW96aWxsYVxuLy8vIEByZXF1aXJlIHt2YXJpYWJsZX0gJHByZWZpeC1mb3ItbWljcm9zb2Z0XG4vLy8gQHJlcXVpcmUge3ZhcmlhYmxlfSAkcHJlZml4LWZvci1vcGVyYVxuLy8vIEByZXF1aXJlIHt2YXJpYWJsZX0gJHByZWZpeC1mb3Itc3BlY1xuXG5AbWl4aW4gcHJlZml4ZXIoJHByb3BlcnR5LCAkdmFsdWUsICRwcmVmaXhlcykge1xuICBAZWFjaCAkcHJlZml4IGluICRwcmVmaXhlcyB7XG4gICAgQGlmICRwcmVmaXggPT0gd2Via2l0IHtcbiAgICAgIEBpZiAkcHJlZml4LWZvci13ZWJraXQge1xuICAgICAgICAtd2Via2l0LSN7JHByb3BlcnR5fTogJHZhbHVlO1xuICAgICAgfVxuICAgIH0gQGVsc2UgaWYgJHByZWZpeCA9PSBtb3oge1xuICAgICAgQGlmICRwcmVmaXgtZm9yLW1vemlsbGEge1xuICAgICAgICAtbW96LSN7JHByb3BlcnR5fTogJHZhbHVlO1xuICAgICAgfVxuICAgIH0gQGVsc2UgaWYgJHByZWZpeCA9PSBtcyB7XG4gICAgICBAaWYgJHByZWZpeC1mb3ItbWljcm9zb2Z0IHtcbiAgICAgICAgLW1zLSN7JHByb3BlcnR5fTogJHZhbHVlO1xuICAgICAgfVxuICAgIH0gQGVsc2UgaWYgJHByZWZpeCA9PSBvIHtcbiAgICAgIEBpZiAkcHJlZml4LWZvci1vcGVyYSB7XG4gICAgICAgIC1vLSN7JHByb3BlcnR5fTogJHZhbHVlO1xuICAgICAgfVxuICAgIH0gQGVsc2UgaWYgJHByZWZpeCA9PSBzcGVjIHtcbiAgICAgIEBpZiAkcHJlZml4LWZvci1zcGVjIHtcbiAgICAgICAgI3skcHJvcGVydHl9OiAkdmFsdWU7XG4gICAgICB9XG4gICAgfSBAZWxzZSAge1xuICAgICAgQHdhcm4gXCJVbnJlY29nbml6ZWQgcHJlZml4OiAjeyRwcmVmaXh9XCI7XG4gICAgfVxuICB9XG59XG5cbkBtaXhpbiBkaXNhYmxlLXByZWZpeC1mb3ItYWxsKCkge1xuICAkcHJlZml4LWZvci13ZWJraXQ6ICAgIGZhbHNlICFnbG9iYWw7XG4gICRwcmVmaXgtZm9yLW1vemlsbGE6ICAgZmFsc2UgIWdsb2JhbDtcbiAgJHByZWZpeC1mb3ItbWljcm9zb2Z0OiBmYWxzZSAhZ2xvYmFsO1xuICAkcHJlZml4LWZvci1vcGVyYTogICAgIGZhbHNlICFnbG9iYWw7XG4gICRwcmVmaXgtZm9yLXNwZWM6ICAgICAgZmFsc2UgIWdsb2JhbDtcbn1cbiIsIkBtaXhpbiByZXRpbmEtaW1hZ2UoJGZpbGVuYW1lLCAkYmFja2dyb3VuZC1zaXplLCAkZXh0ZW5zaW9uOiBwbmcsICRyZXRpbmEtZmlsZW5hbWU6IG51bGwsICRyZXRpbmEtc3VmZml4OiBfMngsICRhc3NldC1waXBlbGluZTogJGFzc2V0LXBpcGVsaW5lKSB7XG4gIEBpZiAkYXNzZXQtcGlwZWxpbmUge1xuICAgIGJhY2tncm91bmQtaW1hZ2U6IGltYWdlLXVybChcIiN7JGZpbGVuYW1lfS4jeyRleHRlbnNpb259XCIpO1xuICB9IEBlbHNlIHtcbiAgICBiYWNrZ3JvdW5kLWltYWdlOiAgICAgICB1cmwoXCIjeyRmaWxlbmFtZX0uI3skZXh0ZW5zaW9ufVwiKTtcbiAgfVxuXG4gIEBpbmNsdWRlIGhpZHBpIHtcbiAgICBAaWYgJGFzc2V0LXBpcGVsaW5lIHtcbiAgICAgIEBpZiAkcmV0aW5hLWZpbGVuYW1lIHtcbiAgICAgICAgYmFja2dyb3VuZC1pbWFnZTogaW1hZ2UtdXJsKFwiI3skcmV0aW5hLWZpbGVuYW1lfS4jeyRleHRlbnNpb259XCIpO1xuICAgICAgfSBAZWxzZSB7XG4gICAgICAgIGJhY2tncm91bmQtaW1hZ2U6IGltYWdlLXVybChcIiN7JGZpbGVuYW1lfSN7JHJldGluYS1zdWZmaXh9LiN7JGV4dGVuc2lvbn1cIik7XG4gICAgICB9XG4gICAgfSBAZWxzZSB7XG4gICAgICBAaWYgJHJldGluYS1maWxlbmFtZSB7XG4gICAgICAgIGJhY2tncm91bmQtaW1hZ2U6IHVybChcIiN7JHJldGluYS1maWxlbmFtZX0uI3skZXh0ZW5zaW9ufVwiKTtcbiAgICAgIH0gQGVsc2Uge1xuICAgICAgICBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoXCIjeyRmaWxlbmFtZX0jeyRyZXRpbmEtc3VmZml4fS4jeyRleHRlbnNpb259XCIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGJhY2tncm91bmQtc2l6ZTogJGJhY2tncm91bmQtc2l6ZTtcbiAgfVxufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG4vLy8gU2V0cyB0aGUgYHdpZHRoYCBhbmQgYGhlaWdodGAgb2YgdGhlIGVsZW1lbnQuXG4vLy9cbi8vLyBAcGFyYW0ge0xpc3R9ICRzaXplXG4vLy8gICBBIGxpc3Qgb2YgYXQgbW9zdCAyIHNpemUgdmFsdWVzLlxuLy8vXG4vLy8gICBJZiB0aGVyZSBpcyBvbmx5IGEgc2luZ2xlIHZhbHVlIGluIGAkc2l6ZWAgaXQgaXMgdXNlZCBmb3IgYm90aCB3aWR0aCBhbmQgaGVpZ2h0LiBBbGwgdW5pdHMgYXJlIHN1cHBvcnRlZC5cbi8vL1xuLy8vIEBleGFtcGxlIHNjc3MgLSBVc2FnZVxuLy8vICAgLmZpcnN0LWVsZW1lbnQge1xuLy8vICAgICBAaW5jbHVkZSBzaXplKDJlbSk7XG4vLy8gICB9XG4vLy9cbi8vLyAgIC5zZWNvbmQtZWxlbWVudCB7XG4vLy8gICAgIEBpbmNsdWRlIHNpemUoYXV0byAxMGVtKTtcbi8vLyAgIH1cbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgIC5maXJzdC1lbGVtZW50IHtcbi8vLyAgICAgd2lkdGg6IDJlbTtcbi8vLyAgICAgaGVpZ2h0OiAyZW07XG4vLy8gICB9XG4vLy9cbi8vLyAgIC5zZWNvbmQtZWxlbWVudCB7XG4vLy8gICAgIHdpZHRoOiBhdXRvO1xuLy8vICAgICBoZWlnaHQ6IDEwZW07XG4vLy8gICB9XG4vLy9cbi8vLyBAdG9kbyBSZWZhY3RvciBpbiA1LjAuMCB0byB1c2UgYSBjb21tYS1zZXBhcmF0ZWQgYXJndW1lbnRcblxuQG1peGluIHNpemUoJHZhbHVlKSB7XG4gICR3aWR0aDogbnRoKCR2YWx1ZSwgMSk7XG4gICRoZWlnaHQ6ICR3aWR0aDtcblxuICBAaWYgbGVuZ3RoKCR2YWx1ZSkgPiAxIHtcbiAgICAkaGVpZ2h0OiBudGgoJHZhbHVlLCAyKTtcbiAgfVxuXG4gIEBpZiBpcy1zaXplKCRoZWlnaHQpIHtcbiAgICBoZWlnaHQ6ICRoZWlnaHQ7XG4gIH0gQGVsc2Uge1xuICAgIEB3YXJuIFwiYCN7JGhlaWdodH1gIGlzIG5vdCBhIHZhbGlkIGxlbmd0aCBmb3IgdGhlIGAkaGVpZ2h0YCBwYXJhbWV0ZXIgaW4gdGhlIGBzaXplYCBtaXhpbi5cIjtcbiAgfVxuXG4gIEBpZiBpcy1zaXplKCR3aWR0aCkge1xuICAgIHdpZHRoOiAkd2lkdGg7XG4gIH0gQGVsc2Uge1xuICAgIEB3YXJuIFwiYCN7JHdpZHRofWAgaXMgbm90IGEgdmFsaWQgbGVuZ3RoIGZvciB0aGUgYCR3aWR0aGAgcGFyYW1ldGVyIGluIHRoZSBgc2l6ZWAgbWl4aW4uXCI7XG4gIH1cbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIEdlbmVyYXRlcyB2YXJpYWJsZXMgZm9yIGFsbCB0ZXh0LWJhc2VkIGlucHV0cy4gUGxlYXNlIG5vdGUgdGhhdCB5b3UgbXVzdCB1c2UgaW50ZXJwb2xhdGlvbiBvbiB0aGUgdmFyaWFibGU6IGAjeyRhbGwtdGV4dC1pbnB1dHN9YC5cbi8vL1xuLy8vIEBleGFtcGxlIHNjc3MgLSBVc2FnZVxuLy8vICAgI3skYWxsLXRleHQtaW5wdXRzfSB7XG4vLy8gICAgIGJvcmRlcjogMXB4IHNvbGlkICNmMDA7XG4vLy8gICB9XG4vLy9cbi8vLyAgICN7JGFsbC10ZXh0LWlucHV0cy1mb2N1c30sXG4vLy8gICAjeyRhbGwtdGV4dC1pbnB1dHMtaG92ZXJ9IHtcbi8vLyAgICAgYm9yZGVyOiAxcHggc29saWQgIzBmMDtcbi8vLyAgIH1cbi8vL1xuLy8vICAgI3skYWxsLXRleHQtaW5wdXRzLWFjdGl2ZX0ge1xuLy8vICAgICBib3JkZXI6IDFweCBzb2xpZCAjMDBmO1xuLy8vICAgfVxuLy8vXG4vLy8gQGV4YW1wbGUgY3NzIC0gQ1NTIE91dHB1dFxuLy8vICAgaW5wdXRbdHlwZT1cImNvbG9yXCJdLFxuLy8vICAgaW5wdXRbdHlwZT1cImRhdGVcIl0sXG4vLy8gICBpbnB1dFt0eXBlPVwiZGF0ZXRpbWVcIl0sXG4vLy8gICBpbnB1dFt0eXBlPVwiZGF0ZXRpbWUtbG9jYWxcIl0sXG4vLy8gICBpbnB1dFt0eXBlPVwiZW1haWxcIl0sXG4vLy8gICBpbnB1dFt0eXBlPVwibW9udGhcIl0sXG4vLy8gICBpbnB1dFt0eXBlPVwibnVtYmVyXCJdLFxuLy8vICAgaW5wdXRbdHlwZT1cInBhc3N3b3JkXCJdLFxuLy8vICAgaW5wdXRbdHlwZT1cInNlYXJjaFwiXSxcbi8vLyAgIGlucHV0W3R5cGU9XCJ0ZWxcIl0sXG4vLy8gICBpbnB1dFt0eXBlPVwidGV4dFwiXSxcbi8vLyAgIGlucHV0W3R5cGU9XCJ0aW1lXCJdLFxuLy8vICAgaW5wdXRbdHlwZT1cInVybFwiXSxcbi8vLyAgIGlucHV0W3R5cGU9XCJ3ZWVrXCJdLFxuLy8vICAgdGV4dGFyZWEge1xuLy8vICAgICBib3JkZXI6IDFweCBzb2xpZCAjZjAwO1xuLy8vICAgfVxuLy8vXG4vLy8gICBpbnB1dFt0eXBlPVwiY29sb3JcIl06Zm9jdXMsXG4vLy8gICBpbnB1dFt0eXBlPVwiZGF0ZVwiXTpmb2N1cyxcbi8vLyAgIGlucHV0W3R5cGU9XCJkYXRldGltZVwiXTpmb2N1cyxcbi8vLyAgIGlucHV0W3R5cGU9XCJkYXRldGltZS1sb2NhbFwiXTpmb2N1cyxcbi8vLyAgIGlucHV0W3R5cGU9XCJlbWFpbFwiXTpmb2N1cyxcbi8vLyAgIGlucHV0W3R5cGU9XCJtb250aFwiXTpmb2N1cyxcbi8vLyAgIGlucHV0W3R5cGU9XCJudW1iZXJcIl06Zm9jdXMsXG4vLy8gICBpbnB1dFt0eXBlPVwicGFzc3dvcmRcIl06Zm9jdXMsXG4vLy8gICBpbnB1dFt0eXBlPVwic2VhcmNoXCJdOmZvY3VzLFxuLy8vICAgaW5wdXRbdHlwZT1cInRlbFwiXTpmb2N1cyxcbi8vLyAgIGlucHV0W3R5cGU9XCJ0ZXh0XCJdOmZvY3VzLFxuLy8vICAgaW5wdXRbdHlwZT1cInRpbWVcIl06Zm9jdXMsXG4vLy8gICBpbnB1dFt0eXBlPVwidXJsXCJdOmZvY3VzLFxuLy8vICAgaW5wdXRbdHlwZT1cIndlZWtcIl06Zm9jdXMsXG4vLy8gICB0ZXh0YXJlYTpmb2N1cyxcbi8vLyAgIGlucHV0W3R5cGU9XCJjb2xvclwiXTpob3Zlcixcbi8vLyAgIGlucHV0W3R5cGU9XCJkYXRlXCJdOmhvdmVyLFxuLy8vICAgaW5wdXRbdHlwZT1cImRhdGV0aW1lXCJdOmhvdmVyLFxuLy8vICAgaW5wdXRbdHlwZT1cImRhdGV0aW1lLWxvY2FsXCJdOmhvdmVyLFxuLy8vICAgaW5wdXRbdHlwZT1cImVtYWlsXCJdOmhvdmVyLFxuLy8vICAgaW5wdXRbdHlwZT1cIm1vbnRoXCJdOmhvdmVyLFxuLy8vICAgaW5wdXRbdHlwZT1cIm51bWJlclwiXTpob3Zlcixcbi8vLyAgIGlucHV0W3R5cGU9XCJwYXNzd29yZFwiXTpob3Zlcixcbi8vLyAgIGlucHV0W3R5cGU9XCJzZWFyY2hcIl06aG92ZXIsXG4vLy8gICBpbnB1dFt0eXBlPVwidGVsXCJdOmhvdmVyLFxuLy8vICAgaW5wdXRbdHlwZT1cInRleHRcIl06aG92ZXIsXG4vLy8gICBpbnB1dFt0eXBlPVwidGltZVwiXTpob3Zlcixcbi8vLyAgIGlucHV0W3R5cGU9XCJ1cmxcIl06aG92ZXIsXG4vLy8gICBpbnB1dFt0eXBlPVwid2Vla1wiXTpob3Zlcixcbi8vLyAgIHRleHRhcmVhOmhvdmVyIHtcbi8vLyAgICAgYm9yZGVyOiAxcHggc29saWQgIzBmMDtcbi8vLyAgIH1cbi8vL1xuLy8vICAgaW5wdXRbdHlwZT1cImNvbG9yXCJdOmFjdGl2ZSxcbi8vLyAgIGlucHV0W3R5cGU9XCJkYXRlXCJdOmFjdGl2ZSxcbi8vLyAgIGlucHV0W3R5cGU9XCJkYXRldGltZVwiXTphY3RpdmUsXG4vLy8gICBpbnB1dFt0eXBlPVwiZGF0ZXRpbWUtbG9jYWxcIl06YWN0aXZlLFxuLy8vICAgaW5wdXRbdHlwZT1cImVtYWlsXCJdOmFjdGl2ZSxcbi8vLyAgIGlucHV0W3R5cGU9XCJtb250aFwiXTphY3RpdmUsXG4vLy8gICBpbnB1dFt0eXBlPVwibnVtYmVyXCJdOmFjdGl2ZSxcbi8vLyAgIGlucHV0W3R5cGU9XCJwYXNzd29yZFwiXTphY3RpdmUsXG4vLy8gICBpbnB1dFt0eXBlPVwic2VhcmNoXCJdOmFjdGl2ZSxcbi8vLyAgIGlucHV0W3R5cGU9XCJ0ZWxcIl06YWN0aXZlLFxuLy8vICAgaW5wdXRbdHlwZT1cInRleHRcIl06YWN0aXZlLFxuLy8vICAgaW5wdXRbdHlwZT1cInRpbWVcIl06YWN0aXZlLFxuLy8vICAgaW5wdXRbdHlwZT1cInVybFwiXTphY3RpdmUsXG4vLy8gICBpbnB1dFt0eXBlPVwid2Vla1wiXTphY3RpdmUsXG4vLy8gICB0ZXh0YXJlYTphY3RpdmUge1xuLy8vICAgICBib3JkZXI6IDFweCBzb2xpZCAjMDBmO1xuLy8vICAgfVxuLy8vXG4vLy8gQHJlcXVpcmUgYXNzaWduLWlucHV0c1xuLy8vXG4vLy8gQHR5cGUgTGlzdFxuXG4kdGV4dC1pbnB1dHMtbGlzdDogJ2lucHV0W3R5cGU9XCJjb2xvclwiXScsXG4gICAgICAgICAgICAgICAgICAgJ2lucHV0W3R5cGU9XCJkYXRlXCJdJyxcbiAgICAgICAgICAgICAgICAgICAnaW5wdXRbdHlwZT1cImRhdGV0aW1lXCJdJyxcbiAgICAgICAgICAgICAgICAgICAnaW5wdXRbdHlwZT1cImRhdGV0aW1lLWxvY2FsXCJdJyxcbiAgICAgICAgICAgICAgICAgICAnaW5wdXRbdHlwZT1cImVtYWlsXCJdJyxcbiAgICAgICAgICAgICAgICAgICAnaW5wdXRbdHlwZT1cIm1vbnRoXCJdJyxcbiAgICAgICAgICAgICAgICAgICAnaW5wdXRbdHlwZT1cIm51bWJlclwiXScsXG4gICAgICAgICAgICAgICAgICAgJ2lucHV0W3R5cGU9XCJwYXNzd29yZFwiXScsXG4gICAgICAgICAgICAgICAgICAgJ2lucHV0W3R5cGU9XCJzZWFyY2hcIl0nLFxuICAgICAgICAgICAgICAgICAgICdpbnB1dFt0eXBlPVwidGVsXCJdJyxcbiAgICAgICAgICAgICAgICAgICAnaW5wdXRbdHlwZT1cInRleHRcIl0nLFxuICAgICAgICAgICAgICAgICAgICdpbnB1dFt0eXBlPVwidGltZVwiXScsXG4gICAgICAgICAgICAgICAgICAgJ2lucHV0W3R5cGU9XCJ1cmxcIl0nLFxuICAgICAgICAgICAgICAgICAgICdpbnB1dFt0eXBlPVwid2Vla1wiXScsXG4gICAgICAgICAgICAgICAgICAgJ3RleHRhcmVhJztcblxuJGFsbC10ZXh0LWlucHV0czogICAgICAgIGFzc2lnbi1pbnB1dHMoJHRleHQtaW5wdXRzLWxpc3QpO1xuJGFsbC10ZXh0LWlucHV0cy1hY3RpdmU6IGFzc2lnbi1pbnB1dHMoJHRleHQtaW5wdXRzLWxpc3QsIGFjdGl2ZSk7XG4kYWxsLXRleHQtaW5wdXRzLWZvY3VzOiAgYXNzaWduLWlucHV0cygkdGV4dC1pbnB1dHMtbGlzdCwgZm9jdXMpO1xuJGFsbC10ZXh0LWlucHV0cy1ob3ZlcjogIGFzc2lnbi1pbnB1dHMoJHRleHQtaW5wdXRzLWxpc3QsIGhvdmVyKTtcbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIENTUyBjdWJpYy1iZXppZXIgdGltaW5nIGZ1bmN0aW9ucy4gVGltaW5nIGZ1bmN0aW9ucyBjb3VydGVzeSBvZiBqcXVlcnkuZWFzaWUgKGdpdGh1Yi5jb20vamF1a2lhL2Vhc2llKVxuLy8vXG4vLy8gVGltaW5nIGZ1bmN0aW9ucyBhcmUgdGhlIHNhbWUgYXMgZGVtb2VkIGhlcmU6IGh0dHA6Ly9qcXVlcnl1aS5jb20vcmVzb3VyY2VzL2RlbW9zL2VmZmVjdC9lYXNpbmcuaHRtbFxuLy8vXG4vLy8gQHR5cGUgY3ViaWMtYmV6aWVyXG5cbiRlYXNlLWluLXF1YWQ6ICAgICAgY3ViaWMtYmV6aWVyKDAuNTUwLCAgMC4wODUsIDAuNjgwLCAwLjUzMCk7XG4kZWFzZS1pbi1jdWJpYzogICAgIGN1YmljLWJlemllcigwLjU1MCwgIDAuMDU1LCAwLjY3NSwgMC4xOTApO1xuJGVhc2UtaW4tcXVhcnQ6ICAgICBjdWJpYy1iZXppZXIoMC44OTUsICAwLjAzMCwgMC42ODUsIDAuMjIwKTtcbiRlYXNlLWluLXF1aW50OiAgICAgY3ViaWMtYmV6aWVyKDAuNzU1LCAgMC4wNTAsIDAuODU1LCAwLjA2MCk7XG4kZWFzZS1pbi1zaW5lOiAgICAgIGN1YmljLWJlemllcigwLjQ3MCwgIDAuMDAwLCAwLjc0NSwgMC43MTUpO1xuJGVhc2UtaW4tZXhwbzogICAgICBjdWJpYy1iZXppZXIoMC45NTAsICAwLjA1MCwgMC43OTUsIDAuMDM1KTtcbiRlYXNlLWluLWNpcmM6ICAgICAgY3ViaWMtYmV6aWVyKDAuNjAwLCAgMC4wNDAsIDAuOTgwLCAwLjMzNSk7XG4kZWFzZS1pbi1iYWNrOiAgICAgIGN1YmljLWJlemllcigwLjYwMCwgLTAuMjgwLCAwLjczNSwgMC4wNDUpO1xuXG4kZWFzZS1vdXQtcXVhZDogICAgIGN1YmljLWJlemllcigwLjI1MCwgIDAuNDYwLCAwLjQ1MCwgMC45NDApO1xuJGVhc2Utb3V0LWN1YmljOiAgICBjdWJpYy1iZXppZXIoMC4yMTUsICAwLjYxMCwgMC4zNTUsIDEuMDAwKTtcbiRlYXNlLW91dC1xdWFydDogICAgY3ViaWMtYmV6aWVyKDAuMTY1LCAgMC44NDAsIDAuNDQwLCAxLjAwMCk7XG4kZWFzZS1vdXQtcXVpbnQ6ICAgIGN1YmljLWJlemllcigwLjIzMCwgIDEuMDAwLCAwLjMyMCwgMS4wMDApO1xuJGVhc2Utb3V0LXNpbmU6ICAgICBjdWJpYy1iZXppZXIoMC4zOTAsICAwLjU3NSwgMC41NjUsIDEuMDAwKTtcbiRlYXNlLW91dC1leHBvOiAgICAgY3ViaWMtYmV6aWVyKDAuMTkwLCAgMS4wMDAsIDAuMjIwLCAxLjAwMCk7XG4kZWFzZS1vdXQtY2lyYzogICAgIGN1YmljLWJlemllcigwLjA3NSwgIDAuODIwLCAwLjE2NSwgMS4wMDApO1xuJGVhc2Utb3V0LWJhY2s6ICAgICBjdWJpYy1iZXppZXIoMC4xNzUsICAwLjg4NSwgMC4zMjAsIDEuMjc1KTtcblxuJGVhc2UtaW4tb3V0LXF1YWQ6ICBjdWJpYy1iZXppZXIoMC40NTUsICAwLjAzMCwgMC41MTUsIDAuOTU1KTtcbiRlYXNlLWluLW91dC1jdWJpYzogY3ViaWMtYmV6aWVyKDAuNjQ1LCAgMC4wNDUsIDAuMzU1LCAxLjAwMCk7XG4kZWFzZS1pbi1vdXQtcXVhcnQ6IGN1YmljLWJlemllcigwLjc3MCwgIDAuMDAwLCAwLjE3NSwgMS4wMDApO1xuJGVhc2UtaW4tb3V0LXF1aW50OiBjdWJpYy1iZXppZXIoMC44NjAsICAwLjAwMCwgMC4wNzAsIDEuMDAwKTtcbiRlYXNlLWluLW91dC1zaW5lOiAgY3ViaWMtYmV6aWVyKDAuNDQ1LCAgMC4wNTAsIDAuNTUwLCAwLjk1MCk7XG4kZWFzZS1pbi1vdXQtZXhwbzogIGN1YmljLWJlemllcigxLjAwMCwgIDAuMDAwLCAwLjAwMCwgMS4wMDApO1xuJGVhc2UtaW4tb3V0LWNpcmM6ICBjdWJpYy1iZXppZXIoMC43ODUsICAwLjEzNSwgMC4xNTAsIDAuODYwKTtcbiRlYXNlLWluLW91dC1iYWNrOiAgY3ViaWMtYmV6aWVyKDAuNjgwLCAtMC41NTAsIDAuMjY1LCAxLjU1MCk7XG4iLCJAbWl4aW4gdHJpYW5nbGUoJHNpemUsICRjb2xvciwgJGRpcmVjdGlvbikge1xuICAkd2lkdGg6IG50aCgkc2l6ZSwgMSk7XG4gICRoZWlnaHQ6IG50aCgkc2l6ZSwgbGVuZ3RoKCRzaXplKSk7XG4gICRmb3JlZ3JvdW5kLWNvbG9yOiBudGgoJGNvbG9yLCAxKTtcbiAgJGJhY2tncm91bmQtY29sb3I6IGlmKGxlbmd0aCgkY29sb3IpID09IDIsIG50aCgkY29sb3IsIDIpLCB0cmFuc3BhcmVudCk7XG4gIGhlaWdodDogMDtcbiAgd2lkdGg6IDA7XG5cbiAgQGlmICgkZGlyZWN0aW9uID09IHVwKSBvciAoJGRpcmVjdGlvbiA9PSBkb3duKSBvciAoJGRpcmVjdGlvbiA9PSByaWdodCkgb3IgKCRkaXJlY3Rpb24gPT0gbGVmdCkge1xuICAgICR3aWR0aDogJHdpZHRoIC8gMjtcbiAgICAkaGVpZ2h0OiBpZihsZW5ndGgoJHNpemUpID4gMSwgJGhlaWdodCwgJGhlaWdodC8yKTtcblxuICAgIEBpZiAkZGlyZWN0aW9uID09IHVwIHtcbiAgICAgIGJvcmRlci1ib3R0b206ICRoZWlnaHQgc29saWQgJGZvcmVncm91bmQtY29sb3I7XG4gICAgICBib3JkZXItbGVmdDogJHdpZHRoIHNvbGlkICRiYWNrZ3JvdW5kLWNvbG9yO1xuICAgICAgYm9yZGVyLXJpZ2h0OiAkd2lkdGggc29saWQgJGJhY2tncm91bmQtY29sb3I7XG4gICAgfSBAZWxzZSBpZiAkZGlyZWN0aW9uID09IHJpZ2h0IHtcbiAgICAgIGJvcmRlci1ib3R0b206ICR3aWR0aCBzb2xpZCAkYmFja2dyb3VuZC1jb2xvcjtcbiAgICAgIGJvcmRlci1sZWZ0OiAkaGVpZ2h0IHNvbGlkICRmb3JlZ3JvdW5kLWNvbG9yO1xuICAgICAgYm9yZGVyLXRvcDogJHdpZHRoIHNvbGlkICRiYWNrZ3JvdW5kLWNvbG9yO1xuICAgIH0gQGVsc2UgaWYgJGRpcmVjdGlvbiA9PSBkb3duIHtcbiAgICAgIGJvcmRlci1sZWZ0OiAkd2lkdGggc29saWQgJGJhY2tncm91bmQtY29sb3I7XG4gICAgICBib3JkZXItcmlnaHQ6ICR3aWR0aCBzb2xpZCAkYmFja2dyb3VuZC1jb2xvcjtcbiAgICAgIGJvcmRlci10b3A6ICRoZWlnaHQgc29saWQgJGZvcmVncm91bmQtY29sb3I7XG4gICAgfSBAZWxzZSBpZiAkZGlyZWN0aW9uID09IGxlZnQge1xuICAgICAgYm9yZGVyLWJvdHRvbTogJHdpZHRoIHNvbGlkICRiYWNrZ3JvdW5kLWNvbG9yO1xuICAgICAgYm9yZGVyLXJpZ2h0OiAkaGVpZ2h0IHNvbGlkICRmb3JlZ3JvdW5kLWNvbG9yO1xuICAgICAgYm9yZGVyLXRvcDogJHdpZHRoIHNvbGlkICRiYWNrZ3JvdW5kLWNvbG9yO1xuICAgIH1cbiAgfSBAZWxzZSBpZiAoJGRpcmVjdGlvbiA9PSB1cC1yaWdodCkgb3IgKCRkaXJlY3Rpb24gPT0gdXAtbGVmdCkge1xuICAgIGJvcmRlci10b3A6ICRoZWlnaHQgc29saWQgJGZvcmVncm91bmQtY29sb3I7XG5cbiAgICBAaWYgJGRpcmVjdGlvbiA9PSB1cC1yaWdodCB7XG4gICAgICBib3JkZXItbGVmdDogICR3aWR0aCBzb2xpZCAkYmFja2dyb3VuZC1jb2xvcjtcbiAgICB9IEBlbHNlIGlmICRkaXJlY3Rpb24gPT0gdXAtbGVmdCB7XG4gICAgICBib3JkZXItcmlnaHQ6ICR3aWR0aCBzb2xpZCAkYmFja2dyb3VuZC1jb2xvcjtcbiAgICB9XG4gIH0gQGVsc2UgaWYgKCRkaXJlY3Rpb24gPT0gZG93bi1yaWdodCkgb3IgKCRkaXJlY3Rpb24gPT0gZG93bi1sZWZ0KSB7XG4gICAgYm9yZGVyLWJvdHRvbTogJGhlaWdodCBzb2xpZCAkZm9yZWdyb3VuZC1jb2xvcjtcblxuICAgIEBpZiAkZGlyZWN0aW9uID09IGRvd24tcmlnaHQge1xuICAgICAgYm9yZGVyLWxlZnQ6ICAkd2lkdGggc29saWQgJGJhY2tncm91bmQtY29sb3I7XG4gICAgfSBAZWxzZSBpZiAkZGlyZWN0aW9uID09IGRvd24tbGVmdCB7XG4gICAgICBib3JkZXItcmlnaHQ6ICR3aWR0aCBzb2xpZCAkYmFja2dyb3VuZC1jb2xvcjtcbiAgICB9XG4gIH0gQGVsc2UgaWYgKCRkaXJlY3Rpb24gPT0gaW5zZXQtdXApIHtcbiAgICBib3JkZXItY29sb3I6ICRiYWNrZ3JvdW5kLWNvbG9yICRiYWNrZ3JvdW5kLWNvbG9yICRmb3JlZ3JvdW5kLWNvbG9yO1xuICAgIGJvcmRlci1zdHlsZTogc29saWQ7XG4gICAgYm9yZGVyLXdpZHRoOiAkaGVpZ2h0ICR3aWR0aDtcbiAgfSBAZWxzZSBpZiAoJGRpcmVjdGlvbiA9PSBpbnNldC1kb3duKSB7XG4gICAgYm9yZGVyLWNvbG9yOiAkZm9yZWdyb3VuZC1jb2xvciAkYmFja2dyb3VuZC1jb2xvciAkYmFja2dyb3VuZC1jb2xvcjtcbiAgICBib3JkZXItc3R5bGU6IHNvbGlkO1xuICAgIGJvcmRlci13aWR0aDogJGhlaWdodCAkd2lkdGg7XG4gIH0gQGVsc2UgaWYgKCRkaXJlY3Rpb24gPT0gaW5zZXQtcmlnaHQpIHtcbiAgICBib3JkZXItY29sb3I6ICRiYWNrZ3JvdW5kLWNvbG9yICRiYWNrZ3JvdW5kLWNvbG9yICRiYWNrZ3JvdW5kLWNvbG9yICRmb3JlZ3JvdW5kLWNvbG9yO1xuICAgIGJvcmRlci1zdHlsZTogc29saWQ7XG4gICAgYm9yZGVyLXdpZHRoOiAkd2lkdGggJGhlaWdodDtcbiAgfSBAZWxzZSBpZiAoJGRpcmVjdGlvbiA9PSBpbnNldC1sZWZ0KSB7XG4gICAgYm9yZGVyLWNvbG9yOiAkYmFja2dyb3VuZC1jb2xvciAkZm9yZWdyb3VuZC1jb2xvciAkYmFja2dyb3VuZC1jb2xvciAkYmFja2dyb3VuZC1jb2xvcjtcbiAgICBib3JkZXItc3R5bGU6IHNvbGlkO1xuICAgIGJvcmRlci13aWR0aDogJHdpZHRoICRoZWlnaHQ7XG4gIH1cbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIFByb3ZpZGVzIGFuIGVhc3kgd2F5IHRvIGNoYW5nZSB0aGUgYHdvcmQtd3JhcGAgcHJvcGVydHkuXG4vLy9cbi8vLyBAcGFyYW0ge1N0cmluZ30gJHdyYXAgW2JyZWFrLXdvcmRdXG4vLy8gICBWYWx1ZSBmb3IgdGhlIGB3b3JkLWJyZWFrYCBwcm9wZXJ0eS5cbi8vL1xuLy8vIEBleGFtcGxlIHNjc3MgLSBVc2FnZVxuLy8vICAgLndyYXBwZXIge1xuLy8vICAgICBAaW5jbHVkZSB3b3JkLXdyYXAoYnJlYWstd29yZCk7XG4vLy8gICB9XG4vLy9cbi8vLyBAZXhhbXBsZSBjc3MgLSBDU1MgT3V0cHV0XG4vLy8gICAud3JhcHBlciB7XG4vLy8gICAgIG92ZXJmbG93LXdyYXA6IGJyZWFrLXdvcmQ7XG4vLy8gICAgIHdvcmQtYnJlYWs6IGJyZWFrLWFsbDtcbi8vLyAgICAgd29yZC13cmFwOiBicmVhay13b3JkO1xuLy8vICAgfVxuXG5AbWl4aW4gd29yZC13cmFwKCR3cmFwOiBicmVhay13b3JkKSB7XG4gIG92ZXJmbG93LXdyYXA6ICR3cmFwO1xuICB3b3JkLXdyYXA6ICR3cmFwO1xuXG4gIEBpZiAkd3JhcCA9PSBicmVhay13b3JkIHtcbiAgICB3b3JkLWJyZWFrOiBicmVhay1hbGw7XG4gIH0gQGVsc2Uge1xuICAgIHdvcmQtYnJlYWs6ICR3cmFwO1xuICB9XG59XG4iLCIvLyBUaGUgZm9sbG93aW5nIGZlYXR1cmVzIGhhdmUgYmVlbiBkZXByZWNhdGVkIGFuZCB3aWxsIGJlIHJlbW92ZWQgaW4gdGhlIG5leHQgTUFKT1IgdmVyc2lvbiByZWxlYXNlXG5cbkBtaXhpbiBpbmxpbmUtYmxvY2sge1xuICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG5cbiAgQHdhcm4gXCJUaGUgaW5saW5lLWJsb2NrIG1peGluIGlzIGRlcHJlY2F0ZWQgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiB0aGUgbmV4dCBtYWpvciB2ZXJzaW9uIHJlbGVhc2VcIjtcbn1cblxuQG1peGluIGJ1dHRvbiAoJHN0eWxlOiBzaW1wbGUsICRiYXNlLWNvbG9yOiAjNDI5NGYwLCAkdGV4dC1zaXplOiBpbmhlcml0LCAkcGFkZGluZzogN3B4IDE4cHgpIHtcblxuICBAaWYgdHlwZS1vZigkc3R5bGUpID09IHN0cmluZyBhbmQgdHlwZS1vZigkYmFzZS1jb2xvcikgPT0gY29sb3Ige1xuICAgIEBpbmNsdWRlIGJ1dHRvbnN0eWxlKCRzdHlsZSwgJGJhc2UtY29sb3IsICR0ZXh0LXNpemUsICRwYWRkaW5nKTtcbiAgfVxuXG4gIEBpZiB0eXBlLW9mKCRzdHlsZSkgPT0gc3RyaW5nIGFuZCB0eXBlLW9mKCRiYXNlLWNvbG9yKSA9PSBudW1iZXIge1xuICAgICRwYWRkaW5nOiAkdGV4dC1zaXplO1xuICAgICR0ZXh0LXNpemU6ICRiYXNlLWNvbG9yO1xuICAgICRiYXNlLWNvbG9yOiAjNDI5NGYwO1xuXG4gICAgQGlmICRwYWRkaW5nID09IGluaGVyaXQge1xuICAgICAgJHBhZGRpbmc6IDdweCAxOHB4O1xuICAgIH1cblxuICAgIEBpbmNsdWRlIGJ1dHRvbnN0eWxlKCRzdHlsZSwgJGJhc2UtY29sb3IsICR0ZXh0LXNpemUsICRwYWRkaW5nKTtcbiAgfVxuXG4gIEBpZiB0eXBlLW9mKCRzdHlsZSkgPT0gY29sb3IgYW5kIHR5cGUtb2YoJGJhc2UtY29sb3IpID09IGNvbG9yIHtcbiAgICAkYmFzZS1jb2xvcjogJHN0eWxlO1xuICAgICRzdHlsZTogc2ltcGxlO1xuICAgIEBpbmNsdWRlIGJ1dHRvbnN0eWxlKCRzdHlsZSwgJGJhc2UtY29sb3IsICR0ZXh0LXNpemUsICRwYWRkaW5nKTtcbiAgfVxuXG4gIEBpZiB0eXBlLW9mKCRzdHlsZSkgPT0gY29sb3IgYW5kIHR5cGUtb2YoJGJhc2UtY29sb3IpID09IG51bWJlciB7XG4gICAgJHBhZGRpbmc6ICR0ZXh0LXNpemU7XG4gICAgJHRleHQtc2l6ZTogJGJhc2UtY29sb3I7XG4gICAgJGJhc2UtY29sb3I6ICRzdHlsZTtcbiAgICAkc3R5bGU6IHNpbXBsZTtcblxuICAgIEBpZiAkcGFkZGluZyA9PSBpbmhlcml0IHtcbiAgICAgICRwYWRkaW5nOiA3cHggMThweDtcbiAgICB9XG5cbiAgICBAaW5jbHVkZSBidXR0b25zdHlsZSgkc3R5bGUsICRiYXNlLWNvbG9yLCAkdGV4dC1zaXplLCAkcGFkZGluZyk7XG4gIH1cblxuICBAaWYgdHlwZS1vZigkc3R5bGUpID09IG51bWJlciB7XG4gICAgJHBhZGRpbmc6ICRiYXNlLWNvbG9yO1xuICAgICR0ZXh0LXNpemU6ICRzdHlsZTtcbiAgICAkYmFzZS1jb2xvcjogIzQyOTRmMDtcbiAgICAkc3R5bGU6IHNpbXBsZTtcblxuICAgIEBpZiAkcGFkZGluZyA9PSAjNDI5NGYwIHtcbiAgICAgICRwYWRkaW5nOiA3cHggMThweDtcbiAgICB9XG5cbiAgICBAaW5jbHVkZSBidXR0b25zdHlsZSgkc3R5bGUsICRiYXNlLWNvbG9yLCAkdGV4dC1zaXplLCAkcGFkZGluZyk7XG4gIH1cblxuICAmOmRpc2FibGVkIHtcbiAgICBjdXJzb3I6IG5vdC1hbGxvd2VkO1xuICAgIG9wYWNpdHk6IDAuNTtcbiAgfVxuXG4gIEB3YXJuIFwiVGhlIGJ1dHRvbiBtaXhpbiBpcyBkZXByZWNhdGVkIGFuZCB3aWxsIGJlIHJlbW92ZWQgaW4gdGhlIG5leHQgbWFqb3IgdmVyc2lvbiByZWxlYXNlXCI7XG59XG5cbi8vIFNlbGVjdG9yIFN0eWxlIEJ1dHRvblxuQG1peGluIGJ1dHRvbnN0eWxlKCR0eXBlLCAkYi1jb2xvciwgJHQtc2l6ZSwgJHBhZCkge1xuICAvLyBHcmF5c2NhbGUgYnV0dG9uXG4gIEBpZiAkdHlwZSA9PSBzaW1wbGUgYW5kICRiLWNvbG9yID09IGdyYXlzY2FsZSgkYi1jb2xvcikge1xuICAgIEBpbmNsdWRlIHNpbXBsZSgkYi1jb2xvciwgdHJ1ZSwgJHQtc2l6ZSwgJHBhZCk7XG4gIH1cblxuICBAaWYgJHR5cGUgPT0gc2hpbnkgYW5kICRiLWNvbG9yID09IGdyYXlzY2FsZSgkYi1jb2xvcikge1xuICAgIEBpbmNsdWRlIHNoaW55KCRiLWNvbG9yLCB0cnVlLCAkdC1zaXplLCAkcGFkKTtcbiAgfVxuXG4gIEBpZiAkdHlwZSA9PSBwaWxsIGFuZCAkYi1jb2xvciA9PSBncmF5c2NhbGUoJGItY29sb3IpIHtcbiAgICBAaW5jbHVkZSBwaWxsKCRiLWNvbG9yLCB0cnVlLCAkdC1zaXplLCAkcGFkKTtcbiAgfVxuXG4gIEBpZiAkdHlwZSA9PSBmbGF0IGFuZCAkYi1jb2xvciA9PSBncmF5c2NhbGUoJGItY29sb3IpIHtcbiAgICBAaW5jbHVkZSBmbGF0KCRiLWNvbG9yLCB0cnVlLCAkdC1zaXplLCAkcGFkKTtcbiAgfVxuXG4gIC8vIENvbG9yZWQgYnV0dG9uXG4gIEBpZiAkdHlwZSA9PSBzaW1wbGUge1xuICAgIEBpbmNsdWRlIHNpbXBsZSgkYi1jb2xvciwgZmFsc2UsICR0LXNpemUsICRwYWQpO1xuICB9XG5cbiAgQGVsc2UgaWYgJHR5cGUgPT0gc2hpbnkge1xuICAgIEBpbmNsdWRlIHNoaW55KCRiLWNvbG9yLCBmYWxzZSwgJHQtc2l6ZSwgJHBhZCk7XG4gIH1cblxuICBAZWxzZSBpZiAkdHlwZSA9PSBwaWxsIHtcbiAgICBAaW5jbHVkZSBwaWxsKCRiLWNvbG9yLCBmYWxzZSwgJHQtc2l6ZSwgJHBhZCk7XG4gIH1cblxuICBAZWxzZSBpZiAkdHlwZSA9PSBmbGF0IHtcbiAgICBAaW5jbHVkZSBmbGF0KCRiLWNvbG9yLCBmYWxzZSwgJHQtc2l6ZSwgJHBhZCk7XG4gIH1cbn1cblxuLy8gU2ltcGxlIEJ1dHRvblxuQG1peGluIHNpbXBsZSgkYmFzZS1jb2xvciwgJGdyYXlzY2FsZTogZmFsc2UsICR0ZXh0c2l6ZTogaW5oZXJpdCwgJHBhZGRpbmc6IDdweCAxOHB4KSB7XG4gICRjb2xvcjogICAgICAgICBoc2woMCwgMCwgMTAwJSk7XG4gICRib3JkZXI6ICAgICAgICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRzYXR1cmF0aW9uOiAgOSUsICAkbGlnaHRuZXNzOiAtMTQlKTtcbiAgJGluc2V0LXNoYWRvdzogIGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJHNhdHVyYXRpb246IC04JSwgICRsaWdodG5lc3M6ICAxNSUpO1xuICAkc3RvcC1ncmFkaWVudDogYWRqdXN0LWNvbG9yKCRiYXNlLWNvbG9yLCAkc2F0dXJhdGlvbjogIDklLCAgJGxpZ2h0bmVzczogLTExJSk7XG4gICR0ZXh0LXNoYWRvdzogICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRzYXR1cmF0aW9uOiAgMTUlLCAkbGlnaHRuZXNzOiAtMTglKTtcblxuICBAaWYgaXMtbGlnaHQoJGJhc2UtY29sb3IpIHtcbiAgICAkY29sb3I6ICAgICAgIGhzbCgwLCAwLCAyMCUpO1xuICAgICR0ZXh0LXNoYWRvdzogYWRqdXN0LWNvbG9yKCRiYXNlLWNvbG9yLCAkc2F0dXJhdGlvbjogMTAlLCAkbGlnaHRuZXNzOiA0JSk7XG4gIH1cblxuICBAaWYgJGdyYXlzY2FsZSA9PSB0cnVlIHtcbiAgICAkYm9yZGVyOiAgICAgICAgZ3JheXNjYWxlKCRib3JkZXIpO1xuICAgICRpbnNldC1zaGFkb3c6ICBncmF5c2NhbGUoJGluc2V0LXNoYWRvdyk7XG4gICAgJHN0b3AtZ3JhZGllbnQ6IGdyYXlzY2FsZSgkc3RvcC1ncmFkaWVudCk7XG4gICAgJHRleHQtc2hhZG93OiAgIGdyYXlzY2FsZSgkdGV4dC1zaGFkb3cpO1xuICB9XG5cbiAgYm9yZGVyOiAxcHggc29saWQgJGJvcmRlcjtcbiAgYm9yZGVyLXJhZGl1czogM3B4O1xuICBib3gtc2hhZG93OiBpbnNldCAwIDFweCAwIDAgJGluc2V0LXNoYWRvdztcbiAgY29sb3I6ICRjb2xvcjtcbiAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xuICBmb250LXNpemU6ICR0ZXh0c2l6ZTtcbiAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gIEBpbmNsdWRlIGxpbmVhci1ncmFkaWVudCAoJGJhc2UtY29sb3IsICRzdG9wLWdyYWRpZW50KTtcbiAgcGFkZGluZzogJHBhZGRpbmc7XG4gIHRleHQtZGVjb3JhdGlvbjogbm9uZTtcbiAgdGV4dC1zaGFkb3c6IDAgMXB4IDAgJHRleHQtc2hhZG93O1xuICBiYWNrZ3JvdW5kLWNsaXA6IHBhZGRpbmctYm94O1xuXG4gICY6aG92ZXI6bm90KDpkaXNhYmxlZCkge1xuICAgICRiYXNlLWNvbG9yLWhvdmVyOiAgICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRzYXR1cmF0aW9uOiAtNCUsICRsaWdodG5lc3M6IC01JSk7XG4gICAgJGluc2V0LXNoYWRvdy1ob3ZlcjogIGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJHNhdHVyYXRpb246IC03JSwgJGxpZ2h0bmVzczogIDUlKTtcbiAgICAkc3RvcC1ncmFkaWVudC1ob3ZlcjogYWRqdXN0LWNvbG9yKCRiYXNlLWNvbG9yLCAkc2F0dXJhdGlvbjogIDglLCAkbGlnaHRuZXNzOiAtMTQlKTtcblxuICAgIEBpZiAkZ3JheXNjYWxlID09IHRydWUge1xuICAgICAgJGJhc2UtY29sb3ItaG92ZXI6ICAgIGdyYXlzY2FsZSgkYmFzZS1jb2xvci1ob3Zlcik7XG4gICAgICAkaW5zZXQtc2hhZG93LWhvdmVyOiAgZ3JheXNjYWxlKCRpbnNldC1zaGFkb3ctaG92ZXIpO1xuICAgICAgJHN0b3AtZ3JhZGllbnQtaG92ZXI6IGdyYXlzY2FsZSgkc3RvcC1ncmFkaWVudC1ob3Zlcik7XG4gICAgfVxuXG4gICAgQGluY2x1ZGUgbGluZWFyLWdyYWRpZW50ICgkYmFzZS1jb2xvci1ob3ZlciwgJHN0b3AtZ3JhZGllbnQtaG92ZXIpO1xuXG4gICAgYm94LXNoYWRvdzogaW5zZXQgMCAxcHggMCAwICRpbnNldC1zaGFkb3ctaG92ZXI7XG4gICAgY3Vyc29yOiBwb2ludGVyO1xuICB9XG5cbiAgJjphY3RpdmU6bm90KDpkaXNhYmxlZCksXG4gICY6Zm9jdXM6bm90KDpkaXNhYmxlZCkge1xuICAgICRib3JkZXItYWN0aXZlOiAgICAgICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRzYXR1cmF0aW9uOiA5JSwgJGxpZ2h0bmVzczogLTE0JSk7XG4gICAgJGluc2V0LXNoYWRvdy1hY3RpdmU6IGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJHNhdHVyYXRpb246IDclLCAkbGlnaHRuZXNzOiAtMTclKTtcblxuICAgIEBpZiAkZ3JheXNjYWxlID09IHRydWUge1xuICAgICAgJGJvcmRlci1hY3RpdmU6ICAgICAgIGdyYXlzY2FsZSgkYm9yZGVyLWFjdGl2ZSk7XG4gICAgICAkaW5zZXQtc2hhZG93LWFjdGl2ZTogZ3JheXNjYWxlKCRpbnNldC1zaGFkb3ctYWN0aXZlKTtcbiAgICB9XG5cbiAgICBib3JkZXI6IDFweCBzb2xpZCAkYm9yZGVyLWFjdGl2ZTtcbiAgICBib3gtc2hhZG93OiBpbnNldCAwIDAgOHB4IDRweCAkaW5zZXQtc2hhZG93LWFjdGl2ZSwgaW5zZXQgMCAwIDhweCA0cHggJGluc2V0LXNoYWRvdy1hY3RpdmU7XG4gIH1cbn1cblxuLy8gU2hpbnkgQnV0dG9uXG5AbWl4aW4gc2hpbnkoJGJhc2UtY29sb3IsICRncmF5c2NhbGU6IGZhbHNlLCAkdGV4dHNpemU6IGluaGVyaXQsICRwYWRkaW5nOiA3cHggMThweCkge1xuICAkY29sb3I6ICAgICAgICAgaHNsKDAsIDAsIDEwMCUpO1xuICAkYm9yZGVyOiAgICAgICAgYWRqdXN0LWNvbG9yKCRiYXNlLWNvbG9yLCAkcmVkOiAtMTE3LCAkZ3JlZW46IC0xMTEsICRibHVlOiAtODEpO1xuICAkYm9yZGVyLWJvdHRvbTogYWRqdXN0LWNvbG9yKCRiYXNlLWNvbG9yLCAkcmVkOiAtMTI2LCAkZ3JlZW46IC0xMjcsICRibHVlOiAtMTIyKTtcbiAgJGZvdXJ0aC1zdG9wOiAgIGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJHJlZDogLTc5LCAgJGdyZWVuOiAtNzAsICAkYmx1ZTogLTQ2KTtcbiAgJGluc2V0LXNoYWRvdzogIGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJHJlZDogIDM3LCAgJGdyZWVuOiAgMjksICAkYmx1ZTogIDEyKTtcbiAgJHNlY29uZC1zdG9wOiAgIGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJHJlZDogLTU2LCAgJGdyZWVuOiAtNTAsICAkYmx1ZTogLTMzKTtcbiAgJHRleHQtc2hhZG93OiAgIGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJHJlZDogLTE0MCwgJGdyZWVuOiAtMTQxLCAkYmx1ZTogLTExNCk7XG4gICR0aGlyZC1zdG9wOiAgICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRyZWQ6IC04NiwgICRncmVlbjogLTc1LCAgJGJsdWU6IC00OCk7XG5cbiAgQGlmIGlzLWxpZ2h0KCRiYXNlLWNvbG9yKSB7XG4gICAgJGNvbG9yOiAgICAgICBoc2woMCwgMCwgMjAlKTtcbiAgICAkdGV4dC1zaGFkb3c6IGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJHNhdHVyYXRpb246IDEwJSwgJGxpZ2h0bmVzczogNCUpO1xuICB9XG5cbiAgQGlmICRncmF5c2NhbGUgPT0gdHJ1ZSB7XG4gICAgJGJvcmRlcjogICAgICAgIGdyYXlzY2FsZSgkYm9yZGVyKTtcbiAgICAkYm9yZGVyLWJvdHRvbTogZ3JheXNjYWxlKCRib3JkZXItYm90dG9tKTtcbiAgICAkZm91cnRoLXN0b3A6ICAgZ3JheXNjYWxlKCRmb3VydGgtc3RvcCk7XG4gICAgJGluc2V0LXNoYWRvdzogIGdyYXlzY2FsZSgkaW5zZXQtc2hhZG93KTtcbiAgICAkc2Vjb25kLXN0b3A6ICAgZ3JheXNjYWxlKCRzZWNvbmQtc3RvcCk7XG4gICAgJHRleHQtc2hhZG93OiAgIGdyYXlzY2FsZSgkdGV4dC1zaGFkb3cpO1xuICAgICR0aGlyZC1zdG9wOiAgICBncmF5c2NhbGUoJHRoaXJkLXN0b3ApO1xuICB9XG5cbiAgQGluY2x1ZGUgbGluZWFyLWdyYWRpZW50KHRvcCwgJGJhc2UtY29sb3IgMCUsICRzZWNvbmQtc3RvcCA1MCUsICR0aGlyZC1zdG9wIDUwJSwgJGZvdXJ0aC1zdG9wIDEwMCUpO1xuXG4gIGJvcmRlcjogMXB4IHNvbGlkICRib3JkZXI7XG4gIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCAkYm9yZGVyLWJvdHRvbTtcbiAgYm9yZGVyLXJhZGl1czogNXB4O1xuICBib3gtc2hhZG93OiBpbnNldCAwIDFweCAwIDAgJGluc2V0LXNoYWRvdztcbiAgY29sb3I6ICRjb2xvcjtcbiAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xuICBmb250LXNpemU6ICR0ZXh0c2l6ZTtcbiAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gIHBhZGRpbmc6ICRwYWRkaW5nO1xuICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gIHRleHQtZGVjb3JhdGlvbjogbm9uZTtcbiAgdGV4dC1zaGFkb3c6IDAgLTFweCAxcHggJHRleHQtc2hhZG93O1xuXG4gICY6aG92ZXI6bm90KDpkaXNhYmxlZCkge1xuICAgICRmaXJzdC1zdG9wLWhvdmVyOiAgYWRqdXN0LWNvbG9yKCRiYXNlLWNvbG9yLCAkcmVkOiAtMTMsICRncmVlbjogLTE1LCAkYmx1ZTogLTE4KTtcbiAgICAkc2Vjb25kLXN0b3AtaG92ZXI6IGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJHJlZDogLTY2LCAkZ3JlZW46IC02MiwgJGJsdWU6IC01MSk7XG4gICAgJHRoaXJkLXN0b3AtaG92ZXI6ICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRyZWQ6IC05MywgJGdyZWVuOiAtODUsICRibHVlOiAtNjYpO1xuICAgICRmb3VydGgtc3RvcC1ob3ZlcjogYWRqdXN0LWNvbG9yKCRiYXNlLWNvbG9yLCAkcmVkOiAtODYsICRncmVlbjogLTgwLCAkYmx1ZTogLTYzKTtcblxuICAgIEBpZiAkZ3JheXNjYWxlID09IHRydWUge1xuICAgICAgJGZpcnN0LXN0b3AtaG92ZXI6ICBncmF5c2NhbGUoJGZpcnN0LXN0b3AtaG92ZXIpO1xuICAgICAgJHNlY29uZC1zdG9wLWhvdmVyOiBncmF5c2NhbGUoJHNlY29uZC1zdG9wLWhvdmVyKTtcbiAgICAgICR0aGlyZC1zdG9wLWhvdmVyOiAgZ3JheXNjYWxlKCR0aGlyZC1zdG9wLWhvdmVyKTtcbiAgICAgICRmb3VydGgtc3RvcC1ob3ZlcjogZ3JheXNjYWxlKCRmb3VydGgtc3RvcC1ob3Zlcik7XG4gICAgfVxuXG4gICAgQGluY2x1ZGUgbGluZWFyLWdyYWRpZW50KHRvcCwgJGZpcnN0LXN0b3AtaG92ZXIgIDAlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICRzZWNvbmQtc3RvcC1ob3ZlciA1MCUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHRoaXJkLXN0b3AtaG92ZXIgIDUwJSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkZm91cnRoLXN0b3AtaG92ZXIgMTAwJSk7XG4gICAgY3Vyc29yOiBwb2ludGVyO1xuICB9XG5cbiAgJjphY3RpdmU6bm90KDpkaXNhYmxlZCksXG4gICY6Zm9jdXM6bm90KDpkaXNhYmxlZCkge1xuICAgICRpbnNldC1zaGFkb3ctYWN0aXZlOiBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRyZWQ6IC0xMTEsICRncmVlbjogLTExNiwgJGJsdWU6IC0xMjIpO1xuXG4gICAgQGlmICRncmF5c2NhbGUgPT0gdHJ1ZSB7XG4gICAgICAkaW5zZXQtc2hhZG93LWFjdGl2ZTogZ3JheXNjYWxlKCRpbnNldC1zaGFkb3ctYWN0aXZlKTtcbiAgICB9XG5cbiAgICBib3gtc2hhZG93OiBpbnNldCAwIDAgMjBweCAwICRpbnNldC1zaGFkb3ctYWN0aXZlO1xuICB9XG59XG5cbi8vIFBpbGwgQnV0dG9uXG5AbWl4aW4gcGlsbCgkYmFzZS1jb2xvciwgJGdyYXlzY2FsZTogZmFsc2UsICR0ZXh0c2l6ZTogaW5oZXJpdCwgJHBhZGRpbmc6IDdweCAxOHB4KSB7XG4gICRjb2xvcjogICAgICAgICBoc2woMCwgMCwgMTAwJSk7XG4gICRib3JkZXItYm90dG9tOiBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRodWU6ICA4LCAkc2F0dXJhdGlvbjogLTExJSwgJGxpZ2h0bmVzczogLTI2JSk7XG4gICRib3JkZXItc2lkZXM6ICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRodWU6ICA0LCAkc2F0dXJhdGlvbjogLTIxJSwgJGxpZ2h0bmVzczogLTIxJSk7XG4gICRib3JkZXItdG9wOiAgICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRodWU6IC0xLCAkc2F0dXJhdGlvbjogLTMwJSwgJGxpZ2h0bmVzczogLTE1JSk7XG4gICRpbnNldC1zaGFkb3c6ICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRodWU6IC0xLCAkc2F0dXJhdGlvbjogLTElLCAgJGxpZ2h0bmVzczogIDclKTtcbiAgJHN0b3AtZ3JhZGllbnQ6IGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJGh1ZTogIDgsICRzYXR1cmF0aW9uOiAgMTQlLCAkbGlnaHRuZXNzOiAtMTAlKTtcbiAgJHRleHQtc2hhZG93OiAgIGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJGh1ZTogIDUsICRzYXR1cmF0aW9uOiAtMTklLCAkbGlnaHRuZXNzOiAtMTUlKTtcblxuICBAaWYgaXMtbGlnaHQoJGJhc2UtY29sb3IpIHtcbiAgICAkY29sb3I6ICAgICAgIGhzbCgwLCAwLCAyMCUpO1xuICAgICR0ZXh0LXNoYWRvdzogYWRqdXN0LWNvbG9yKCRiYXNlLWNvbG9yLCAkc2F0dXJhdGlvbjogMTAlLCAkbGlnaHRuZXNzOiA0JSk7XG4gIH1cblxuICBAaWYgJGdyYXlzY2FsZSA9PSB0cnVlIHtcbiAgICAkYm9yZGVyLWJvdHRvbTogZ3JheXNjYWxlKCRib3JkZXItYm90dG9tKTtcbiAgICAkYm9yZGVyLXNpZGVzOiAgZ3JheXNjYWxlKCRib3JkZXItc2lkZXMpO1xuICAgICRib3JkZXItdG9wOiAgICBncmF5c2NhbGUoJGJvcmRlci10b3ApO1xuICAgICRpbnNldC1zaGFkb3c6ICBncmF5c2NhbGUoJGluc2V0LXNoYWRvdyk7XG4gICAgJHN0b3AtZ3JhZGllbnQ6IGdyYXlzY2FsZSgkc3RvcC1ncmFkaWVudCk7XG4gICAgJHRleHQtc2hhZG93OiAgIGdyYXlzY2FsZSgkdGV4dC1zaGFkb3cpO1xuICB9XG5cbiAgYm9yZGVyOiAxcHggc29saWQgJGJvcmRlci10b3A7XG4gIGJvcmRlci1jb2xvcjogJGJvcmRlci10b3AgJGJvcmRlci1zaWRlcyAkYm9yZGVyLWJvdHRvbTtcbiAgYm9yZGVyLXJhZGl1czogMTZweDtcbiAgYm94LXNoYWRvdzogaW5zZXQgMCAxcHggMCAwICRpbnNldC1zaGFkb3c7XG4gIGNvbG9yOiAkY29sb3I7XG4gIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgZm9udC1zaXplOiAkdGV4dHNpemU7XG4gIGZvbnQtd2VpZ2h0OiBub3JtYWw7XG4gIGxpbmUtaGVpZ2h0OiAxO1xuICBAaW5jbHVkZSBsaW5lYXItZ3JhZGllbnQgKCRiYXNlLWNvbG9yLCAkc3RvcC1ncmFkaWVudCk7XG4gIHBhZGRpbmc6ICRwYWRkaW5nO1xuICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gIHRleHQtZGVjb3JhdGlvbjogbm9uZTtcbiAgdGV4dC1zaGFkb3c6IDAgLTFweCAxcHggJHRleHQtc2hhZG93O1xuICBiYWNrZ3JvdW5kLWNsaXA6IHBhZGRpbmctYm94O1xuXG4gICY6aG92ZXI6bm90KDpkaXNhYmxlZCkge1xuICAgICRiYXNlLWNvbG9yLWhvdmVyOiAgICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkbGlnaHRuZXNzOiAtNC41JSk7XG4gICAgJGJvcmRlci1ib3R0b206ICAgICAgIGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJGh1ZTogIDgsICRzYXR1cmF0aW9uOiAgMTMuNSUsICRsaWdodG5lc3M6IC0zMiUpO1xuICAgICRib3JkZXItc2lkZXM6ICAgICAgICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRodWU6ICA0LCAkc2F0dXJhdGlvbjogLTIlLCAgICAkbGlnaHRuZXNzOiAtMjclKTtcbiAgICAkYm9yZGVyLXRvcDogICAgICAgICAgYWRqdXN0LWNvbG9yKCRiYXNlLWNvbG9yLCAkaHVlOiAtMSwgJHNhdHVyYXRpb246IC0xNyUsICAgJGxpZ2h0bmVzczogLTIxJSk7XG4gICAgJGluc2V0LXNoYWRvdy1ob3ZlcjogIGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgICAgICAgICAgICRzYXR1cmF0aW9uOiAtMSUsICAgICRsaWdodG5lc3M6ICAzJSk7XG4gICAgJHN0b3AtZ3JhZGllbnQtaG92ZXI6IGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJGh1ZTogIDgsICRzYXR1cmF0aW9uOiAtNCUsICAgICRsaWdodG5lc3M6IC0xNS41JSk7XG4gICAgJHRleHQtc2hhZG93LWhvdmVyOiAgIGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJGh1ZTogIDUsICRzYXR1cmF0aW9uOiAtNSUsICAgICRsaWdodG5lc3M6IC0yMiUpO1xuXG4gICAgQGlmICRncmF5c2NhbGUgPT0gdHJ1ZSB7XG4gICAgICAkYmFzZS1jb2xvci1ob3ZlcjogICAgZ3JheXNjYWxlKCRiYXNlLWNvbG9yLWhvdmVyKTtcbiAgICAgICRib3JkZXItYm90dG9tOiAgICAgICBncmF5c2NhbGUoJGJvcmRlci1ib3R0b20pO1xuICAgICAgJGJvcmRlci1zaWRlczogICAgICAgIGdyYXlzY2FsZSgkYm9yZGVyLXNpZGVzKTtcbiAgICAgICRib3JkZXItdG9wOiAgICAgICAgICBncmF5c2NhbGUoJGJvcmRlci10b3ApO1xuICAgICAgJGluc2V0LXNoYWRvdy1ob3ZlcjogIGdyYXlzY2FsZSgkaW5zZXQtc2hhZG93LWhvdmVyKTtcbiAgICAgICRzdG9wLWdyYWRpZW50LWhvdmVyOiBncmF5c2NhbGUoJHN0b3AtZ3JhZGllbnQtaG92ZXIpO1xuICAgICAgJHRleHQtc2hhZG93LWhvdmVyOiAgIGdyYXlzY2FsZSgkdGV4dC1zaGFkb3ctaG92ZXIpO1xuICAgIH1cblxuICAgIEBpbmNsdWRlIGxpbmVhci1ncmFkaWVudCAoJGJhc2UtY29sb3ItaG92ZXIsICRzdG9wLWdyYWRpZW50LWhvdmVyKTtcblxuICAgIGJhY2tncm91bmQtY2xpcDogcGFkZGluZy1ib3g7XG4gICAgYm9yZGVyOiAxcHggc29saWQgJGJvcmRlci10b3A7XG4gICAgYm9yZGVyLWNvbG9yOiAkYm9yZGVyLXRvcCAkYm9yZGVyLXNpZGVzICRib3JkZXItYm90dG9tO1xuICAgIGJveC1zaGFkb3c6IGluc2V0IDAgMXB4IDAgMCAkaW5zZXQtc2hhZG93LWhvdmVyO1xuICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICB0ZXh0LXNoYWRvdzogMCAtMXB4IDFweCAkdGV4dC1zaGFkb3ctaG92ZXI7XG4gIH1cblxuICAmOmFjdGl2ZTpub3QoOmRpc2FibGVkKSxcbiAgJjpmb2N1czpub3QoOmRpc2FibGVkKSB7XG4gICAgJGFjdGl2ZS1jb2xvcjogICAgICAgICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRodWU6IDQsICAkc2F0dXJhdGlvbjogLTEyJSwgICRsaWdodG5lc3M6IC0xMCUpO1xuICAgICRib3JkZXItYWN0aXZlOiAgICAgICAgYWRqdXN0LWNvbG9yKCRiYXNlLWNvbG9yLCAkaHVlOiA2LCAgJHNhdHVyYXRpb246IC0yLjUlLCAkbGlnaHRuZXNzOiAtMzAlKTtcbiAgICAkYm9yZGVyLWJvdHRvbS1hY3RpdmU6IGFkanVzdC1jb2xvcigkYmFzZS1jb2xvciwgJGh1ZTogMTEsICRzYXR1cmF0aW9uOiAgNiUsICAgJGxpZ2h0bmVzczogLTMxJSk7XG4gICAgJGluc2V0LXNoYWRvdy1hY3RpdmU6ICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRodWU6IDksICAkc2F0dXJhdGlvbjogIDIlLCAgICRsaWdodG5lc3M6IC0yMS41JSk7XG4gICAgJHRleHQtc2hhZG93LWFjdGl2ZTogICBhZGp1c3QtY29sb3IoJGJhc2UtY29sb3IsICRodWU6IDUsICAkc2F0dXJhdGlvbjogLTEyJSwgICRsaWdodG5lc3M6IC0yMS41JSk7XG5cbiAgICBAaWYgJGdyYXlzY2FsZSA9PSB0cnVlIHtcbiAgICAgICRhY3RpdmUtY29sb3I6ICAgICAgICAgZ3JheXNjYWxlKCRhY3RpdmUtY29sb3IpO1xuICAgICAgJGJvcmRlci1hY3RpdmU6ICAgICAgICBncmF5c2NhbGUoJGJvcmRlci1hY3RpdmUpO1xuICAgICAgJGJvcmRlci1ib3R0b20tYWN0aXZlOiBncmF5c2NhbGUoJGJvcmRlci1ib3R0b20tYWN0aXZlKTtcbiAgICAgICRpbnNldC1zaGFkb3ctYWN0aXZlOiAgZ3JheXNjYWxlKCRpbnNldC1zaGFkb3ctYWN0aXZlKTtcbiAgICAgICR0ZXh0LXNoYWRvdy1hY3RpdmU6ICAgZ3JheXNjYWxlKCR0ZXh0LXNoYWRvdy1hY3RpdmUpO1xuICAgIH1cblxuICAgIGJhY2tncm91bmQ6ICRhY3RpdmUtY29sb3I7XG4gICAgYm9yZGVyOiAxcHggc29saWQgJGJvcmRlci1hY3RpdmU7XG4gICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICRib3JkZXItYm90dG9tLWFjdGl2ZTtcbiAgICBib3gtc2hhZG93OiBpbnNldCAwIDAgNnB4IDNweCAkaW5zZXQtc2hhZG93LWFjdGl2ZTtcbiAgICB0ZXh0LXNoYWRvdzogMCAtMXB4IDFweCAkdGV4dC1zaGFkb3ctYWN0aXZlO1xuICB9XG59XG5cbi8vIEZsYXQgQnV0dG9uXG5AbWl4aW4gZmxhdCgkYmFzZS1jb2xvciwgJGdyYXlzY2FsZTogZmFsc2UsICR0ZXh0c2l6ZTogaW5oZXJpdCwgJHBhZGRpbmc6IDdweCAxOHB4KSB7XG4gICRjb2xvcjogICAgICAgICBoc2woMCwgMCwgMTAwJSk7XG5cbiAgQGlmIGlzLWxpZ2h0KCRiYXNlLWNvbG9yKSB7XG4gICAgJGNvbG9yOiAgICAgICBoc2woMCwgMCwgMjAlKTtcbiAgfVxuXG4gIGJhY2tncm91bmQtY29sb3I6ICRiYXNlLWNvbG9yO1xuICBib3JkZXItcmFkaXVzOiAzcHg7XG4gIGJvcmRlcjogMDtcbiAgY29sb3I6ICRjb2xvcjtcbiAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xuICBmb250LXNpemU6ICR0ZXh0c2l6ZTtcbiAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gIHBhZGRpbmc6ICRwYWRkaW5nO1xuICB0ZXh0LWRlY29yYXRpb246IG5vbmU7XG4gIGJhY2tncm91bmQtY2xpcDogcGFkZGluZy1ib3g7XG5cbiAgJjpob3Zlcjpub3QoOmRpc2FibGVkKXtcbiAgICAkYmFzZS1jb2xvci1ob3ZlcjogICAgYWRqdXN0LWNvbG9yKCRiYXNlLWNvbG9yLCAkc2F0dXJhdGlvbjogNCUsICRsaWdodG5lc3M6IDUlKTtcblxuICAgIEBpZiAkZ3JheXNjYWxlID09IHRydWUge1xuICAgICAgJGJhc2UtY29sb3ItaG92ZXI6IGdyYXlzY2FsZSgkYmFzZS1jb2xvci1ob3Zlcik7XG4gICAgfVxuXG4gICAgYmFja2dyb3VuZC1jb2xvcjogJGJhc2UtY29sb3ItaG92ZXI7XG4gICAgY3Vyc29yOiBwb2ludGVyO1xuICB9XG5cbiAgJjphY3RpdmU6bm90KDpkaXNhYmxlZCksXG4gICY6Zm9jdXM6bm90KDpkaXNhYmxlZCkge1xuICAgICRiYXNlLWNvbG9yLWFjdGl2ZTogYWRqdXN0LWNvbG9yKCRiYXNlLWNvbG9yLCAkc2F0dXJhdGlvbjogLTQlLCAkbGlnaHRuZXNzOiAtNSUpO1xuXG4gICAgQGlmICRncmF5c2NhbGUgPT0gdHJ1ZSB7XG4gICAgICAkYmFzZS1jb2xvci1hY3RpdmU6IGdyYXlzY2FsZSgkYmFzZS1jb2xvci1hY3RpdmUpO1xuICAgIH1cblxuICAgIGJhY2tncm91bmQtY29sb3I6ICRiYXNlLWNvbG9yLWFjdGl2ZTtcbiAgICBjdXJzb3I6IHBvaW50ZXI7XG4gIH1cbn1cblxuLy8gRmxleGlibGUgZ3JpZFxuQGZ1bmN0aW9uIGZsZXgtZ3JpZCgkY29sdW1ucywgJGNvbnRhaW5lci1jb2x1bW5zOiAkZmctbWF4LWNvbHVtbnMpIHtcbiAgJHdpZHRoOiAkY29sdW1ucyAqICRmZy1jb2x1bW4gKyAoJGNvbHVtbnMgLSAxKSAqICRmZy1ndXR0ZXI7XG4gICRjb250YWluZXItd2lkdGg6ICRjb250YWluZXItY29sdW1ucyAqICRmZy1jb2x1bW4gKyAoJGNvbnRhaW5lci1jb2x1bW5zIC0gMSkgKiAkZmctZ3V0dGVyO1xuICBAcmV0dXJuIHBlcmNlbnRhZ2UoJHdpZHRoIC8gJGNvbnRhaW5lci13aWR0aCk7XG5cbiAgQHdhcm4gXCJUaGUgZmxleC1ncmlkIGZ1bmN0aW9uIGlzIGRlcHJlY2F0ZWQgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiB0aGUgbmV4dCBtYWpvciB2ZXJzaW9uIHJlbGVhc2VcIjtcbn1cblxuLy8gRmxleGlibGUgZ3V0dGVyXG5AZnVuY3Rpb24gZmxleC1ndXR0ZXIoJGNvbnRhaW5lci1jb2x1bW5zOiAkZmctbWF4LWNvbHVtbnMsICRndXR0ZXI6ICRmZy1ndXR0ZXIpIHtcbiAgJGNvbnRhaW5lci13aWR0aDogJGNvbnRhaW5lci1jb2x1bW5zICogJGZnLWNvbHVtbiArICgkY29udGFpbmVyLWNvbHVtbnMgLSAxKSAqICRmZy1ndXR0ZXI7XG4gIEByZXR1cm4gcGVyY2VudGFnZSgkZ3V0dGVyIC8gJGNvbnRhaW5lci13aWR0aCk7XG5cbiAgQHdhcm4gXCJUaGUgZmxleC1ndXR0ZXIgZnVuY3Rpb24gaXMgZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIHRoZSBuZXh0IG1ham9yIHZlcnNpb24gcmVsZWFzZVwiO1xufVxuXG5AZnVuY3Rpb24gZ3JpZC13aWR0aCgkbikge1xuICBAcmV0dXJuICRuICogJGd3LWNvbHVtbiArICgkbiAtIDEpICogJGd3LWd1dHRlcjtcblxuICBAd2FybiBcIlRoZSBncmlkLXdpZHRoIGZ1bmN0aW9uIGlzIGRlcHJlY2F0ZWQgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiB0aGUgbmV4dCBtYWpvciB2ZXJzaW9uIHJlbGVhc2VcIjtcbn1cblxuQGZ1bmN0aW9uIGdvbGRlbi1yYXRpbygkdmFsdWUsICRpbmNyZW1lbnQpIHtcbiAgQHJldHVybiBtb2R1bGFyLXNjYWxlKCRpbmNyZW1lbnQsICR2YWx1ZSwgJHJhdGlvOiAkZ29sZGVuKTtcblxuICBAd2FybiBcIlRoZSBnb2xkZW4tcmF0aW8gZnVuY3Rpb24gaXMgZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIHRoZSBuZXh0IG1ham9yIHZlcnNpb24gcmVsZWFzZS4gUGxlYXNlIHVzZSB0aGUgbW9kdWxhci1zY2FsZSBmdW5jdGlvbiwgaW5zdGVhZC5cIjtcbn1cblxuQG1peGluIGJveC1zaXppbmcoJGJveCkge1xuICBAaW5jbHVkZSBwcmVmaXhlcihib3gtc2l6aW5nLCAkYm94LCB3ZWJraXQgbW96IHNwZWMpO1xuXG4gIEB3YXJuIFwiVGhlIGJveC1zaXppbmcgbWl4aW4gaXMgZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIHRoZSBuZXh0IG1ham9yIHZlcnNpb24gcmVsZWFzZS4gVGhpcyBwcm9wZXJ0eSBjYW4gbm93IGJlIHVzZWQgdW4tcHJlZml4ZWQuXCI7XG59XG4iLCIvLyBOZWF0IDEuNy4yXG4vLyBodHRwOi8vbmVhdC5ib3VyYm9uLmlvXG4vLyBDb3B5cmlnaHQgMjAxMi0yMDE1IHRob3VnaHRib3QsIGluYy5cbi8vIE1JVCBMaWNlbnNlXG5cbi8vIEhlbHBlcnNcbkBpbXBvcnQgXCJuZWF0LWhlbHBlcnNcIjtcblxuLy8gR3JpZFxuQGltcG9ydCBcImdyaWQvcHJpdmF0ZVwiO1xuQGltcG9ydCBcImdyaWQvYm94LXNpemluZ1wiO1xuQGltcG9ydCBcImdyaWQvb21lZ2FcIjtcbkBpbXBvcnQgXCJncmlkL291dGVyLWNvbnRhaW5lclwiO1xuQGltcG9ydCBcImdyaWQvc3Bhbi1jb2x1bW5zXCI7XG5AaW1wb3J0IFwiZ3JpZC9yb3dcIjtcbkBpbXBvcnQgXCJncmlkL3NoaWZ0XCI7XG5AaW1wb3J0IFwiZ3JpZC9wYWRcIjtcbkBpbXBvcnQgXCJncmlkL2ZpbGwtcGFyZW50XCI7XG5AaW1wb3J0IFwiZ3JpZC9tZWRpYVwiO1xuQGltcG9ydCBcImdyaWQvdG8tZGVwcmVjYXRlXCI7XG5AaW1wb3J0IFwiZ3JpZC92aXN1YWwtZ3JpZFwiO1xuQGltcG9ydCBcImdyaWQvZGlzcGxheS1jb250ZXh0XCI7XG5AaW1wb3J0IFwiZ3JpZC9kaXJlY3Rpb24tY29udGV4dFwiO1xuIiwiLy8gRnVuY3Rpb25zXG5AaW1wb3J0IFwiZnVuY3Rpb25zL3ByaXZhdGVcIjtcbkBpbXBvcnQgXCJmdW5jdGlvbnMvbmV3LWJyZWFrcG9pbnRcIjtcblxuLy8gU2V0dGluZ3NcbkBpbXBvcnQgXCJzZXR0aW5ncy9ncmlkXCI7XG5AaW1wb3J0IFwic2V0dGluZ3MvdmlzdWFsLWdyaWRcIjtcbkBpbXBvcnQgXCJzZXR0aW5ncy9kaXNhYmxlLXdhcm5pbmdzXCI7XG4iLCIvLyBOb3QgZnVuY3Rpb24gZm9yIExpYnNhc3MgY29tcGF0aWJpbGl0eVxuLy8gaHR0cHM6Ly9naXRodWIuY29tL3Nhc3MvbGlic2Fzcy9pc3N1ZXMvMzY4XG5AZnVuY3Rpb24gaXMtbm90KCR2YWx1ZSkge1xuICBAcmV0dXJuIGlmKCR2YWx1ZSwgZmFsc2UsIHRydWUpO1xufVxuXG4vLyBDaGVja3MgaWYgYSBudW1iZXIgaXMgZXZlblxuQGZ1bmN0aW9uIGlzLWV2ZW4oJGludCkge1xuICBAcmV0dXJuICRpbnQgJSAyID09IDA7XG59XG5cbi8vIENoZWNrcyBpZiBhbiBlbGVtZW50IGJlbG9uZ3MgdG8gYSBsaXN0IG9yIG5vdFxuQGZ1bmN0aW9uIGJlbG9uZ3MtdG8oJHRlc3RlZC1pdGVtLCAkbGlzdCkge1xuICBAcmV0dXJuIGlzLW5vdChub3QtYmVsb25ncy10bygkdGVzdGVkLWl0ZW0sICRsaXN0KSk7XG59XG5cbkBmdW5jdGlvbiBub3QtYmVsb25ncy10bygkdGVzdGVkLWl0ZW0sICRsaXN0KSB7XG4gIEByZXR1cm4gaXMtbm90KGluZGV4KCRsaXN0LCAkdGVzdGVkLWl0ZW0pKTtcbn1cblxuLy8gQ29udGFpbnMgZGlzcGxheSB2YWx1ZVxuQGZ1bmN0aW9uIGNvbnRhaW5zLWRpc3BsYXktdmFsdWUoJHF1ZXJ5KSB7XG4gIEByZXR1cm4gYmVsb25ncy10byh0YWJsZSwgJHF1ZXJ5KVxuICAgICAgIG9yIGJlbG9uZ3MtdG8oYmxvY2ssICRxdWVyeSlcbiAgICAgICBvciBiZWxvbmdzLXRvKGlubGluZS1ibG9jaywgJHF1ZXJ5KVxuICAgICAgIG9yIGJlbG9uZ3MtdG8oaW5saW5lLCAkcXVlcnkpO1xufVxuXG4vLyBQYXJzZXMgdGhlIGZpcnN0IGFyZ3VtZW50IG9mIHNwYW4tY29sdW1ucygpXG5AZnVuY3Rpb24gY29udGFpbmVyLXNwYW4oJHNwYW46ICRzcGFuKSB7XG4gIEBpZiBsZW5ndGgoJHNwYW4pID09IDMge1xuICAgICRjb250YWluZXItY29sdW1uczogbnRoKCRzcGFuLCAzKTtcbiAgICBAcmV0dXJuICRjb250YWluZXItY29sdW1ucztcbiAgfSBAZWxzZSBpZiBsZW5ndGgoJHNwYW4pID09IDIge1xuICAgICRjb250YWluZXItY29sdW1uczogbnRoKCRzcGFuLCAyKTtcbiAgICBAcmV0dXJuICRjb250YWluZXItY29sdW1ucztcbiAgfVxuXG4gIEByZXR1cm4gJGdyaWQtY29sdW1ucztcbn1cblxuQGZ1bmN0aW9uIGNvbnRhaW5lci1zaGlmdCgkc2hpZnQ6ICRzaGlmdCkge1xuICAkcGFyZW50LWNvbHVtbnM6ICRncmlkLWNvbHVtbnMgIWRlZmF1bHQgIWdsb2JhbDtcblxuICBAaWYgbGVuZ3RoKCRzaGlmdCkgPT0gMyB7XG4gICAgJGNvbnRhaW5lci1jb2x1bW5zOiBudGgoJHNoaWZ0LCAzKTtcbiAgICBAcmV0dXJuICRjb250YWluZXItY29sdW1ucztcbiAgfSBAZWxzZSBpZiBsZW5ndGgoJHNoaWZ0KSA9PSAyIHtcbiAgICAkY29udGFpbmVyLWNvbHVtbnM6IG50aCgkc2hpZnQsIDIpO1xuICAgIEByZXR1cm4gJGNvbnRhaW5lci1jb2x1bW5zO1xuICB9XG5cbiAgQHJldHVybiAkcGFyZW50LWNvbHVtbnM7XG59XG5cbi8vIEdlbmVyYXRlcyBhIHN0cmlwZWQgYmFja2dyb3VuZFxuQGZ1bmN0aW9uIGdyYWRpZW50LXN0b3BzKCRncmlkLWNvbHVtbnMsICRjb2xvcjogJHZpc3VhbC1ncmlkLWNvbG9yKSB7XG4gICR0cmFuc3BhcmVudDogdHJhbnNwYXJlbnQ7XG5cbiAgJGNvbHVtbi13aWR0aDogZmxleC1ncmlkKDEsICRncmlkLWNvbHVtbnMpO1xuICAkZ3V0dGVyLXdpZHRoOiBmbGV4LWd1dHRlcigkZ3JpZC1jb2x1bW5zKTtcbiAgJGNvbHVtbi1vZmZzZXQ6ICRjb2x1bW4td2lkdGg7XG5cbiAgJHZhbHVlczogKCR0cmFuc3BhcmVudCAwLCAkY29sb3IgMCk7XG5cbiAgQGZvciAkaSBmcm9tIDEgdG8gJGdyaWQtY29sdW1ucyoyIHtcbiAgICBAaWYgaXMtZXZlbigkaSkge1xuICAgICAgJHZhbHVlczogYXBwZW5kKCR2YWx1ZXMsICR0cmFuc3BhcmVudCAkY29sdW1uLW9mZnNldCwgY29tbWEpO1xuICAgICAgJHZhbHVlczogYXBwZW5kKCR2YWx1ZXMsICRjb2xvciAkY29sdW1uLW9mZnNldCwgY29tbWEpO1xuICAgICAgJGNvbHVtbi1vZmZzZXQ6ICRjb2x1bW4tb2Zmc2V0ICsgJGNvbHVtbi13aWR0aDtcbiAgICB9IEBlbHNlIHtcbiAgICAgICR2YWx1ZXM6IGFwcGVuZCgkdmFsdWVzLCAkY29sb3IgJGNvbHVtbi1vZmZzZXQsIGNvbW1hKTtcbiAgICAgICR2YWx1ZXM6IGFwcGVuZCgkdmFsdWVzLCAkdHJhbnNwYXJlbnQgJGNvbHVtbi1vZmZzZXQsIGNvbW1hKTtcbiAgICAgICRjb2x1bW4tb2Zmc2V0OiAkY29sdW1uLW9mZnNldCArICRndXR0ZXItd2lkdGg7XG4gICAgfVxuICB9XG5cbiAgQHJldHVybiAkdmFsdWVzO1xufVxuXG4vLyBMYXlvdXQgZGlyZWN0aW9uXG5AZnVuY3Rpb24gZ2V0LWRpcmVjdGlvbigkbGF5b3V0LCAkZGVmYXVsdCkge1xuICAkZGlyZWN0aW9uOiBudWxsO1xuXG4gIEBpZiB0by11cHBlci1jYXNlKCRsYXlvdXQpID09IFwiTFRSXCIgb3IgdG8tdXBwZXItY2FzZSgkbGF5b3V0KSA9PSBcIlJUTFwiIHtcbiAgICAkZGlyZWN0aW9uOiBkaXJlY3Rpb24tZnJvbS1sYXlvdXQoJGxheW91dCk7XG4gIH0gQGVsc2Uge1xuICAgICRkaXJlY3Rpb246IGRpcmVjdGlvbi1mcm9tLWxheW91dCgkZGVmYXVsdCk7XG4gIH1cblxuICBAcmV0dXJuICRkaXJlY3Rpb247XG59XG5cbkBmdW5jdGlvbiBkaXJlY3Rpb24tZnJvbS1sYXlvdXQoJGxheW91dCkge1xuICAkZGlyZWN0aW9uOiBudWxsO1xuXG4gIEBpZiB0by11cHBlci1jYXNlKCRsYXlvdXQpID09IFwiTFRSXCIge1xuICAgICRkaXJlY3Rpb246IHJpZ2h0O1xuICB9IEBlbHNlIHtcbiAgICAkZGlyZWN0aW9uOiBsZWZ0O1xuICB9XG5cbiAgQHJldHVybiAkZGlyZWN0aW9uO1xufVxuXG5AZnVuY3Rpb24gZ2V0LW9wcG9zaXRlLWRpcmVjdGlvbigkZGlyZWN0aW9uKSB7XG4gICRvcHBvc2l0ZS1kaXJlY3Rpb246IGxlZnQ7XG5cbiAgQGlmICRkaXJlY3Rpb24gPT0gXCJsZWZ0XCIge1xuICAgICRvcHBvc2l0ZS1kaXJlY3Rpb246IHJpZ2h0O1xuICB9XG5cbiAgQHJldHVybiAkb3Bwb3NpdGUtZGlyZWN0aW9uO1xufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG4vLy8gUmV0dXJucyBhIG1lZGlhIGNvbnRleHQgKG1lZGlhIHF1ZXJ5IC8gZ3JpZCBjb250ZXh0KSB0aGF0IGNhbiBiZSBzdG9yZWQgaW4gYSB2YXJpYWJsZSBhbmQgcGFzc2VkIHRvIGBtZWRpYSgpYCBhcyBhIHNpbmdsZS1rZXl3b3JkIGFyZ3VtZW50LiBNZWRpYSBjb250ZXh0cyBkZWZpbmVkIHVzaW5nIGBuZXctYnJlYWtwb2ludGAgYXJlIHVzZWQgYnkgdGhlIHZpc3VhbCBncmlkLCBhcyBsb25nIGFzIHRoZXkgYXJlIGRlZmluZWQgYmVmb3JlIGltcG9ydGluZyBOZWF0LlxuLy8vXG4vLy8gQHBhcmFtIHtMaXN0fSAkcXVlcnlcbi8vLyAgIEEgbGlzdCBvZiBtZWRpYSBxdWVyeSBmZWF0dXJlcyBhbmQgdmFsdWVzLiBFYWNoIGAkZmVhdHVyZWAgc2hvdWxkIGhhdmUgYSBjb3JyZXNwb25kaW5nIGAkdmFsdWVgLlxuLy8vXG4vLy8gICBJZiB0aGVyZSBpcyBvbmx5IGEgc2luZ2xlIGAkdmFsdWVgIGluIGAkcXVlcnlgLCBgJGRlZmF1bHQtZmVhdHVyZWAgaXMgZ29pbmcgdG8gYmUgdXNlZC5cbi8vL1xuLy8vICAgVGhlIG51bWJlciBvZiB0b3RhbCBjb2x1bW5zIGluIHRoZSBncmlkIGNhbiBiZSBzZXQgYnkgcGFzc2luZyBgJGNvbHVtbnNgIGF0IHRoZSBlbmQgb2YgdGhlIGxpc3QgKG92ZXJyaWRlcyBgJHRvdGFsLWNvbHVtbnNgKS4gRm9yIGEgbGlzdCBvZiB2YWxpZCB2YWx1ZXMgZm9yIGAkZmVhdHVyZWAsIGNsaWNrIFtoZXJlXShodHRwOi8vd3d3LnczLm9yZy9UUi9jc3MzLW1lZGlhcXVlcmllcy8jbWVkaWExKS5cbi8vL1xuLy8vIEBwYXJhbSB7TnVtYmVyICh1bml0bGVzcyl9ICR0b3RhbC1jb2x1bW5zIFskZ3JpZC1jb2x1bW5zXVxuLy8vICAgLSBOdW1iZXIgb2YgY29sdW1ucyB0byB1c2UgaW4gdGhlIG5ldyBncmlkIGNvbnRleHQuIENhbiBiZSBzZXQgYXMgYSBzaG9ydGhhbmQgaW4gdGhlIGZpcnN0IHBhcmFtZXRlci5cbi8vL1xuLy8vIEBleGFtcGxlIHNjc3MgLSBVc2FnZVxuLy8vICAgJG1vYmlsZTogbmV3LWJyZWFrcG9pbnQobWF4LXdpZHRoIDQ4MHB4IDQpO1xuLy8vXG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIEBpbmNsdWRlIG1lZGlhKCRtb2JpbGUpIHtcbi8vLyAgICAgICBAaW5jbHVkZSBzcGFuLWNvbHVtbnMoNCk7XG4vLy8gICAgIH1cbi8vLyAgIH1cbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgIEBtZWRpYSBzY3JlZW4gYW5kIChtYXgtd2lkdGg6IDQ4MHB4KSB7XG4vLy8gICAgIC5lbGVtZW50IHtcbi8vLyAgICAgICBkaXNwbGF5OiBibG9jaztcbi8vLyAgICAgICBmbG9hdDogbGVmdDtcbi8vLyAgICAgICBtYXJnaW4tcmlnaHQ6IDcuNDIyOTclO1xuLy8vICAgICAgIHdpZHRoOiAxMDAlO1xuLy8vICAgICB9XG4vLy8gICAgIC5lbGVtZW50Omxhc3QtY2hpbGQge1xuLy8vICAgICAgIG1hcmdpbi1yaWdodDogMDtcbi8vLyAgICAgfVxuLy8vICAgfVxuXG5AZnVuY3Rpb24gbmV3LWJyZWFrcG9pbnQoJHF1ZXJ5OiAkZmVhdHVyZSAkdmFsdWUgJGNvbHVtbnMsICR0b3RhbC1jb2x1bW5zOiAkZ3JpZC1jb2x1bW5zKSB7XG4gIEBpZiBsZW5ndGgoJHF1ZXJ5KSA9PSAxIHtcbiAgICAkcXVlcnk6ICRkZWZhdWx0LWZlYXR1cmUgbnRoKCRxdWVyeSwgMSkgJHRvdGFsLWNvbHVtbnM7XG4gIH0gQGVsc2UgaWYgaXMtZXZlbihsZW5ndGgoJHF1ZXJ5KSkge1xuICAgICRxdWVyeTogYXBwZW5kKCRxdWVyeSwgJHRvdGFsLWNvbHVtbnMpO1xuICB9XG5cbiAgQGlmIGlzLW5vdChiZWxvbmdzLXRvKCRxdWVyeSwgJHZpc3VhbC1ncmlkLWJyZWFrcG9pbnRzKSkge1xuICAgICR2aXN1YWwtZ3JpZC1icmVha3BvaW50czogYXBwZW5kKCR2aXN1YWwtZ3JpZC1icmVha3BvaW50cywgJHF1ZXJ5LCBjb21tYSkgIWdsb2JhbDtcbiAgfVxuXG4gIEByZXR1cm4gJHF1ZXJ5O1xufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG4vLy8gU2V0cyB0aGUgcmVsYXRpdmUgd2lkdGggb2YgYSBzaW5nbGUgZ3JpZCBjb2x1bW4uIFRoZSB1bml0IHVzZWQgc2hvdWxkIGJlIHRoZSBzYW1lIG9uZSB1c2VkIHRvIGRlZmluZSBgJGd1dHRlcmAuIFRvIGxlYXJuIG1vcmUgYWJvdXQgbW9kdWxhci1zY2FsZSgpIHNlZSBbQm91cmJvbiBkb2NzXShodHRwOi8vYm91cmJvbi5pby9kb2NzLyNtb2R1bGFyLXNjYWxlKS4gU2V0IHdpdGggYSBgIWdsb2JhbGAgZmxhZy5cbi8vL1xuLy8vIEB0eXBlIE51bWJlciAoVW5pdClcblxuJGNvbHVtbjogbW9kdWxhci1zY2FsZSgzLCAxZW0sICRnb2xkZW4pICFkZWZhdWx0O1xuXG4vLy8gU2V0cyB0aGUgcmVsYXRpdmUgd2lkdGggb2YgYSBzaW5nbGUgZ3JpZCBndXR0ZXIuIFRoZSB1bml0IHVzZWQgc2hvdWxkIGJlIHRoZSBzYW1lIG9uZSB1c2VkIHRvIGRlZmluZSBgJGNvbHVtbmAuIFRvIGxlYXJuIG1vcmUgYWJvdXQgbW9kdWxhci1zY2FsZSgpIHNlZSBbQm91cmJvbiBkb2NzXShodHRwOi8vYm91cmJvbi5pby9kb2NzLyNtb2R1bGFyLXNjYWxlKS4gU2V0IHdpdGggdGhlIGAhZ2xvYmFsYCBmbGFnLlxuLy8vXG4vLy8gQHR5cGUgTnVtYmVyIChVbml0KVxuXG4kZ3V0dGVyOiBtb2R1bGFyLXNjYWxlKDEsIDFlbSwgJGdvbGRlbikgIWRlZmF1bHQ7XG5cbi8vLyBTZXRzIHRoZSB0b3RhbCBudW1iZXIgb2YgY29sdW1ucyBpbiB0aGUgZ3JpZC4gSXRzIHZhbHVlIGNhbiBiZSBvdmVycmlkZGVuIGluc2lkZSBhIG1lZGlhIHF1ZXJ5IHVzaW5nIHRoZSBgbWVkaWEoKWAgbWl4aW4uIFNldCB3aXRoIHRoZSBgIWdsb2JhbGAgZmxhZy5cbi8vL1xuLy8vIEB0eXBlIE51bWJlciAoVW5pdGxlc3MpXG5cbiRncmlkLWNvbHVtbnM6IDEyICFkZWZhdWx0O1xuXG4vLy8gU2V0cyB0aGUgbWF4LXdpZHRoIHByb3BlcnR5IG9mIHRoZSBlbGVtZW50IHRoYXQgaW5jbHVkZXMgYG91dGVyLWNvbnRhaW5lcigpYC4gVG8gbGVhcm4gbW9yZSBhYm91dCBgZW0oKWAgc2VlIFtCb3VyYm9uIGRvY3NdKGh0dHA6Ly9ib3VyYm9uLmlvL2RvY3MvI3B4LXRvLWVtKS4gU2V0IHdpdGggdGhlIGAhZ2xvYmFsYCBmbGFnLlxuLy8vXG4vLy8gQHR5cGUgTnVtYmVyIChVbml0KVxuLy8vXG4kbWF4LXdpZHRoOiBlbSgxMDg4KSAhZGVmYXVsdDtcblxuLy8vIFdoZW4gc2V0IHRvIHRydWUsIGl0IHNldHMgdGhlIGJveC1zaXppbmcgcHJvcGVydHkgb2YgYWxsIGVsZW1lbnRzIHRvIGBib3JkZXItYm94YC4gU2V0IHdpdGggYSBgIWdsb2JhbGAgZmxhZy5cbi8vL1xuLy8vIEB0eXBlIEJvb2xcbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgIGh0bWwge1xuLy8vICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9XG4vLy9cbi8vLyAgICosICo6OmFmdGVyLCAqOjpiZWZvcmUge1xuLy8vICAgICBib3gtc2l6aW5nOiBpbmhlcml0O1xuLy8vICAgfVxuXG4kYm9yZGVyLWJveC1zaXppbmc6IHRydWUgIWRlZmF1bHQ7XG5cbi8vLyBTZXRzIHRoZSBkZWZhdWx0IFttZWRpYSBmZWF0dXJlXShodHRwOi8vd3d3LnczLm9yZy9UUi9jc3MzLW1lZGlhcXVlcmllcy8jbWVkaWEpIHRoYXQgYG1lZGlhKClgIGFuZCBgbmV3LWJyZWFrcG9pbnQoKWAgcmV2ZXJ0IHRvIHdoZW4gb25seSBhIGJyZWFrcG9pbnQgdmFsdWUgaXMgcGFzc2VkLiBTZXQgd2l0aCBhIGAhZ2xvYmFsYCBmbGFnLlxuLy8vXG4vLy8gQHR5cGUgU3RyaW5nXG5cbiRkZWZhdWx0LWZlYXR1cmU6IG1pbi13aWR0aDsgLy8gRGVmYXVsdCBAbWVkaWEgZmVhdHVyZSBmb3IgdGhlIGJyZWFrcG9pbnQoKSBtaXhpblxuXG4vLy9TZXRzIHRoZSBkZWZhdWx0IGxheW91dCBkaXJlY3Rpb24gb2YgdGhlIGdyaWQuIENhbiBiZSBgTFRSYCBvciBgUlRMYC4gU2V0IHdpdGggYSBgIWdsb2JhbGAgZmxhZy5cbi8vL1xuLy8vQHR5cGUgU3RyaW5nXG5cbiRkZWZhdWx0LWxheW91dC1kaXJlY3Rpb246IExUUiAhZGVmYXVsdDtcbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIERpc3BsYXlzIHRoZSB2aXN1YWwgZ3JpZCB3aGVuIHNldCB0byB0cnVlLiBUaGUgb3ZlcmxhaWQgZ3JpZCBtYXkgYmUgZmV3IHBpeGVscyBvZmYgZGVwZW5kaW5nIG9uIHRoZSBicm93c2VyJ3MgcmVuZGVyaW5nIGVuZ2luZSBhbmQgcGl4ZWwgcm91bmRpbmcgYWxnb3JpdGhtLiBTZXQgd2l0aCB0aGUgYCFnbG9iYWxgIGZsYWcuXG4vLy9cbi8vLyBAdHlwZSBCb29sXG5cbiR2aXN1YWwtZ3JpZDogZmFsc2UgIWRlZmF1bHQ7XG5cbi8vLyBTZXRzIHRoZSB2aXN1YWwgZ3JpZCBjb2xvci4gU2V0IHdpdGggYCFnbG9iYWxgIGZsYWcuXG4vLy9cbi8vLyBAdHlwZSBDb2xvclxuXG4kdmlzdWFsLWdyaWQtY29sb3I6ICNlZWUgIWRlZmF1bHQ7XG5cbi8vLyBTZXRzIHRoZSBgei1pbmRleGAgcHJvcGVydHkgb2YgdGhlIHZpc3VhbCBncmlkLiBDYW4gYmUgYGJhY2tgIChiZWhpbmQgY29udGVudCkgb3IgYGZyb250YCAoaW4gZnJvbnQgb2YgY29udGVudCkuIFNldCB3aXRoIGAhZ2xvYmFsYCBmbGFnLlxuLy8vXG4vLy8gQHR5cGUgU3RyaW5nXG5cbiR2aXN1YWwtZ3JpZC1pbmRleDogYmFjayAhZGVmYXVsdDtcblxuLy8vIFNldHMgdGhlIG9wYWNpdHkgcHJvcGVydHkgb2YgdGhlIHZpc3VhbCBncmlkLiBTZXQgd2l0aCBgIWdsb2JhbGAgZmxhZy5cbi8vL1xuLy8vIEB0eXBlIE51bWJlciAodW5pdGxlc3MpXG5cbiR2aXN1YWwtZ3JpZC1vcGFjaXR5OiAwLjQgIWRlZmF1bHQ7XG5cbiR2aXN1YWwtZ3JpZC1icmVha3BvaW50czogKCkgIWRlZmF1bHQ7XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbi8vLyBEaXNhYmxlIGFsbCBkZXByZWNhdGlvbiB3YXJuaW5ncy4gRGVmYXVsdHMgdG8gYGZhbHNlYC4gU2V0IHdpdGggYSBgIWdsb2JhbGAgZmxhZy5cbi8vL1xuLy8vIEB0eXBlIEJvb2xcblxuJGRpc2FibGUtd2FybmluZ3M6IGZhbHNlICFkZWZhdWx0O1xuXG5AbWl4aW4gLW5lYXQtd2FybigkbWVzc2FnZSkge1xuICBAaWYgJGRpc2FibGUtd2FybmluZ3MgPT0gZmFsc2Uge1xuICAgIEB3YXJuIFwiI3skbWVzc2FnZX1cIjtcbiAgfVxufVxuIiwiJHBhcmVudC1jb2x1bW5zOiAkZ3JpZC1jb2x1bW5zICFkZWZhdWx0O1xuJGZnLWNvbHVtbjogJGNvbHVtbjtcbiRmZy1ndXR0ZXI6ICRndXR0ZXI7XG4kZmctbWF4LWNvbHVtbnM6ICRncmlkLWNvbHVtbnM7XG4kY29udGFpbmVyLWRpc3BsYXktdGFibGU6IGZhbHNlICFkZWZhdWx0O1xuJGxheW91dC1kaXJlY3Rpb246IExUUiAhZGVmYXVsdDtcblxuQGZ1bmN0aW9uIGZsZXgtZ3JpZCgkY29sdW1ucywgJGNvbnRhaW5lci1jb2x1bW5zOiAkZmctbWF4LWNvbHVtbnMpIHtcbiAgJHdpZHRoOiAkY29sdW1ucyAqICRmZy1jb2x1bW4gKyAoJGNvbHVtbnMgLSAxKSAqICRmZy1ndXR0ZXI7XG4gICRjb250YWluZXItd2lkdGg6ICRjb250YWluZXItY29sdW1ucyAqICRmZy1jb2x1bW4gKyAoJGNvbnRhaW5lci1jb2x1bW5zIC0gMSkgKiAkZmctZ3V0dGVyO1xuICBAcmV0dXJuIHBlcmNlbnRhZ2UoJHdpZHRoIC8gJGNvbnRhaW5lci13aWR0aCk7XG59XG5cbkBmdW5jdGlvbiBmbGV4LWd1dHRlcigkY29udGFpbmVyLWNvbHVtbnM6ICRmZy1tYXgtY29sdW1ucywgJGd1dHRlcjogJGZnLWd1dHRlcikge1xuICAkY29udGFpbmVyLXdpZHRoOiAkY29udGFpbmVyLWNvbHVtbnMgKiAkZmctY29sdW1uICsgKCRjb250YWluZXItY29sdW1ucyAtIDEpICogJGZnLWd1dHRlcjtcbiAgQHJldHVybiBwZXJjZW50YWdlKCRndXR0ZXIgLyAkY29udGFpbmVyLXdpZHRoKTtcbn1cblxuQGZ1bmN0aW9uIGdyaWQtd2lkdGgoJG4pIHtcbiAgQHJldHVybiAkbiAqICRndy1jb2x1bW4gKyAoJG4gLSAxKSAqICRndy1ndXR0ZXI7XG59XG5cbkBmdW5jdGlvbiBnZXQtcGFyZW50LWNvbHVtbnMoJGNvbHVtbnMpIHtcbiAgQGlmICRjb2x1bW5zICE9ICRncmlkLWNvbHVtbnMge1xuICAgICRwYXJlbnQtY29sdW1uczogJGNvbHVtbnMgIWdsb2JhbDtcbiAgfSBAZWxzZSB7XG4gICAgJHBhcmVudC1jb2x1bW5zOiAkZ3JpZC1jb2x1bW5zICFnbG9iYWw7XG4gIH1cblxuICBAcmV0dXJuICRwYXJlbnQtY29sdW1ucztcbn1cblxuQGZ1bmN0aW9uIGlzLWRpc3BsYXktdGFibGUoJGNvbnRhaW5lci1pcy1kaXNwbGF5LXRhYmxlLCAkZGlzcGxheSkge1xuICBAcmV0dXJuICRjb250YWluZXItaXMtZGlzcGxheS10YWJsZSA9PSB0cnVlIG9yICRkaXNwbGF5ID09IHRhYmxlO1xufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG5AaWYgJGJvcmRlci1ib3gtc2l6aW5nID09IHRydWUge1xuICBodG1sIHsgLy8gaHR0cDovL2JpdC5seS8xcWsydFZSXG4gICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgfVxuXG4gICoge1xuICAgICYsXG4gICAgJjo6YWZ0ZXIsXG4gICAgJjo6YmVmb3JlIHtcbiAgICAgIGJveC1zaXppbmc6IGluaGVyaXQ7XG4gICAgfVxuICB9XG59XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbi8vLyBSZW1vdmVzIHRoZSBlbGVtZW50J3MgZ3V0dGVyIG1hcmdpbiwgcmVnYXJkbGVzcyBvZiBpdHMgcG9zaXRpb24gaW4gdGhlIGdyaWQgaGllcmFyY2h5IG9yIGRpc3BsYXkgcHJvcGVydHkuIEl0IGNhbiB0YXJnZXQgYSBzcGVjaWZpYyBlbGVtZW50LCBvciBldmVyeSBgbnRoLWNoaWxkYCBvY2N1cnJlbmNlLiBXb3JrcyBvbmx5IHdpdGggYGJsb2NrYCBsYXlvdXRzLlxuLy8vXG4vLy8gQHBhcmFtIHtMaXN0fSAkcXVlcnkgW2Jsb2NrXVxuLy8vICAgTGlzdCBvZiBhcmd1bWVudHMuIFN1cHBvcnRlZCBhcmd1bWVudHMgYXJlIGBudGgtY2hpbGRgIHNlbGVjdG9ycyAodGFyZ2V0cyBhIHNwZWNpZmljIHBzZXVkbyBlbGVtZW50KSBhbmQgYGF1dG9gICh0YXJnZXRzIGBsYXN0LWNoaWxkYCkuXG4vLy9cbi8vLyAgIFdoZW4gcGFzc2VkIGFuIGBudGgtY2hpbGRgIGFyZ3VtZW50IG9mIHR5cGUgYCpuYCB3aXRoIGBibG9ja2AgZGlzcGxheSwgdGhlIG9tZWdhIG1peGluIGF1dG9tYXRpY2FsbHkgYWRkcyBhIGNsZWFyIHRvIHRoZSBgKm4rMWAgdGggZWxlbWVudC4gTm90ZSB0aGF0IGNvbXBvc2l0ZSBhcmd1bWVudHMgc3VjaCBhcyBgMm4rMWAgZG8gbm90IHN1cHBvcnQgdGhpcyBmZWF0dXJlLlxuLy8vXG4vLy8gICAqKkRlcHJlY2F0aW9uIHdhcm5pbmcqKjogVGhlIG9tZWdhIG1peGluIHdpbGwgbm8gbG9uZ2VyIHRha2UgYSBgJGRpcmVjdGlvbmAgYXJndW1lbnQuIFRvIGNoYW5nZSB0aGUgbGF5b3V0IGRpcmVjdGlvbiwgdXNlIGByb3coJGRpcmVjdGlvbilgIG9yIHNldCBgJGRlZmF1bHQtbGF5b3V0LWRpcmVjdGlvbmAgaW5zdGVhZC5cbi8vL1xuLy8vIEBleGFtcGxlIHNjc3MgLSBVc2FnZVxuLy8vICAgLmVsZW1lbnQge1xuLy8vICAgICBAaW5jbHVkZSBvbWVnYTtcbi8vLyAgIH1cbi8vL1xuLy8vICAgLm50aC1lbGVtZW50IHtcbi8vLyAgICAgQGluY2x1ZGUgb21lZ2EoNG4pO1xuLy8vICAgfVxuLy8vXG4vLy8gQGV4YW1wbGUgY3NzIC0gQ1NTIE91dHB1dFxuLy8vICAgLmVsZW1lbnQge1xuLy8vICAgICBtYXJnaW4tcmlnaHQ6IDA7XG4vLy8gICB9XG4vLy9cbi8vLyAgIC5udGgtZWxlbWVudDpudGgtY2hpbGQoNG4pIHtcbi8vLyAgICAgbWFyZ2luLXJpZ2h0OiAwO1xuLy8vICAgfVxuLy8vXG4vLy8gICAubnRoLWVsZW1lbnQ6bnRoLWNoaWxkKDRuKzEpIHtcbi8vLyAgICAgY2xlYXI6IGxlZnQ7XG4vLy8gICB9XG5cbkBtaXhpbiBvbWVnYSgkcXVlcnk6IGJsb2NrLCAkZGlyZWN0aW9uOiBkZWZhdWx0KSB7XG4gICR0YWJsZTogYmVsb25ncy10byh0YWJsZSwgJHF1ZXJ5KTtcbiAgJGF1dG86IGJlbG9uZ3MtdG8oYXV0bywgJHF1ZXJ5KTtcblxuICBAaWYgJGRpcmVjdGlvbiAhPSBkZWZhdWx0IHtcbiAgICBAaW5jbHVkZSAtbmVhdC13YXJuKFwiVGhlIG9tZWdhIG1peGluIHdpbGwgbm8gbG9uZ2VyIHRha2UgYSAkZGlyZWN0aW9uIGFyZ3VtZW50LiBUbyBjaGFuZ2UgdGhlIGxheW91dCBkaXJlY3Rpb24sIHVzZSB0aGUgZGlyZWN0aW9uKCl7Li4ufSBtaXhpbi5cIik7XG4gIH0gQGVsc2Uge1xuICAgICRkaXJlY3Rpb246IGdldC1kaXJlY3Rpb24oJGxheW91dC1kaXJlY3Rpb24sICRkZWZhdWx0LWxheW91dC1kaXJlY3Rpb24pO1xuICB9XG5cbiAgQGlmICR0YWJsZSB7XG4gICAgQGluY2x1ZGUgLW5lYXQtd2FybihcIlRoZSBvbWVnYSBtaXhpbiBubyBsb25nZXIgcmVtb3ZlcyBwYWRkaW5nIGluIHRhYmxlIGxheW91dHMuXCIpO1xuICB9XG5cbiAgQGlmIGxlbmd0aCgkcXVlcnkpID09IDEge1xuICAgIEBpZiAkYXV0byB7XG4gICAgICAmOmxhc3QtY2hpbGQge1xuICAgICAgICBtYXJnaW4tI3skZGlyZWN0aW9ufTogMDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBAZWxzZSBpZiBjb250YWlucy1kaXNwbGF5LXZhbHVlKCRxdWVyeSkgYW5kICR0YWJsZSA9PSBmYWxzZSB7XG4gICAgICBtYXJnaW4tI3skZGlyZWN0aW9ufTogMDtcbiAgICB9XG5cbiAgICBAZWxzZSB7XG4gICAgICBAaW5jbHVkZSBudGgtY2hpbGQoJHF1ZXJ5LCAkZGlyZWN0aW9uKTtcbiAgICB9XG4gIH0gQGVsc2UgaWYgbGVuZ3RoKCRxdWVyeSkgPT0gMiB7XG4gICAgQGlmICRhdXRvIHtcbiAgICAgICY6bGFzdC1jaGlsZCB7XG4gICAgICAgIG1hcmdpbi0jeyRkaXJlY3Rpb259OiAwO1xuICAgICAgfVxuICAgIH0gQGVsc2Uge1xuICAgICAgQGluY2x1ZGUgbnRoLWNoaWxkKG50aCgkcXVlcnksIDEpLCAkZGlyZWN0aW9uKTtcbiAgICB9XG4gIH0gQGVsc2Uge1xuICAgIEBpbmNsdWRlIC1uZWF0LXdhcm4oXCJUb28gbWFueSBhcmd1bWVudHMgcGFzc2VkIHRvIHRoZSBvbWVnYSgpIG1peGluLlwiKTtcbiAgfVxufVxuXG5AbWl4aW4gbnRoLWNoaWxkKCRxdWVyeSwgJGRpcmVjdGlvbikge1xuICAkb3Bwb3NpdGUtZGlyZWN0aW9uOiBnZXQtb3Bwb3NpdGUtZGlyZWN0aW9uKCRkaXJlY3Rpb24pO1xuXG4gICY6bnRoLWNoaWxkKCN7JHF1ZXJ5fSkge1xuICAgIG1hcmdpbi0jeyRkaXJlY3Rpb259OiAwO1xuICB9XG5cbiAgQGlmIHR5cGUtb2YoJHF1ZXJ5KSA9PSBudW1iZXIgYW5kIHVuaXQoJHF1ZXJ5KSA9PSBcIm5cIiB7XG4gICAgJjpudGgtY2hpbGQoI3skcXVlcnl9KzEpIHtcbiAgICAgIGNsZWFyOiAkb3Bwb3NpdGUtZGlyZWN0aW9uO1xuICAgIH1cbiAgfVxufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG4vLy8gTWFrZXMgYW4gZWxlbWVudCBhIG91dGVyIGNvbnRhaW5lciBieSBjZW50cmluZyBpdCBpbiB0aGUgdmlld3BvcnQsIGNsZWFyaW5nIGl0cyBmbG9hdHMsIGFuZCBzZXR0aW5nIGl0cyBgbWF4LXdpZHRoYC5cbi8vLyBBbHRob3VnaCBvcHRpb25hbCwgdXNpbmcgYG91dGVyLWNvbnRhaW5lcmAgaXMgcmVjb21tZW5kZWQuIFRoZSBtaXhpbiBjYW4gYmUgY2FsbGVkIG9uIG1vcmUgdGhhbiBvbmUgZWxlbWVudCBwZXIgcGFnZSwgYXMgbG9uZyBhcyB0aGV5IGFyZSBub3QgbmVzdGVkLlxuLy8vXG4vLy8gQHBhcmFtIHtOdW1iZXIgW3VuaXRdfSAkbG9jYWwtbWF4LXdpZHRoIFskbWF4LXdpZHRoXVxuLy8vICAgTWF4IHdpZHRoIHRvIGJlIGFwcGxpZWQgdG8gdGhlIGVsZW1lbnQuIENhbiBiZSBhIHBlcmNlbnRhZ2Ugb3IgYSBtZWFzdXJlLlxuLy8vXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIEBpbmNsdWRlIG91dGVyLWNvbnRhaW5lcigxMDAlKTtcbi8vLyAgIH1cbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgKnpvb206IDE7XG4vLy8gICAgIG1heC13aWR0aDogMTAwJTtcbi8vLyAgICAgbWFyZ2luLWxlZnQ6IGF1dG87XG4vLy8gICAgIG1hcmdpbi1yaWdodDogYXV0bztcbi8vLyAgIH1cbi8vL1xuLy8vICAgLmVsZW1lbnQ6YmVmb3JlLCAuZWxlbWVudDphZnRlciB7XG4vLy8gICAgIGNvbnRlbnQ6IFwiIFwiO1xuLy8vICAgICBkaXNwbGF5OiB0YWJsZTtcbi8vLyAgIH1cbi8vL1xuLy8vICAgLmVsZW1lbnQ6YWZ0ZXIge1xuLy8vICAgICBjbGVhcjogYm90aDtcbi8vLyAgIH1cblxuQG1peGluIG91dGVyLWNvbnRhaW5lcigkbG9jYWwtbWF4LXdpZHRoOiAkbWF4LXdpZHRoKSB7XG4gIEBpbmNsdWRlIGNsZWFyZml4O1xuICBtYXgtd2lkdGg6ICRsb2NhbC1tYXgtd2lkdGg7XG4gIG1hcmdpbjoge1xuICAgIGxlZnQ6IGF1dG87XG4gICAgcmlnaHQ6IGF1dG87XG4gIH1cbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIFNwZWNpZmllcyB0aGUgbnVtYmVyIG9mIGNvbHVtbnMgYW4gZWxlbWVudCBzaG91bGQgc3Bhbi4gSWYgdGhlIHNlbGVjdG9yIGlzIG5lc3RlZCB0aGUgbnVtYmVyIG9mIGNvbHVtbnMgb2YgaXRzIHBhcmVudCBlbGVtZW50IHNob3VsZCBiZSBwYXNzZWQgYXMgYW4gYXJndW1lbnQgYXMgd2VsbC5cbi8vL1xuLy8vIEBwYXJhbSB7TGlzdH0gJHNwYW5cbi8vLyAgIEEgbGlzdCBjb250YWluaW5nIGAkY29sdW1uc2AsIHRoZSB1bml0bGVzcyBudW1iZXIgb2YgY29sdW1ucyB0aGUgZWxlbWVudCBzcGFucyAocmVxdWlyZWQpLCBhbmQgYCRjb250YWluZXItY29sdW1uc2AsIHRoZSBudW1iZXIgb2YgY29sdW1ucyB0aGUgcGFyZW50IGVsZW1lbnQgc3BhbnMgKG9wdGlvbmFsKS5cbi8vL1xuLy8vICAgSWYgb25seSBvbmUgdmFsdWUgaXMgcGFzc2VkLCBpdCBpcyBhc3N1bWVkIHRoYXQgaXQncyBgJGNvbHVtbnNgIGFuZCB0aGF0IHRoYXQgYCRjb250YWluZXItY29sdW1uc2AgaXMgZXF1YWwgdG8gYCRncmlkLWNvbHVtbnNgLCB0aGUgdG90YWwgbnVtYmVyIG9mIGNvbHVtbnMgaW4gdGhlIGdyaWQuXG4vLy9cbi8vLyAgIFRoZSB2YWx1ZXMgY2FuIGJlIHNlcGFyYXRlZCB3aXRoIGFueSBzdHJpbmcgc3VjaCBhcyBgb2ZgLCBgL2AsIGV0Yy5cbi8vL1xuLy8vICAgYCRjb2x1bW5zYCBhbHNvIGFjY2VwdHMgZGVjaW1hbHMgZm9yIHdoZW4gaXQncyBuZWNlc3NhcnkgdG8gYnJlYWsgb3V0IG9mIHRoZSBzdGFuZGFyZCBncmlkLiBFLmcuIFBhc3NpbmcgYDIuNGAgaW4gYSBzdGFuZGFyZCAxMiBjb2x1bW4gZ3JpZCB3aWxsIGRpdmlkZSB0aGUgcm93IGludG8gNSBjb2x1bW5zLlxuLy8vXG4vLy8gQHBhcmFtIHtTdHJpbmd9ICRkaXNwbGF5IFtibG9ja11cbi8vLyAgIFNldHMgdGhlIGRpc3BsYXkgcHJvcGVydHkgb2YgdGhlIGVsZW1lbnQuIEJ5IGRlZmF1bHQgaXQgc2V0cyB0aGUgZGlzcGxheSBwcm9wZXJ0IG9mIHRoZSBlbGVtZW50IHRvIGBibG9ja2AuXG4vLy9cbi8vLyAgIElmIHBhc3NlZCBgYmxvY2stY29sbGFwc2VgLCBpdCBhbHNvIHJlbW92ZXMgdGhlIG1hcmdpbiBndXR0ZXIgYnkgYWRkaW5nIGl0IHRvIHRoZSBlbGVtZW50IHdpZHRoLlxuLy8vXG4vLy8gICBJZiBwYXNzZWQgYHRhYmxlYCwgaXQgc2V0cyB0aGUgZGlzcGxheSBwcm9wZXJ0eSB0byBgdGFibGUtY2VsbGAgYW5kIGNhbGN1bGF0ZXMgdGhlIHdpZHRoIG9mIHRoZSBlbGVtZW50IHdpdGhvdXQgdGFraW5nIGd1dHRlcnMgaW50byBjb25zaWRlcmF0aW9uLiBUaGUgcmVzdWx0IGRvZXMgbm90IGFsaWduIHdpdGggdGhlIGJsb2NrLWJhc2VkIGdyaWQuXG4vLy9cbi8vLyBAZXhhbXBsZSBzY3NzIC0gVXNhZ2Vcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgQGluY2x1ZGUgc3Bhbi1jb2x1bW5zKDYpO1xuLy8vXG4vLy8gICAgLm5lc3RlZC1lbGVtZW50IHtcbi8vLyAgICAgIEBpbmNsdWRlIHNwYW4tY29sdW1ucygyIG9mIDYpO1xuLy8vICAgIH1cbi8vLyAgfVxuLy8vXG4vLy8gQGV4YW1wbGUgY3NzIC0gQ1NTIE91dHB1dFxuLy8vICAgLmVsZW1lbnQge1xuLy8vICAgICBkaXNwbGF5OiBibG9jaztcbi8vLyAgICAgZmxvYXQ6IGxlZnQ7XG4vLy8gICAgIG1hcmdpbi1yaWdodDogMi4zNTc2NSU7XG4vLy8gICAgIHdpZHRoOiA0OC44MjExNyU7XG4vLy8gICB9XG4vLy9cbi8vLyAgIC5lbGVtZW50Omxhc3QtY2hpbGQge1xuLy8vICAgICBtYXJnaW4tcmlnaHQ6IDA7XG4vLy8gICB9XG4vLy9cbi8vLyAgIC5lbGVtZW50IC5uZXN0ZWQtZWxlbWVudCB7XG4vLy8gICAgIGRpc3BsYXk6IGJsb2NrO1xuLy8vICAgICBmbG9hdDogbGVmdDtcbi8vLyAgICAgbWFyZ2luLXJpZ2h0OiA0LjgyOTE2JTtcbi8vLyAgICAgd2lkdGg6IDMwLjExMzg5JTtcbi8vLyAgIH1cbi8vL1xuLy8vICAgLmVsZW1lbnQgLm5lc3RlZC1lbGVtZW50Omxhc3QtY2hpbGQge1xuLy8vICAgICBtYXJnaW4tcmlnaHQ6IDA7XG4vLy8gICB9XG5cbkBtaXhpbiBzcGFuLWNvbHVtbnMoJHNwYW46ICRjb2x1bW5zIG9mICRjb250YWluZXItY29sdW1ucywgJGRpc3BsYXk6IGJsb2NrKSB7XG4gICRjb2x1bW5zOiBudGgoJHNwYW4sIDEpO1xuICAkY29udGFpbmVyLWNvbHVtbnM6IGNvbnRhaW5lci1zcGFuKCRzcGFuKTtcblxuICAkcGFyZW50LWNvbHVtbnM6IGdldC1wYXJlbnQtY29sdW1ucygkY29udGFpbmVyLWNvbHVtbnMpICFnbG9iYWw7XG5cbiAgJGRpcmVjdGlvbjogZ2V0LWRpcmVjdGlvbigkbGF5b3V0LWRpcmVjdGlvbiwgJGRlZmF1bHQtbGF5b3V0LWRpcmVjdGlvbik7XG4gICRvcHBvc2l0ZS1kaXJlY3Rpb246IGdldC1vcHBvc2l0ZS1kaXJlY3Rpb24oJGRpcmVjdGlvbik7XG5cbiAgJGRpc3BsYXktdGFibGU6IGlzLWRpc3BsYXktdGFibGUoJGNvbnRhaW5lci1kaXNwbGF5LXRhYmxlLCAkZGlzcGxheSk7XG5cbiAgQGlmICRkaXNwbGF5LXRhYmxlICB7XG4gICAgZGlzcGxheTogdGFibGUtY2VsbDtcbiAgICB3aWR0aDogcGVyY2VudGFnZSgkY29sdW1ucyAvICRjb250YWluZXItY29sdW1ucyk7XG4gIH0gQGVsc2Uge1xuICAgIGZsb2F0OiAjeyRvcHBvc2l0ZS1kaXJlY3Rpb259O1xuXG4gICAgQGlmICRkaXNwbGF5ICE9IG5vLWRpc3BsYXkge1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgfVxuXG4gICAgQGlmICRkaXNwbGF5ID09IGNvbGxhcHNlIHtcbiAgICAgIEBpbmNsdWRlIC1uZWF0LXdhcm4oXCJUaGUgJ2NvbGxhcHNlJyBhcmd1bWVudCB3aWxsIGJlIGRlcHJlY2F0ZWQuIFVzZSAnYmxvY2stY29sbGFwc2UnIGluc3RlYWQuXCIpO1xuICAgIH1cblxuICAgIEBpZiAkZGlzcGxheSA9PSBjb2xsYXBzZSBvciAkZGlzcGxheSA9PSBibG9jay1jb2xsYXBzZSB7XG4gICAgICB3aWR0aDogZmxleC1ncmlkKCRjb2x1bW5zLCAkY29udGFpbmVyLWNvbHVtbnMpICsgZmxleC1ndXR0ZXIoJGNvbnRhaW5lci1jb2x1bW5zKTtcblxuICAgICAgJjpsYXN0LWNoaWxkIHtcbiAgICAgICAgd2lkdGg6IGZsZXgtZ3JpZCgkY29sdW1ucywgJGNvbnRhaW5lci1jb2x1bW5zKTtcbiAgICAgIH1cblxuICAgIH0gQGVsc2Uge1xuICAgICAgbWFyZ2luLSN7JGRpcmVjdGlvbn06IGZsZXgtZ3V0dGVyKCRjb250YWluZXItY29sdW1ucyk7XG4gICAgICB3aWR0aDogZmxleC1ncmlkKCRjb2x1bW5zLCAkY29udGFpbmVyLWNvbHVtbnMpO1xuXG4gICAgICAmOmxhc3QtY2hpbGQge1xuICAgICAgICBtYXJnaW4tI3skZGlyZWN0aW9ufTogMDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIERlc2lnbmF0ZXMgdGhlIGVsZW1lbnQgYXMgYSByb3cgb2YgY29sdW1ucyBpbiB0aGUgZ3JpZCBsYXlvdXQuIEl0IGNsZWFycyB0aGUgZmxvYXRzIG9uIHRoZSBlbGVtZW50IGFuZCBzZXRzIGl0cyBkaXNwbGF5IHByb3BlcnR5LiBSb3dzIGNhbid0IGJlIG5lc3RlZCwgYnV0IHRoZXJlIGNhbiBiZSBtb3JlIHRoYW4gb25lIHJvdyBlbGVtZW504oCUd2l0aCBkaWZmZXJlbnQgZGlzcGxheSBwcm9wZXJ0aWVz4oCUcGVyIGxheW91dC5cbi8vL1xuLy8vIEBwYXJhbSB7U3RyaW5nfSAkZGlzcGxheSBbZGVmYXVsdF1cbi8vLyAgU2V0cyB0aGUgZGlzcGxheSBwcm9wZXJ0eSBvZiB0aGUgZWxlbWVudCBhbmQgdGhlIGRpc3BsYXkgY29udGV4dCB0aGF0IHdpbGwgYmUgdXNlZCBieSBpdHMgY2hpbGRyZW4uIENhbiBiZSBgYmxvY2tgIG9yIGB0YWJsZWAuXG4vLy9cbi8vLyBAcGFyYW0ge1N0cmluZ30gJGRpcmVjdGlvbiBbJGRlZmF1bHQtbGF5b3V0LWRpcmVjdGlvbl1cbi8vLyAgU2V0cyB0aGUgbGF5b3V0IGRpcmVjdGlvbi4gQ2FuIGJlIGBMVFJgIChsZWZ0LXRvLXJpZ2h0KSBvciBgUlRMYCAocmlnaHQtdG8tbGVmdCkuXG4vLy9cbi8vLyBAZXhhbXBsZSBzY3NzIC0gVXNhZ2Vcbi8vLyAgLmVsZW1lbnQge1xuLy8vICAgIEBpbmNsdWRlIHJvdygpO1xuLy8vICB9XG4vLy9cbi8vLyBAZXhhbXBsZSBjc3MgLSBDU1MgT3V0cHV0XG4vLy8gIC5lbGVtZW50IHtcbi8vLyAgICAqem9vbTogMTtcbi8vLyAgICBkaXNwbGF5OiBibG9jaztcbi8vLyAgfVxuLy8vXG4vLy8gLmVsZW1lbnQ6YmVmb3JlLCAuZWxlbWVudDphZnRlciB7XG4vLy8gICBjb250ZW50OiBcIiBcIjtcbi8vLyAgIGRpc3BsYXk6IHRhYmxlO1xuLy8vIH1cbi8vL1xuLy8vIC5lbGVtZW50OmFmdGVyIHtcbi8vLyAgIGNsZWFyOiBib3RoO1xuLy8vIH1cblxuQG1peGluIHJvdygkZGlzcGxheTogZGVmYXVsdCwgJGRpcmVjdGlvbjogJGRlZmF1bHQtbGF5b3V0LWRpcmVjdGlvbikge1xuICBAaWYgJGRpcmVjdGlvbiAhPSAkZGVmYXVsdC1sYXlvdXQtZGlyZWN0aW9uIHtcbiAgICBAaW5jbHVkZSAtbmVhdC13YXJuKFwiVGhlICRkaXJlY3Rpb24gYXJndW1lbnQgd2lsbCBiZSBkZXByZWNhdGVkIGluIGZ1dHVyZSB2ZXJzaW9ucyBpbiBmYXZvciBvZiB0aGUgZGlyZWN0aW9uKCl7Li4ufSBtaXhpbi5cIik7XG4gIH1cblxuICAkbGF5b3V0LWRpcmVjdGlvbjogJGRpcmVjdGlvbiAhZ2xvYmFsO1xuXG4gIEBpZiAkZGlzcGxheSAhPSBkZWZhdWx0IHtcbiAgICBAaW5jbHVkZSAtbmVhdC13YXJuKFwiVGhlICRkaXNwbGF5IGFyZ3VtZW50IHdpbGwgYmUgZGVwcmVjYXRlZCBpbiBmdXR1cmUgdmVyc2lvbnMgaW4gZmF2b3Igb2YgdGhlIGRpc3BsYXkoKXsuLi59IG1peGluLlwiKTtcbiAgfVxuXG4gIEBpZiAkZGlzcGxheSA9PSB0YWJsZSB7XG4gICAgZGlzcGxheTogdGFibGU7XG4gICAgQGluY2x1ZGUgZmlsbC1wYXJlbnQ7XG4gICAgdGFibGUtbGF5b3V0OiBmaXhlZDtcbiAgICAkY29udGFpbmVyLWRpc3BsYXktdGFibGU6IHRydWUgIWdsb2JhbDtcbiAgfSBAZWxzZSB7XG4gICAgQGluY2x1ZGUgY2xlYXJmaXg7XG4gICAgZGlzcGxheTogYmxvY2s7XG4gICAgJGNvbnRhaW5lci1kaXNwbGF5LXRhYmxlOiBmYWxzZSAhZ2xvYmFsO1xuICB9XG59XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbi8vLyBUcmFuc2xhdGVzIGFuIGVsZW1lbnQgaG9yaXpvbnRhbGx5IGJ5IGEgbnVtYmVyIG9mIGNvbHVtbnMuIFBvc2l0aXZlIGFyZ3VtZW50cyBzaGlmdCB0aGUgZWxlbWVudCB0byB0aGUgYWN0aXZlIGxheW91dCBkaXJlY3Rpb24sIHdoaWxlIG5lZ2F0aXZlIG9uZXMgc2hpZnQgaXQgdG8gdGhlIG9wcG9zaXRlIGRpcmVjdGlvbi5cbi8vL1xuLy8vIEBwYXJhbSB7TnVtYmVyICh1bml0bGVzcyl9ICRuLWNvbHVtbnMgWzFdXG4vLy8gICBOdW1iZXIgb2YgY29sdW1ucyBieSB3aGljaCB0aGUgZWxlbWVudCBzaGlmdHMuXG4vLy9cbi8vLyBAZXhhbXBsZSBzY3NzIC0gVXNhZ2Vcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgQGluY2x1ZGUgc2hpZnQoLTMpO1xuLy8vICAgfVxuLy8vXG4vLy8gQGV4YW1wbGUgY3NzIC0gQ1NTIG91dHB1dFxuLy8vICAgLmVsZW1lbnQge1xuLy8vICAgICBtYXJnaW4tbGVmdDogLTI1LjU4OTQxJTtcbi8vLyAgIH1cblxuQG1peGluIHNoaWZ0KCRuLWNvbHVtbnM6IDEpIHtcbiAgQGluY2x1ZGUgc2hpZnQtaW4tY29udGV4dCgkbi1jb2x1bW5zKTtcbn1cblxuLy8vIFRyYW5zbGF0ZXMgYW4gZWxlbWVudCBob3Jpem9udGFsbHkgYnkgYSBudW1iZXIgb2YgY29sdW1ucywgaW4gYSBzcGVjaWZpYyBuZXN0aW5nIGNvbnRleHQuXG4vLy9cbi8vLyBAcGFyYW0ge0xpc3R9ICRzaGlmdFxuLy8vICAgQSBsaXN0IGNvbnRhaW5pbmcgdGhlIG51bWJlciBvZiBjb2x1bW5zIHRvIHNoaWZ0IChgJGNvbHVtbnNgKSBhbmQgdGhlIG51bWJlciBvZiBjb2x1bW5zIG9mIHRoZSBwYXJlbnQgZWxlbWVudCAoYCRjb250YWluZXItY29sdW1uc2ApLlxuLy8vXG4vLy8gICBUaGUgdHdvIHZhbHVlcyBjYW4gYmUgc2VwYXJhdGVkIHdpdGggYW55IHN0cmluZyBzdWNoIGFzIGBvZmAsIGAvYCwgZXRjLlxuLy8vXG4vLy8gQGV4YW1wbGUgc2NzcyAtIFVzYWdlXG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIEBpbmNsdWRlIHNoaWZ0KC0zIG9mIDYpO1xuLy8vICAgfVxuLy8vXG4vLy8gQGV4YW1wbGUgY3NzIC0gQ1NTIG91dHB1dFxuLy8vICAgLmVsZW1lbnQge1xuLy8vICAgICBtYXJnaW4tbGVmdDogLTUyLjQxNDU4JTtcbi8vLyAgIH1cblxuQG1peGluIHNoaWZ0LWluLWNvbnRleHQoJHNoaWZ0OiAkY29sdW1ucyBvZiAkY29udGFpbmVyLWNvbHVtbnMpIHtcbiAgJG4tY29sdW1uczogbnRoKCRzaGlmdCwgMSk7XG4gICRwYXJlbnQtY29sdW1uczogY29udGFpbmVyLXNoaWZ0KCRzaGlmdCkgIWdsb2JhbDtcblxuICAkZGlyZWN0aW9uOiBnZXQtZGlyZWN0aW9uKCRsYXlvdXQtZGlyZWN0aW9uLCAkZGVmYXVsdC1sYXlvdXQtZGlyZWN0aW9uKTtcbiAgJG9wcG9zaXRlLWRpcmVjdGlvbjogZ2V0LW9wcG9zaXRlLWRpcmVjdGlvbigkZGlyZWN0aW9uKTtcblxuICBtYXJnaW4tI3skb3Bwb3NpdGUtZGlyZWN0aW9ufTogJG4tY29sdW1ucyAqIGZsZXgtZ3JpZCgxLCAkcGFyZW50LWNvbHVtbnMpICsgJG4tY29sdW1ucyAqIGZsZXgtZ3V0dGVyKCRwYXJlbnQtY29sdW1ucyk7XG5cbiAgLy8gUmVzZXQgbmVzdGluZyBjb250ZXh0XG4gICRwYXJlbnQtY29sdW1uczogJGdyaWQtY29sdW1ucyAhZ2xvYmFsO1xufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG4vLy8gQWRkcyBwYWRkaW5nIHRvIHRoZSBlbGVtZW50LlxuLy8vXG4vLy8gQHBhcmFtIHtMaXN0fSAkcGFkZGluZyBbZmxleC1ndXR0ZXIoKV1cbi8vLyAgIEEgbGlzdCBvZiBwYWRkaW5nIHZhbHVlKHMpIHRvIHVzZS4gUGFzc2luZyBgZGVmYXVsdGAgaW4gdGhlIGxpc3Qgd2lsbCByZXN1bHQgaW4gdXNpbmcgdGhlIGd1dHRlciB3aWR0aCBhcyBhIHBhZGRpbmcgdmFsdWUuXG4vLy9cbi8vLyBAZXhhbXBsZSBzY3NzIC0gVXNhZ2Vcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgQGluY2x1ZGUgcGFkKDMwcHggLTIwcHggMTBweCBkZWZhdWx0KTtcbi8vLyAgIH1cbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgcGFkZGluZzogMzBweCAtMjBweCAxMHB4IDIuMzU3NjUlO1xuLy8vICAgfVxuXG5AbWl4aW4gcGFkKCRwYWRkaW5nOiBmbGV4LWd1dHRlcigpKSB7XG4gICRwYWRkaW5nLWxpc3Q6IG51bGw7XG4gIEBlYWNoICR2YWx1ZSBpbiAkcGFkZGluZyB7XG4gICAgJHZhbHVlOiBpZigkdmFsdWUgPT0gJ2RlZmF1bHQnLCBmbGV4LWd1dHRlcigpLCAkdmFsdWUpO1xuICAgICRwYWRkaW5nLWxpc3Q6IGpvaW4oJHBhZGRpbmctbGlzdCwgJHZhbHVlKTtcbiAgfVxuICBwYWRkaW5nOiAkcGFkZGluZy1saXN0O1xufVxuIiwiQGNoYXJzZXQgXCJVVEYtOFwiO1xuXG4vLy8gRm9yY2VzIHRoZSBlbGVtZW50IHRvIGZpbGwgaXRzIHBhcmVudCBjb250YWluZXIuXG4vLy9cbi8vLyBAZXhhbXBsZSBzY3NzIC0gVXNhZ2Vcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgQGluY2x1ZGUgZmlsbC1wYXJlbnQ7XG4vLy8gICB9XG4vLy9cbi8vLyBAZXhhbXBsZSBjc3MgLSBDU1MgT3V0cHV0XG4vLy8gICAuZWxlbWVudCB7XG4vLy8gICAgIHdpZHRoOiAxMDAlO1xuLy8vICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuLy8vICAgfVxuXG5AbWl4aW4gZmlsbC1wYXJlbnQoKSB7XG4gIHdpZHRoOiAxMDAlO1xuXG4gIEBpZiAkYm9yZGVyLWJveC1zaXppbmcgPT0gZmFsc2Uge1xuICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gIH1cbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIE91dHB1dHMgYSBtZWRpYS1xdWVyeSBibG9jayB3aXRoIGFuIG9wdGlvbmFsIGdyaWQgY29udGV4dCAodGhlIHRvdGFsIG51bWJlciBvZiBjb2x1bW5zIHVzZWQgaW4gdGhlIGdyaWQpLlxuLy8vXG4vLy8gQHBhcmFtIHtMaXN0fSAkcXVlcnlcbi8vLyAgIEEgbGlzdCBvZiBtZWRpYSBxdWVyeSBmZWF0dXJlcyBhbmQgdmFsdWVzLCB3aGVyZSBlYWNoIGAkZmVhdHVyZWAgc2hvdWxkIGhhdmUgYSBjb3JyZXNwb25kaW5nIGAkdmFsdWVgLlxuLy8vICAgRm9yIGEgbGlzdCBvZiB2YWxpZCB2YWx1ZXMgZm9yIGAkZmVhdHVyZWAsIGNsaWNrIFtoZXJlXShodHRwOi8vd3d3LnczLm9yZy9UUi9jc3MzLW1lZGlhcXVlcmllcy8jbWVkaWExKS5cbi8vL1xuLy8vICAgSWYgdGhlcmUgaXMgb25seSBhIHNpbmdsZSBgJHZhbHVlYCBpbiBgJHF1ZXJ5YCwgYCRkZWZhdWx0LWZlYXR1cmVgIGlzIGdvaW5nIHRvIGJlIHVzZWQuXG4vLy9cbi8vLyAgIFRoZSBudW1iZXIgb2YgdG90YWwgY29sdW1ucyBpbiB0aGUgZ3JpZCBjYW4gYmUgc2V0IGJ5IHBhc3NpbmcgYCRjb2x1bW5zYCBhdCB0aGUgZW5kIG9mIHRoZSBsaXN0IChvdmVycmlkZXMgYCR0b3RhbC1jb2x1bW5zYCkuXG4vLy9cbi8vL1xuLy8vIEBwYXJhbSB7TnVtYmVyICh1bml0bGVzcyl9ICR0b3RhbC1jb2x1bW5zIFskZ3JpZC1jb2x1bW5zXVxuLy8vICAgLSBOdW1iZXIgb2YgY29sdW1ucyB0byB1c2UgaW4gdGhlIG5ldyBncmlkIGNvbnRleHQuIENhbiBiZSBzZXQgYXMgYSBzaG9ydGhhbmQgaW4gdGhlIGZpcnN0IHBhcmFtZXRlci5cbi8vL1xuLy8vIEBleGFtcGxlIHNjc3MgLSBVc2FnZVxuLy8vICAgLnJlc3BvbnNpdmUtZWxlbWVudCB7XG4vLy8gICAgICBAaW5jbHVkZSBtZWRpYSg3NjlweCkge1xuLy8vICAgICAgICBAaW5jbHVkZSBzcGFuLWNvbHVtbnMoNik7XG4vLy8gICAgICB9XG4vLy8gICB9XG4vLy9cbi8vLyAgLm5ldy1jb250ZXh0LWVsZW1lbnQge1xuLy8vICAgIEBpbmNsdWRlIG1lZGlhKG1pbi13aWR0aCAzMjBweCBtYXgtd2lkdGggNDgwcHgsIDYpIHtcbi8vLyAgICAgIEBpbmNsdWRlIHNwYW4tY29sdW1ucyg2KTtcbi8vLyAgICB9XG4vLy8gIH1cbi8vL1xuLy8vIEBleGFtcGxlIGNzcyAtIENTUyBPdXRwdXRcbi8vLyAgQG1lZGlhIHNjcmVlbiBhbmQgKG1pbi13aWR0aDogNzY5cHgpIHtcbi8vLyAgICAucmVzcG9uc2l2ZS1lbGVtZW50IHtcbi8vLyAgICAgIGRpc3BsYXk6IGJsb2NrO1xuLy8vICAgICAgZmxvYXQ6IGxlZnQ7XG4vLy8gICAgICBtYXJnaW4tcmlnaHQ6IDIuMzU3NjUlO1xuLy8vICAgICAgd2lkdGg6IDQ4LjgyMTE3JTtcbi8vLyAgICB9XG4vLy9cbi8vLyAgICAucmVzcG9uc2l2ZS1lbGVtZW50Omxhc3QtY2hpbGQge1xuLy8vICAgICAgbWFyZ2luLXJpZ2h0OiAwO1xuLy8vICAgIH1cbi8vLyAgfVxuLy8vXG4vLy8gIEBtZWRpYSBzY3JlZW4gYW5kIChtaW4td2lkdGg6IDMyMHB4KSBhbmQgKG1heC13aWR0aDogNDgwcHgpIHtcbi8vLyAgICAubmV3LWNvbnRleHQtZWxlbWVudCB7XG4vLy8gICAgICBkaXNwbGF5OiBibG9jaztcbi8vLyAgICAgIGZsb2F0OiBsZWZ0O1xuLy8vICAgICAgbWFyZ2luLXJpZ2h0OiA0LjgyOTE2JTtcbi8vLyAgICAgIHdpZHRoOiAxMDAlO1xuLy8vICAgIH1cbi8vL1xuLy8vICAgIC5uZXctY29udGV4dC1lbGVtZW50Omxhc3QtY2hpbGQge1xuLy8vICAgICAgbWFyZ2luLXJpZ2h0OiAwO1xuLy8vICAgIH1cbi8vLyAgfVxuXG5AbWl4aW4gbWVkaWEoJHF1ZXJ5OiAkZmVhdHVyZSAkdmFsdWUgJGNvbHVtbnMsICR0b3RhbC1jb2x1bW5zOiAkZ3JpZC1jb2x1bW5zKSB7XG4gIEBpZiBsZW5ndGgoJHF1ZXJ5KSA9PSAxIHtcbiAgICBAbWVkaWEgc2NyZWVuIGFuZCAoJGRlZmF1bHQtZmVhdHVyZTogbnRoKCRxdWVyeSwgMSkpIHtcbiAgICAgICRkZWZhdWx0LWdyaWQtY29sdW1uczogJGdyaWQtY29sdW1ucztcbiAgICAgICRncmlkLWNvbHVtbnM6ICR0b3RhbC1jb2x1bW5zICFnbG9iYWw7XG4gICAgICBAY29udGVudDtcbiAgICAgICRncmlkLWNvbHVtbnM6ICRkZWZhdWx0LWdyaWQtY29sdW1ucyAhZ2xvYmFsO1xuICAgIH1cbiAgfSBAZWxzZSB7XG4gICAgJGxvb3AtdG86IGxlbmd0aCgkcXVlcnkpO1xuICAgICRtZWRpYS1xdWVyeTogXCJzY3JlZW4gYW5kIFwiO1xuICAgICRkZWZhdWx0LWdyaWQtY29sdW1uczogJGdyaWQtY29sdW1ucztcbiAgICAkZ3JpZC1jb2x1bW5zOiAkdG90YWwtY29sdW1ucyAhZ2xvYmFsO1xuXG4gICAgQGlmIGlzLW5vdChpcy1ldmVuKGxlbmd0aCgkcXVlcnkpKSkge1xuICAgICAgJGdyaWQtY29sdW1uczogbnRoKCRxdWVyeSwgJGxvb3AtdG8pICFnbG9iYWw7XG4gICAgICAkbG9vcC10bzogJGxvb3AtdG8gLSAxO1xuICAgIH1cblxuICAgICRpOiAxO1xuICAgIEB3aGlsZSAkaSA8PSAkbG9vcC10byB7XG4gICAgICAkbWVkaWEtcXVlcnk6ICRtZWRpYS1xdWVyeSArIFwiKFwiICsgbnRoKCRxdWVyeSwgJGkpICsgXCI6IFwiICsgbnRoKCRxdWVyeSwgJGkgKyAxKSArIFwiKSBcIjtcblxuICAgICAgQGlmICgkaSArIDEpICE9ICRsb29wLXRvIHtcbiAgICAgICAgJG1lZGlhLXF1ZXJ5OiAkbWVkaWEtcXVlcnkgKyBcImFuZCBcIjtcbiAgICAgIH1cblxuICAgICAgJGk6ICRpICsgMjtcbiAgICB9XG5cbiAgICBAbWVkaWEgI3skbWVkaWEtcXVlcnl9IHtcbiAgICAgIEBjb250ZW50O1xuICAgICAgJGdyaWQtY29sdW1uczogJGRlZmF1bHQtZ3JpZC1jb2x1bW5zICFnbG9iYWw7XG4gICAgfVxuICB9XG59XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbkBtaXhpbiBicmVha3BvaW50KCRxdWVyeTokZmVhdHVyZSAkdmFsdWUgJGNvbHVtbnMsICR0b3RhbC1jb2x1bW5zOiAkZ3JpZC1jb2x1bW5zKSB7XG4gIEBpbmNsdWRlIC1uZWF0LXdhcm4oXCJUaGUgYnJlYWtwb2ludCgpIG1peGluIHdhcyByZW5hbWVkIHRvIG1lZGlhKCkgaW4gTmVhdCAxLjAuIFBsZWFzZSB1cGRhdGUgeW91ciBwcm9qZWN0IHdpdGggdGhlIG5ldyBzeW50YXggYmVmb3JlIHRoZSBuZXh0IHZlcnNpb24gYnVtcC5cIik7XG5cbiAgQGlmIGxlbmd0aCgkcXVlcnkpID09IDEge1xuICAgIEBtZWRpYSBzY3JlZW4gYW5kICgkZGVmYXVsdC1mZWF0dXJlOiBudGgoJHF1ZXJ5LCAxKSkge1xuICAgICAgJGRlZmF1bHQtZ3JpZC1jb2x1bW5zOiAkZ3JpZC1jb2x1bW5zO1xuICAgICAgJGdyaWQtY29sdW1uczogJHRvdGFsLWNvbHVtbnM7XG4gICAgICBAY29udGVudDtcbiAgICAgICRncmlkLWNvbHVtbnM6ICRkZWZhdWx0LWdyaWQtY29sdW1ucztcbiAgICB9XG4gIH0gQGVsc2UgaWYgbGVuZ3RoKCRxdWVyeSkgPT0gMiB7XG4gICAgQG1lZGlhIHNjcmVlbiBhbmQgKG50aCgkcXVlcnksIDEpOiBudGgoJHF1ZXJ5LCAyKSkge1xuICAgICAgJGRlZmF1bHQtZ3JpZC1jb2x1bW5zOiAkZ3JpZC1jb2x1bW5zO1xuICAgICAgJGdyaWQtY29sdW1uczogJHRvdGFsLWNvbHVtbnM7XG4gICAgICBAY29udGVudDtcbiAgICAgICRncmlkLWNvbHVtbnM6ICRkZWZhdWx0LWdyaWQtY29sdW1ucztcbiAgICB9XG4gIH0gQGVsc2UgaWYgbGVuZ3RoKCRxdWVyeSkgPT0gMyB7XG4gICAgQG1lZGlhIHNjcmVlbiBhbmQgKG50aCgkcXVlcnksIDEpOiBudGgoJHF1ZXJ5LCAyKSkge1xuICAgICAgJGRlZmF1bHQtZ3JpZC1jb2x1bW5zOiAkZ3JpZC1jb2x1bW5zO1xuICAgICAgJGdyaWQtY29sdW1uczogbnRoKCRxdWVyeSwgMyk7XG4gICAgICBAY29udGVudDtcbiAgICAgICRncmlkLWNvbHVtbnM6ICRkZWZhdWx0LWdyaWQtY29sdW1ucztcbiAgICB9XG4gIH0gQGVsc2UgaWYgbGVuZ3RoKCRxdWVyeSkgPT0gNCB7XG4gICAgQG1lZGlhIHNjcmVlbiBhbmQgKG50aCgkcXVlcnksIDEpOiBudGgoJHF1ZXJ5LCAyKSkgYW5kIChudGgoJHF1ZXJ5LCAzKTogbnRoKCRxdWVyeSwgNCkpIHtcbiAgICAgICRkZWZhdWx0LWdyaWQtY29sdW1uczogJGdyaWQtY29sdW1ucztcbiAgICAgICRncmlkLWNvbHVtbnM6ICR0b3RhbC1jb2x1bW5zO1xuICAgICAgQGNvbnRlbnQ7XG4gICAgICAkZ3JpZC1jb2x1bW5zOiAkZGVmYXVsdC1ncmlkLWNvbHVtbnM7XG4gICAgfVxuICB9IEBlbHNlIGlmIGxlbmd0aCgkcXVlcnkpID09IDUge1xuICAgIEBtZWRpYSBzY3JlZW4gYW5kIChudGgoJHF1ZXJ5LCAxKTogbnRoKCRxdWVyeSwgMikpIGFuZCAobnRoKCRxdWVyeSwgMyk6IG50aCgkcXVlcnksIDQpKSB7XG4gICAgICAkZGVmYXVsdC1ncmlkLWNvbHVtbnM6ICRncmlkLWNvbHVtbnM7XG4gICAgICAkZ3JpZC1jb2x1bW5zOiBudGgoJHF1ZXJ5LCA1KTtcbiAgICAgIEBjb250ZW50O1xuICAgICAgJGdyaWQtY29sdW1uczogJGRlZmF1bHQtZ3JpZC1jb2x1bW5zO1xuICAgIH1cbiAgfSBAZWxzZSB7XG4gICAgQGluY2x1ZGUgLW5lYXQtd2FybihcIldyb25nIG51bWJlciBvZiBhcmd1bWVudHMgZm9yIGJyZWFrcG9pbnQoKS4gUmVhZCB0aGUgZG9jdW1lbnRhdGlvbiBmb3IgbW9yZSBkZXRhaWxzLlwiKTtcbiAgfVxufVxuXG5AbWl4aW4gbnRoLW9tZWdhKCRudGgsICRkaXNwbGF5OiBibG9jaywgJGRpcmVjdGlvbjogZGVmYXVsdCkge1xuICBAaW5jbHVkZSAtbmVhdC13YXJuKFwiVGhlIG50aC1vbWVnYSgpIG1peGluIGlzIGRlcHJlY2F0ZWQuIFBsZWFzZSB1c2Ugb21lZ2EoKSBpbnN0ZWFkLlwiKTtcbiAgQGluY2x1ZGUgb21lZ2EoJG50aCAkZGlzcGxheSwgJGRpcmVjdGlvbik7XG59XG5cbi8vLyBSZXNldHMgdGhlIGFjdGl2ZSBkaXNwbGF5IHByb3BlcnR5IHRvIGBibG9ja2AuIFBhcnRpY3VsYXJseSB1c2VmdWwgd2hlbiBjaGFuZ2luZyB0aGUgZGlzcGxheSBwcm9wZXJ0eSBpbiBhIHNpbmdsZSByb3cuXG4vLy9cbi8vLyBAZXhhbXBsZSBzY3NzIC0gVXNhZ2Vcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgQGluY2x1ZGUgcm93KHRhYmxlKTtcbi8vLyAgICAgLy8gQ29udGV4dCBjaGFuZ2VkIHRvIHRhYmxlIGRpc3BsYXlcbi8vLyAgIH1cbi8vL1xuLy8vICAgQGluY2x1ZGUgcmVzZXQtZGlzcGxheTtcbi8vLyAgIC8vIENvbnRleHQgaXMgcmVzZXQgdG8gYmxvY2sgZGlzcGxheVxuXG5AbWl4aW4gcmVzZXQtZGlzcGxheSB7XG4gICRjb250YWluZXItZGlzcGxheS10YWJsZTogZmFsc2UgIWdsb2JhbDtcbiAgQGluY2x1ZGUgLW5lYXQtd2FybihcIlJlc2V0dGluZyAkZGlzcGxheSB3aWxsIGJlIGRlcHJlY2F0ZWQgaW4gZnV0dXJlIHZlcnNpb25zIGluIGZhdm9yIG9mIHRoZSBkaXNwbGF5KCl7Li4ufSBtaXhpbi5cIik7XG59XG5cbi8vLyBSZXNldHMgdGhlIGFjdGl2ZSBsYXlvdXQgZGlyZWN0aW9uIHRvIHRoZSBkZWZhdWx0IHZhbHVlIHNldCBpbiBgJGRlZmF1bHQtbGF5b3V0LWRpcmVjdGlvbmAuIFBhcnRpY3VsYXJseSB1c2VmdWwgd2hlbiBjaGFuZ2luZyB0aGUgbGF5b3V0IGRpcmVjdGlvbiBpbiBhIHNpbmdsZSByb3cuXG4vLy9cbi8vLyBAZXhhbXBsZSBzY3NzIC0gVXNhZ2Vcbi8vLyAgIC5lbGVtZW50IHtcbi8vLyAgICAgQGluY2x1ZGUgcm93KCRkaXJlY3Rpb246IFJUTCk7XG4vLy8gICAgIC8vIENvbnRleHQgY2hhbmdlZCB0byByaWdodC10by1sZWZ0XG4vLy8gICB9XG4vLy9cbi8vLyAgIEBpbmNsdWRlIHJlc2V0LWxheW91dC1kaXJlY3Rpb247XG4vLy8gICAvLyBDb250ZXh0IGlzIHJlc2V0IHRvIGxlZnQtdG8tcmlnaHRcblxuQG1peGluIHJlc2V0LWxheW91dC1kaXJlY3Rpb24ge1xuICAkbGF5b3V0LWRpcmVjdGlvbjogJGRlZmF1bHQtbGF5b3V0LWRpcmVjdGlvbiAhZ2xvYmFsO1xuICBAaW5jbHVkZSAtbmVhdC13YXJuKFwiUmVzZXR0aW5nICRkaXJlY3Rpb24gd2lsbCBiZSBkZXByZWNhdGVkIGluIGZ1dHVyZSB2ZXJzaW9ucyBpbiBmYXZvciBvZiB0aGUgZGlyZWN0aW9uKCl7Li4ufSBtaXhpbi5cIik7XG59XG5cbi8vLyBSZXNldHMgYm90aCB0aGUgYWN0aXZlIGxheW91dCBkaXJlY3Rpb24gYW5kIHRoZSBhY3RpdmUgZGlzcGxheSBwcm9wZXJ0eS5cbi8vL1xuLy8vIEBleGFtcGxlIHNjc3MgLSBVc2FnZVxuLy8vICAgLmVsZW1lbnQge1xuLy8vICAgICBAaW5jbHVkZSByb3codGFibGUsIFJUTCk7XG4vLy8gICAgIC8vIENvbnRleHQgY2hhbmdlZCB0byB0YWJsZSB0YWJsZSBhbmQgcmlnaHQtdG8tbGVmdFxuLy8vICAgfVxuLy8vXG4vLy8gICBAaW5jbHVkZSByZXNldC1hbGw7XG4vLy8gICAvLyBDb250ZXh0IGlzIHJlc2V0IHRvIGJsb2NrIGRpc3BsYXkgYW5kIGxlZnQtdG8tcmlnaHRcblxuQG1peGluIHJlc2V0LWFsbCB7XG4gIEBpbmNsdWRlIHJlc2V0LWRpc3BsYXk7XG4gIEBpbmNsdWRlIHJlc2V0LWxheW91dC1kaXJlY3Rpb247XG59XG4iLCJAY2hhcnNldCBcIlVURi04XCI7XG5cbkBtaXhpbiBncmlkLWNvbHVtbi1ncmFkaWVudCgkdmFsdWVzLi4uKSB7XG4gIGJhY2tncm91bmQtaW1hZ2U6IC13ZWJraXQtbGluZWFyLWdyYWRpZW50KGxlZnQsICR2YWx1ZXMpO1xuICBiYWNrZ3JvdW5kLWltYWdlOiAtbW96LWxpbmVhci1ncmFkaWVudChsZWZ0LCAkdmFsdWVzKTtcbiAgYmFja2dyb3VuZC1pbWFnZTogLW1zLWxpbmVhci1ncmFkaWVudChsZWZ0LCAkdmFsdWVzKTtcbiAgYmFja2dyb3VuZC1pbWFnZTogLW8tbGluZWFyLWdyYWRpZW50KGxlZnQsICR2YWx1ZXMpO1xuICBiYWNrZ3JvdW5kLWltYWdlOiB1bnF1b3RlKFwibGluZWFyLWdyYWRpZW50KHRvIGxlZnQsICN7JHZhbHVlc30pXCIpO1xufVxuXG5AaWYgJHZpc3VhbC1ncmlkID09IHRydWUgb3IgJHZpc3VhbC1ncmlkID09IHllcyB7XG4gIGJvZHk6YmVmb3JlIHtcbiAgICBAaW5jbHVkZSBncmlkLWNvbHVtbi1ncmFkaWVudChncmFkaWVudC1zdG9wcygkZ3JpZC1jb2x1bW5zKSk7XG4gICAgY29udGVudDogXCJcIjtcbiAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG4gICAgaGVpZ2h0OiAxMDAlO1xuICAgIGxlZnQ6IDA7XG4gICAgbWFyZ2luOiAwIGF1dG87XG4gICAgbWF4LXdpZHRoOiAkbWF4LXdpZHRoO1xuICAgIG9wYWNpdHk6ICR2aXN1YWwtZ3JpZC1vcGFjaXR5O1xuICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICByaWdodDogMDtcbiAgICB3aWR0aDogMTAwJTtcblxuICAgIEBpZiAkdmlzdWFsLWdyaWQtaW5kZXggPT0gYmFjayB7XG4gICAgICB6LWluZGV4OiAtMTtcbiAgICB9XG5cbiAgICBAZWxzZSBpZiAkdmlzdWFsLWdyaWQtaW5kZXggPT0gZnJvbnQge1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICB9XG5cbiAgICBAZWFjaCAkYnJlYWtwb2ludCBpbiAkdmlzdWFsLWdyaWQtYnJlYWtwb2ludHMge1xuICAgICAgQGlmICRicmVha3BvaW50IHtcbiAgICAgICAgQGluY2x1ZGUgbWVkaWEoJGJyZWFrcG9pbnQpIHtcbiAgICAgICAgICBAaW5jbHVkZSBncmlkLWNvbHVtbi1ncmFkaWVudChncmFkaWVudC1zdG9wcygkZ3JpZC1jb2x1bW5zKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIENoYW5nZXMgdGhlIGRpc3BsYXkgcHJvcGVydHkgdXNlZCBieSBvdGhlciBtaXhpbnMgY2FsbGVkIGluIHRoZSBjb2RlIGJsb2NrIGFyZ3VtZW50LlxuLy8vXG4vLy8gQHBhcmFtIHtTdHJpbmd9ICRkaXNwbGF5IFtibG9ja11cbi8vLyAgIERpc3BsYXkgdmFsdWUgdG8gYmUgdXNlZCB3aXRoaW4gdGhlIGJsb2NrLiBDYW4gYmUgYHRhYmxlYCBvciBgYmxvY2tgLlxuLy8vXG4vLy8gQGV4YW1wbGUgc2Nzc1xuLy8vICAgQGluY2x1ZGUgZGlzcGxheS1jb250ZXh0KHRhYmxlKSB7XG4vLy8gICAgLmRpc3BsYXktdGFibGUge1xuLy8vICAgICAgQGluY2x1ZGUgc3Bhbi1jb2x1bW5zKDYpO1xuLy8vICAgICB9XG4vLy8gICB9XG4vLy9cbi8vLyBAZXhhbXBsZSBjc3Ncbi8vLyAgIC5kaXNwbGF5LXRhYmxlIHtcbi8vLyAgICAgIGRpc3BsYXk6IHRhYmxlLWNlbGw7XG4vLy8gICAgICAuLi5cbi8vLyAgIH1cblxuQG1peGluIGRpc3BsYXktY29udGV4dCgkZGlzcGxheTogYmxvY2spIHtcbiAgJHNjb3BlLWRpc3BsYXk6ICRjb250YWluZXItZGlzcGxheS10YWJsZTtcbiAgJGNvbnRhaW5lci1kaXNwbGF5LXRhYmxlOiAkZGlzcGxheSA9PSB0YWJsZSAhZ2xvYmFsO1xuXG4gIEBjb250ZW50O1xuXG4gICRjb250YWluZXItZGlzcGxheS10YWJsZTogJHNjb3BlLWRpc3BsYXkgIWdsb2JhbDtcbn1cbiIsIkBjaGFyc2V0IFwiVVRGLThcIjtcblxuLy8vIENoYW5nZXMgdGhlIGRpcmVjdGlvbiBwcm9wZXJ0eSB1c2VkIGJ5IG90aGVyIG1peGlucyBjYWxsZWQgaW4gdGhlIGNvZGUgYmxvY2sgYXJndW1lbnQuXG4vLy9cbi8vLyBAcGFyYW0ge1N0cmluZ30gJGRpcmVjdGlvbiBbbGVmdC10by1yaWdodF1cbi8vLyAgIExheW91dCBkaXJlY3Rpb24gdG8gYmUgdXNlZCB3aXRoaW4gdGhlIGJsb2NrLiBDYW4gYmUgYGxlZnQtdG8tcmlnaHRgIG9yIGByaWdodC10by1sZWZ0YC5cbi8vL1xuLy8vIEBleGFtcGxlIHNjc3MgLSBVc2FnZVxuLy8vICAgQGluY2x1ZGUgZGlyZWN0aW9uLWNvbnRleHQocmlnaHQtdG8tbGVmdCkge1xuLy8vICAgIC5yaWdodC10by1sZWZ0LWJsb2NrIHtcbi8vLyAgICAgIEBpbmNsdWRlIHNwYW4tY29sdW1ucyg2KTtcbi8vLyAgICAgfVxuLy8vICAgfVxuLy8vXG4vLy8gQGV4YW1wbGUgY3NzIC0gQ1NTIE91dHB1dFxuLy8vICAgLnJpZ2h0LXRvLWxlZnQtYmxvY2sge1xuLy8vICAgICBmbG9hdDogcmlnaHQ7XG4vLy8gICAgICAuLi5cbi8vLyAgIH1cblxuQG1peGluIGRpcmVjdGlvbi1jb250ZXh0KCRkaXJlY3Rpb246IGxlZnQtdG8tcmlnaHQpIHtcbiAgJHNjb3BlLWRpcmVjdGlvbjogJGxheW91dC1kaXJlY3Rpb247XG5cbiAgQGlmIHRvLWxvd2VyLWNhc2UoJGRpcmVjdGlvbikgPT0gXCJsZWZ0LXRvLXJpZ2h0XCIge1xuICAgICRsYXlvdXQtZGlyZWN0aW9uOiBMVFIgIWdsb2JhbDtcbiAgfSBAZWxzZSBpZiB0by1sb3dlci1jYXNlKCRkaXJlY3Rpb24pID09IFwicmlnaHQtdG8tbGVmdFwiIHtcbiAgICAkbGF5b3V0LWRpcmVjdGlvbjogUlRMICFnbG9iYWw7XG4gIH1cblxuICBAY29udGVudDtcblxuICAkbGF5b3V0LWRpcmVjdGlvbjogJHNjb3BlLWRpcmVjdGlvbiAhZ2xvYmFsO1xufVxuIiwiJGJyZWFrcG9pbnRfMSA6ICc2MDBweCc7XG4kYnJlYWtwb2ludF8yIDogJzgwMHB4JztcblxuLy8gRm9udCBTaXplc1xuJGJhc2UtZm9udC1zaXplOiAxNHB4O1xuJGJhc2UtZm9udC1mYW1pbHk6ICdzYW5zLXNlcmlmJztcbiRoMS1mb250LXNpemU6ICRiYXNlLWZvbnQtc2l6ZSAqIDI7XG4kaDItZm9udC1zaXplOiAkYmFzZS1mb250LXNpemUgKiAxLjc1O1xuJGgzLWZvbnQtc2l6ZTogJGJhc2UtZm9udC1zaXplICogMS41O1xuJGg0LWZvbnQtc2l6ZTogJGJhc2UtZm9udC1zaXplICogMS4yNTtcbiRoNS1mb250LXNpemU6ICRiYXNlLWZvbnQtc2l6ZSAqIDEuMTI1O1xuJGg2LWZvbnQtc2l6ZTogJGJhc2UtZm9udC1zaXplO1xuXG4vLyBMaW5lIGhlaWdodFxuJGJhc2UtbGluZS1oZWlnaHQ6IDEuNTtcbiRoZWFkZXItbGluZS1oZWlnaHQ6IDEuMjU7XG5cbi8vIE90aGVyIFNpemVzXG4kYmFzZS1ib3JkZXItcmFkaXVzOiAzcHg7XG4kYmFzZS1zcGFjaW5nOiAkYmFzZS1saW5lLWhlaWdodCAqIDFlbTtcbiRiYXNlLXotaW5kZXg6IDA7XG4kc21hbGwtc3BhY2luZzogJGJhc2Utc3BhY2luZy8yO1xuXG4vLyBDb2xvcnNcbiRibHVlOiAjNDc3ZGNhO1xuJGRhcmstZ3JheTogIzMzMztcbiRtZWRpdW0tZ3JheTogIzk5OTtcbiRzdXBlci1saWdodC1ncmF5OiBcdCNGNUY1RjU7XG4kbGlnaHQtZ3JheTogI0RERDtcbiRsaWdodC1yZWQ6ICNGQkUzRTQ7XG4kbGlnaHQteWVsbG93OiAjRkZGNkJGO1xuJGxpZ2h0LWdyZWVuOiAjRTZFRkMyO1xuXG4vLyBCYWNrZ3JvdW5kIENvbG9yXG4kYmFzZS1iYWNrZ3JvdW5kLWNvbG9yOiB3aGl0ZTtcbiRzZWNvbmRhcnktYmFja2dyb3VuZC1jb2xvcjogJHN1cGVyLWxpZ2h0LWdyYXk7XG4vLyBGb250IENvbG9yc1xuJGJhc2UtZm9udC1jb2xvcjogJGRhcmstZ3JheTtcbiRiYXNlLWFjY2VudC1jb2xvcjogJGJsdWU7XG5cblxuLy8gTGluayBDb2xvcnNcbiRiYXNlLWxpbmstY29sb3I6ICRiYXNlLWFjY2VudC1jb2xvcjtcbiRob3Zlci1saW5rLWNvbG9yOiBkYXJrZW4oJGJhc2UtYWNjZW50LWNvbG9yLCAxNSk7XG4kYmFzZS1idXR0b24tY29sb3I6ICRiYXNlLWxpbmstY29sb3I7XG4kaG92ZXItYnV0dG9uLWNvbG9yOiAkaG92ZXItbGluay1jb2xvcjtcblxuLy8gRmxhc2ggQ29sb3JzXG4kYWxlcnQtY29sb3I6ICRsaWdodC15ZWxsb3c7XG4kZXJyb3ItY29sb3I6ICRsaWdodC1yZWQ7XG4kbm90aWNlLWNvbG9yOiBsaWdodGVuKCRiYXNlLWFjY2VudC1jb2xvciwgNDApO1xuJHN1Y2Nlc3MtY29sb3I6ICRsaWdodC1ncmVlbjtcblxuLy8gQm9yZGVyIGNvbG9yXG4kYmFzZS1ib3JkZXItY29sb3I6ICRsaWdodC1ncmF5O1xuJGJhc2UtYm9yZGVyOiAxcHggc29saWQgJGJhc2UtYm9yZGVyLWNvbG9yO1xuXG4vLyBGb3Jtc1xuJGZvcm0tYm9yZGVyLWNvbG9yOiAkYmFzZS1ib3JkZXItY29sb3I7XG4kZm9ybS1ib3JkZXItY29sb3ItaG92ZXI6IGRhcmtlbigkYmFzZS1ib3JkZXItY29sb3IsIDEwKTtcbiRmb3JtLWJvcmRlci1jb2xvci1mb2N1czogJGJhc2UtYWNjZW50LWNvbG9yO1xuJGZvcm0tYm9yZGVyLXJhZGl1czogJGJhc2UtYm9yZGVyLXJhZGl1cztcbiRmb3JtLWJveC1zaGFkb3c6IGluc2V0IDAgMXB4IDNweCByZ2JhKGJsYWNrLDAuMDYpO1xuJGZvcm0tYm94LXNoYWRvdy1mb2N1czogJGZvcm0tYm94LXNoYWRvdywgMCAwIDVweCByZ2JhKGRhcmtlbigkZm9ybS1ib3JkZXItY29sb3ItZm9jdXMsIDUpLCAwLjcpO1xuJGZvcm0tZm9udC1zaXplOiAkYmFzZS1mb250LXNpemU7XG5cbi8vIEFuaW1hdGlvblxuXG4kYmFzZS1kdXJhdGlvbjogMC4ycztcbiRiYXNlLXRpbWluZzogZWFzZS1pbjtcbiIsIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKlxcXG4gICAgJFRBQkxFU1xuXFwqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbi8qKlxuICogV2UgaGF2ZSBhIGxvdCBhdCBvdXIgZGlzcG9zYWwgZm9yIG1ha2luZyB2ZXJ5IGNvbXBsZXggdGFibGUgY29uc3RydWN0cywgZS5nLjpcbiAqXG4gICA8dGFibGUgY2xhc3M9XCJ0YWJsZS0tYm9yZGVyZWQgIHRhYmxlLS1zdHJpcGVkICB0YWJsZS0tZGF0YVwiPlxuICAgICAgIDxjb2xncm91cD5cbiAgICAgICAgICAgPGNvbCBjbGFzcz10MTA+XG4gICAgICAgICAgIDxjb2wgY2xhc3M9dDEwPlxuICAgICAgICAgICA8Y29sIGNsYXNzPXQxMD5cbiAgICAgICAgICAgPGNvbD5cbiAgICAgICA8L2NvbGdyb3VwPlxuICAgICAgIDx0aGVhZD5cbiAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgPHRoIGNvbHNwYW49Mz5Gb288L3RoPlxuICAgICAgICAgICAgICAgPHRoPkJhcjwvdGg+XG4gICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgIDx0aD5Mb3JlbTwvdGg+XG4gICAgICAgICAgICAgICA8dGg+SXBzdW08L3RoPlxuICAgICAgICAgICAgICAgPHRoIGNsYXNzPW51bWVyaWNhbD5Eb2xvcjwvdGg+XG4gICAgICAgICAgICAgICA8dGg+U2l0PC90aD5cbiAgICAgICAgICAgPC90cj5cbiAgICAgICA8L3RoZWFkPlxuICAgICAgIDx0Ym9keT5cbiAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgPHRoIHJvd3NwYW49Mz5TaXQ8L3RoPlxuICAgICAgICAgICAgICAgPHRkPkRvbG9yPC90ZD5cbiAgICAgICAgICAgICAgIDx0ZCBjbGFzcz1udW1lcmljYWw+MDMuNzg4PC90ZD5cbiAgICAgICAgICAgICAgIDx0ZD5Mb3JlbTwvdGQ+XG4gICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgIDx0ZD5Eb2xvcjwvdGQ+XG4gICAgICAgICAgICAgICA8dGQgY2xhc3M9bnVtZXJpY2FsPjMyLjIxMDwvdGQ+XG4gICAgICAgICAgICAgICA8dGQ+TG9yZW08L3RkPlxuICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICA8dGQ+RG9sb3I8L3RkPlxuICAgICAgICAgICAgICAgPHRkIGNsYXNzPW51bWVyaWNhbD40Ny43OTc8L3RkPlxuICAgICAgICAgICAgICAgPHRkPkxvcmVtPC90ZD5cbiAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgPHRoIHJvd3NwYW49Mj5TaXQ8L3RoPlxuICAgICAgICAgICAgICAgPHRkPkRvbG9yPC90ZD5cbiAgICAgICAgICAgICAgIDx0ZCBjbGFzcz1udW1lcmljYWw+MDkuNjQwPC90ZD5cbiAgICAgICAgICAgICAgIDx0ZD5Mb3JlbTwvdGQ+XG4gICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgIDx0ZD5Eb2xvcjwvdGQ+XG4gICAgICAgICAgICAgICA8dGQgY2xhc3M9bnVtZXJpY2FsPjEyLjExNzwvdGQ+XG4gICAgICAgICAgICAgICA8dGQ+TG9yZW08L3RkPlxuICAgICAgICAgICA8L3RyPlxuICAgICAgIDwvdGJvZHk+XG4gICA8L3RhYmxlPlxuICpcbiAqL1xudGFibGV7XG4gIHdpZHRoOjEwMCU7XG4gIFtjb250ZW50ZWRpdGFibGU9XCJ0cnVlXCJdOmFjdGl2ZSxcbiAgW2NvbnRlbnRlZGl0YWJsZT1cInRydWVcIl06Zm9jdXN7XG4gICAgYm9yZGVyOm5vbmU7XG4gICAgb3V0bGluZTpub25lO1xuICAgIGJhY2tncm91bmQ6ICRzdXBlci1saWdodC1ncmF5O1xuICB9XG59XG50aCxcbnRke1xuICBwYWRkaW5nOiRiYXNlLXNwYWNpbmcgLyA0O1xuICBAbWVkaWEgc2NyZWVuIGFuZCAobWluLXdpZHRoOjQ4MHB4KXtcbiAgICBwYWRkaW5nOiRiYXNlLXNwYWNpbmcvMjtcbiAgfVxuICB0ZXh0LWFsaWduOmxlZnQ7XG59XG5cblxuLyoqXG4gKiBDZWxsIGFsaWdubWVudHNcbiAqL1xuW2NvbHNwYW5de1xuICB0ZXh0LWFsaWduOmNlbnRlcjtcbn1cbltjb2xzcGFuPVwiMVwiXXtcbiAgdGV4dC1hbGlnbjpsZWZ0O1xufVxuW3Jvd3NwYW5de1xuICB2ZXJ0aWNhbC1hbGlnbjptaWRkbGU7XG59XG5bcm93c3Bhbj1cIjFcIl17XG4gIHZlcnRpY2FsLWFsaWduOnRvcDtcbn1cbi5udW1lcmljYWx7XG4gIHRleHQtYWxpZ246cmlnaHQ7XG59XG5cbi8qKlxuICogSW4gdGhlIEhUTUwgYWJvdmUgd2Ugc2VlIHNldmVyYWwgYGNvbGAgZWxlbWVudHMgd2l0aCBjbGFzc2VzIHdob3NlIG51bWJlcnNcbiAqIHJlcHJlc2VudCBhIHBlcmNlbnRhZ2Ugd2lkdGggZm9yIHRoYXQgY29sdW1uLiBXZSBsZWF2ZSBvbmUgY29sdW1uIGZyZWUgb2YgYVxuICogY2xhc3Mgc28gdGhhdCBjb2x1bW4gY2FuIHNvYWsgdXAgdGhlIGVmZmVjdHMgb2YgYW55IGFjY2lkZW50YWwgYnJlYWthZ2UgaW5cbiAqIHRoZSB0YWJsZS5cbiAqL1xuLnQ1ICAgICB7IHdpZHRoOiA1JSB9XG4udDEwICAgIHsgd2lkdGg6MTAlIH1cbi50MTIgICAgeyB3aWR0aDoxMi41JSB9ICAgICAvKiAxLzggKi9cbi50MTUgICAgeyB3aWR0aDoxNSUgfVxuLnQyMCAgICB7IHdpZHRoOjIwJSB9XG4udDI1ICAgIHsgd2lkdGg6MjUlIH0gICAgICAgLyogMS80ICovXG4udDMwICAgIHsgd2lkdGg6MzAlIH1cbi50MzMgICAgeyB3aWR0aDozMy4zMzMlIH0gICAvKiAxLzMgKi9cbi50MzUgICAgeyB3aWR0aDozNSUgfVxuLnQzNyAgICB7IHdpZHRoOjM3LjUlIH0gICAgIC8qIDMvOCAqL1xuLnQ0MCAgICB7IHdpZHRoOjQwJSB9XG4udDQ1ICAgIHsgd2lkdGg6NDUlIH1cbi50NTAgICAgeyB3aWR0aDo1MCUgfSAgICAgICAvKiAxLzIgKi9cbi50NTUgICAgeyB3aWR0aDo1NSUgfVxuLnQ2MCAgICB7IHdpZHRoOjYwJSB9XG4udDYyICAgIHsgd2lkdGg6NjIuNSUgfSAgICAgLyogNS84ICovXG4udDY1ICAgIHsgd2lkdGg6NjUlIH1cbi50NjYgICAgeyB3aWR0aDo2Ni42NjYlIH0gICAvKiAyLzMgKi9cbi50NzAgICAgeyB3aWR0aDo3MCUgfVxuLnQ3NSAgICB7IHdpZHRoOjc1JSB9ICAgICAgIC8qIDMvNCovXG4udDgwICAgIHsgd2lkdGg6ODAlIH1cbi50ODUgICAgeyB3aWR0aDo4NSUgfVxuLnQ4NyAgICB7IHdpZHRoOjg3LjUlIH0gICAgIC8qIDcvOCAqL1xuLnQ5MCAgICB7IHdpZHRoOjkwJSB9XG4udDk1ICAgIHsgd2lkdGg6OTUlIH1cblxuXG4vKipcbiAqIEJvcmRlcmVkIHRhYmxlc1xuICovXG4udGFibGUtLWJvcmRlcmVke1xuICBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlO1xuXG4gIHRye1xuICAgIGJvcmRlcjoxcHggc29saWQgJGJhc2UtYm9yZGVyLWNvbG9yO1xuICB9XG4gIHRoLFxuICB0ZHtcbiAgICBib3JkZXItcmlnaHQ6IDFweCBzb2xpZCAkYmFzZS1ib3JkZXItY29sb3I7XG4gIH1cblxuICB0aGVhZCB0cjpsYXN0LWNoaWxkIHRoe1xuICAgIGJvcmRlci1ib3R0b20td2lkdGg6MnB4O1xuICB9XG5cbiAgdGJvZHkgdHIgdGg6bGFzdC1vZi10eXBle1xuICAgIGJvcmRlci1yaWdodC13aWR0aDoycHg7XG4gIH1cbn1cblxuXG4vKipcbiAqIFN0cmlwZWQgdGFibGVzXG4gKi9cbi50YWJsZS0tc3RyaXBlZHtcblxuICB0Ym9keSB0cjpudGgtb2YtdHlwZShvZGQpe1xuICAgIGJhY2tncm91bmQtY29sb3I6I2ZmYzsgLyogT3ZlcnJpZGUgdGhpcyBjb2xvciBpbiB5b3VyIHRoZW1lIHN0eWxlc2hlZXQgKi9cbiAgfVxufVxuXG5cbi8qKlxuICogRGF0YSB0YWJsZVxuICovXG4udGFibGUtLWRhdGF7XG4gIGZvbnQ6MTJweC8xLjUgc2Fucy1zZXJpZjtcbn1cbi50YWJsZS0tZGlzYWJsZWR7XG4gIGNvbG9yOiAjNzc3O1xuICBib3JkZXItY29sb3I6Izc3Nztcbn0iLCJcbmZpZWxkc2V0IHtcbiAgYmFja2dyb3VuZC1jb2xvcjogJHNlY29uZGFyeS1iYWNrZ3JvdW5kLWNvbG9yO1xuICBib3JkZXI6ICRiYXNlLWJvcmRlcjtcbiAgbWFyZ2luOiAwIDAgJHNtYWxsLXNwYWNpbmc7XG4gIHBhZGRpbmc6ICRiYXNlLXNwYWNpbmc7XG59XG5cbmlucHV0LFxubGFiZWwsXG5zZWxlY3Qge1xuICBkaXNwbGF5OiBibG9jaztcbiAgZm9udC1mYW1pbHk6ICRiYXNlLWZvbnQtZmFtaWx5O1xuICBmb250LXNpemU6ICRiYXNlLWZvbnQtc2l6ZTtcbn1cblxubGFiZWwge1xuICBmb250LXdlaWdodDogNjAwO1xuICAmLnJlcXVpcmVkOjphZnRlciB7XG4gICAgY29udGVudDogXCIqXCI7XG4gIH1cblxuICBhYmJyIHtcbiAgICBkaXNwbGF5OiBub25lO1xuICB9XG59XG5cbiN7JGFsbC10ZXh0LWlucHV0c30sXG5zZWxlY3Qge1xuICBiYWNrZ3JvdW5kLWNvbG9yOiAkYmFzZS1iYWNrZ3JvdW5kLWNvbG9yO1xuICBib3JkZXI6IDFweCBzb2xpZCAjYmZiZmJmO1xuICBib3JkZXItcmFkaXVzOiAkYmFzZS1ib3JkZXItcmFkaXVzO1xuICBib3gtc2hhZG93OiAkZm9ybS1ib3gtc2hhZG93O1xuICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICBmb250LWZhbWlseTogJGJhc2UtZm9udC1mYW1pbHk7XG4gIGZvbnQtc2l6ZTogJGJhc2UtZm9udC1zaXplO1xuICBwYWRkaW5nOiAkYmFzZS1zcGFjaW5nIC8gNDtcbiAgdHJhbnNpdGlvbjogYm9yZGVyLWNvbG9yICRiYXNlLWR1cmF0aW9uICRiYXNlLXRpbWluZztcbiAgbWF4LXdpZHRoOiAxMDAlO1xuICAmOmhvdmVyIHtcbiAgICBib3JkZXItY29sb3I6IHNoYWRlKCRiYXNlLWJvcmRlci1jb2xvciwgMjAlKTtcbiAgfVxuXG4gICY6Zm9jdXMge1xuICAgIGJvcmRlci1jb2xvcjogJGJhc2UtYWNjZW50LWNvbG9yO1xuICAgIGJveC1zaGFkb3c6ICRmb3JtLWJveC1zaGFkb3ctZm9jdXM7XG4gICAgb3V0bGluZTogbm9uZTtcbiAgfVxuXG4gICY6ZGlzYWJsZWQge1xuICAgIGJhY2tncm91bmQtY29sb3I6IHNoYWRlKCRiYXNlLWJhY2tncm91bmQtY29sb3IsIDUlKTtcbiAgICBjdXJzb3I6IG5vdC1hbGxvd2VkO1xuXG4gICAgJjpob3ZlciB7XG4gICAgICBib3JkZXI6ICRiYXNlLWJvcmRlcjtcbiAgICB9XG4gIH1cbn1cblxudGV4dGFyZWEge1xuICB3aWR0aDogMTAwJTtcbiAgcmVzaXplOiB2ZXJ0aWNhbDtcbn1cblxuaW5wdXRbdHlwZT1cInNlYXJjaFwiXSB7XG4gIGFwcGVhcmFuY2U6IG5vbmU7XG59XG5cbmlucHV0W3R5cGU9XCJjaGVja2JveFwiXSxcbmlucHV0W3R5cGU9XCJyYWRpb1wiXSB7XG4gIGRpc3BsYXk6IGlubGluZTtcbiAgbWFyZ2luLXJpZ2h0OiAkc21hbGwtc3BhY2luZyAvIDI7XG5cbiAgKyBsYWJlbCB7XG4gICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xuICB9XG59XG5cbmlucHV0W3R5cGU9XCJmaWxlXCJdIHtcbiAgd2lkdGg6IDEwMCU7XG59XG5cbnNlbGVjdCB7XG4gIG1heC13aWR0aDogMTAwJTtcbiAgd2lkdGg6IGF1dG87XG59XG5cbi5mb3JtLWl0ZW17XG4gIHdpZHRoOiAxMDAlO1xuICBjb2xvcjogIzMzMztcbiAgQGluY2x1ZGUgbWVkaWEoJGJyZWFrcG9pbnRfMSkge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgfVxuICBtYXJnaW4tYm90dG9tOiAkYmFzZS1zcGFjaW5nLzI7XG4gICZfX2lucHV0e1xuICAgIHdpZHRoOiAxMDAlO1xuICAgIEBpbmNsdWRlIG1lZGlhKCRicmVha3BvaW50XzEpIHtcbiAgICAgIHdpZHRoOiA2MCU7XG4gICAgfVxuICB9XG5cbiAgJl9fbGFiZWx7XG4gICAgd2lkdGg6IDEwMCU7XG4gICAgcGFkZGluZy1ib3R0b206ICRiYXNlLXNwYWNpbmcvMjtcblxuICAgIEBpbmNsdWRlIG1lZGlhKCRicmVha3BvaW50XzEpIHtcbiAgICAgIHBhZGRpbmc6IDA7XG4gICAgICB3aWR0aDogNDAlO1xuICAgICAgdGV4dC1hbGlnbjogcmlnaHQ7XG4gICAgICBtYXJnaW4tcmlnaHQ6ICRiYXNlLXNwYWNpbmc7XG4gICAgfVxuICB9XG59XG5cbi5maWVsZC1ncm91cHtcbiAgJl9fdGl0bGV7XG4gICAgcGFkZGluZy1ib3R0b206ICRiYXNlLXNwYWNpbmcvMjtcbiAgfVxuICAmX19pdGVtc3tcblxuICB9XG4gIHBhZGRpbmc6ICRiYXNlLXNwYWNpbmcvNCAwICRiYXNlLXNwYWNpbmcvMiAwO1xufSIsIlxuaDEge1xuICBtYXJnaW46IDA7XG4gIHBhZGRpbmc6IDA7XG4gIGZvbnQtc2l6ZTogJGgxLWZvbnQtc2l6ZTtcbn1cblxuaDIge1xuICBtYXJnaW46IDA7XG4gIHBhZGRpbmc6IDA7XG4gIGZvbnQtc2l6ZTogJGgyLWZvbnQtc2l6ZTtcbn1cblxuaDMge1xuICBtYXJnaW46IDA7XG4gIHBhZGRpbmc6IDA7XG4gIGZvbnQtc2l6ZTogJGgzLWZvbnQtc2l6ZTtcbn1cblxuaDQge1xuICBtYXJnaW46IDA7XG4gIHBhZGRpbmc6IDA7XG4gIGZvbnQtc2l6ZTogJGg0LWZvbnQtc2l6ZTtcbn1cblxuaDUge1xuICBtYXJnaW46IDA7XG4gIHBhZGRpbmc6IDA7XG4gIGZvbnQtc2l6ZTogJGg1LWZvbnQtc2l6ZTtcbn1cblxuaDYge1xuICBtYXJnaW46IDA7XG4gIHBhZGRpbmc6IDA7XG4gIGZvbnQtc2l6ZTogJGg2LWZvbnQtc2l6ZTtcbn0iLCIudmVydGljYWwtdGFicy1jb250YWluZXIge1xuICBAaW5jbHVkZSBjbGVhcmZpeDtcbiAgbWFyZ2luLWJvdHRvbTogJGJhc2Utc3BhY2luZztcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgZGlzcGxheTogZmxleDtcbiAgLnZlcnRpY2FsLXRhYnMge1xuICAgIHBhZGRpbmc6IDA7XG4gICAgbWFyZ2luOiAwO1xuICAgIGRpc3BsYXk6IGlubGluZTtcbiAgICBmbG9hdDogbGVmdDtcbiAgICB3aWR0aDogMjAlO1xuICAgIGxpc3Qtc3R5bGU6IG5vbmU7XG4gICAgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgJGJhc2UtYm9yZGVyLWNvbG9yO1xuICB9XG5cbiAgbGkge1xuICAgICYuYWN0aXZlIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHdoaXRlO1xuICAgICAgbWFyZ2luLXJpZ2h0OiAtMXB4O1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgJGJhc2UtYm9yZGVyLWNvbG9yO1xuICAgICAgYm9yZGVyLXJpZ2h0LWNvbG9yOiB3aGl0ZTtcbiAgICAgIC5zdWItYWN0aXZle1xuICAgICAgICBjb2xvcjogJGJhc2UtbGluay1jb2xvcjtcbiAgICAgIH1cbiAgICAgIC5zdWItbm9uLWFjdGl2ZXtcbiAgICAgICAgY29sb3I6ICRiYXNlLWZvbnQtY29sb3I7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYSB7XG4gICAgICBwYWRkaW5nOiAkYmFzZS1zcGFjaW5nLzIgJGd1dHRlci8yO1xuICAgICAgdGV4dC1kZWNvcmF0aW9uOiBub25lO1xuICAgICAgY29sb3I6IGluaGVyaXQ7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICB9XG4gICAgdWx7XG4gICAgICBsaXN0LXN0eWxlOiBub25lO1xuICAgICAgcGFkZGluZzogMDtcbiAgICAgIG1hcmdpbjogMDtcbiAgICAgIGxpe1xuICAgICAgICBwYWRkaW5nLWJvdHRvbTogNXB4O1xuICAgICAgICBwYWRkaW5nLWxlZnQ6IDIwcHg7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLnZlcnRpY2FsLXRhYjpmb2N1cyB7XG4gICAgb3V0bGluZTogbm9uZTtcblxuICB9XG5cbiAgLnZlcnRpY2FsLXRhYi1jb250ZW50LWNvbnRhaW5lciB7XG4gICAgYm9yZGVyOiAxcHggc29saWQgJGJhc2UtYm9yZGVyLWNvbG9yO1xuICAgIGJvcmRlci1sZWZ0OiBub25lO1xuICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICB3aWR0aDogODAlO1xuICAgIGJhY2tncm91bmQtY29sb3I6IHdoaXRlO1xuICAgIG1hcmdpbjogMCBhdXRvO1xuXG4gICAgJiBhOmZvY3VzIHtcbiAgICAgIG91dGxpbmU6IG5vbmU7XG4gICAgfVxuXG4gIH1cblxuICAudmVydGljYWwtdGFiLWNvbnRlbnQge1xuICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiB3aGl0ZTtcbiAgICBwYWRkaW5nOiAkYmFzZS1zcGFjaW5nICRndXR0ZXI7XG4gICAgYm9yZGVyOiBub25lO1xuICAgIHdpZHRoOiAxMDAlO1xuICB9XG5cbiAgLnZlcnRpY2FsLXRhYi1hY2NvcmRpb24taGVhZGluZyB7XG4gICAgYm9yZGVyLXRvcDogMXB4IHNvbGlkICRiYXNlLWJvcmRlci1jb2xvcjtcbiAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgZGlzcGxheTogYmxvY2s7XG4gICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgcGFkZGluZzogJGJhc2Utc3BhY2luZy8yICRndXR0ZXIvMjtcblxuICAgICY6aG92ZXIge1xuICAgICAgY29sb3I6ICRiYXNlLWFjY2VudC1jb2xvcjtcbiAgICB9XG5cbiAgICAmOmZpcnN0LWNoaWxkIHtcbiAgICAgIGJvcmRlci10b3A6IG5vbmU7XG4gICAgfVxuXG4gICAgJi5hY3RpdmUge1xuICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICBib3JkZXItYm90dG9tOiBub25lO1xuICAgIH1cblxuICB9XG59IiwiLmFjY29yZGlvbi10YWJzLW1pbmltYWwge1xuICBtYXJnaW46IDAgJGJhc2Utc3BhY2luZy8yO1xuICBAaW5jbHVkZSBjbGVhcmZpeDtcbiAgbGluZS1oZWlnaHQ6IDEuNTtcbiAgcGFkZGluZzogMDtcbiAgdWwudGFiLWxpc3Qge1xuICAgIG1hcmdpbjogMDtcbiAgICBwYWRkaW5nOiAwO1xuICB9XG4gIGxpLnRhYi1oZWFkZXItYW5kLWNvbnRlbnQge1xuICAgIGxpc3Qtc3R5bGU6IG5vbmU7XG4gICAgZGlzcGxheTogaW5saW5lO1xuICB9XG5cbiAgLnRhYi1saW5rIHtcbiAgICBib3JkZXItdG9wOiAxcHggc29saWQgJGJhc2UtYm9yZGVyLWNvbG9yO1xuICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICBib3JkZXItdG9wOiAwO1xuICAgIGEge1xuICAgICAgdGV4dC1kZWNvcmF0aW9uOiBub25lO1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICBwYWRkaW5nOiAoJGJhc2Utc3BhY2luZyAvIDIpICRndXR0ZXI7XG5cbiAgICAgICY6aG92ZXIge1xuICAgICAgICBjb2xvcjogJGhvdmVyLWxpbmstY29sb3I7XG4gICAgICB9XG4gICAgICAmOmZvY3VzIHtcbiAgICAgICAgb3V0bGluZTogbm9uZTtcbiAgICAgIH1cbiAgICAgICYuaXMtYWN0aXZlIHtcbiAgICAgICAgYm9yZGVyOiAxcHggc29saWQgJGJhc2UtYm9yZGVyLWNvbG9yO1xuICAgICAgICBib3JkZXItYm90dG9tLWNvbG9yOiB3aGl0ZTtcbiAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IC0xcHg7XG4gICAgICAgIGNvbG9yOiAkYmFzZS1hY2NlbnQtY29sb3I7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLnRhYi1jb250ZW50IHtcbiAgICBib3JkZXI6IDFweCBzb2xpZCAkYmFzZS1ib3JkZXItY29sb3I7XG4gICAgcGFkZGluZzogJGJhc2Utc3BhY2luZyAkZ3V0dGVyO1xuICAgIHdpZHRoOiAxMDAlO1xuICAgIGZsb2F0OiBsZWZ0O1xuICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgIG1pbi1oZWlnaHQ6IDI1MHB4O1xuICB9XG59IiwiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qXFxcbiAgICAkQkVBVVRPTlMuQ1NTXG5cXCotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuLyoqXG4gKiBiZWF1dG9ucyBpcyBhIGJlYXV0aWZ1bGx5IHNpbXBsZSBidXR0b24gdG9vbGtpdC5cbiAqXG4gKiBMSUNFTlNFXG4gKlxuICogQ29weXJpZ2h0IDIwMTMgSGFycnkgUm9iZXJ0c1xuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiBodHRwOi8vYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKlxuICovXG5cbi8qISpcbiAqXG4gKiBAY3Nzd2l6YXJkcnkgLS0gY3Nzd2l6YXJkcnkuY29tL2JlYXV0b25zXG4gKlxuICovXG5cbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKlxcXG4gICAgJEJBU0VcblxcKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4vKipcbiAqIEJhc2UgYnV0dG9uIHN0eWxlcy5cbiAqXG4gKiAxLiBBbGxvdyB1cyB0byBiZXR0ZXIgc3R5bGUgYm94IG1vZGVsIHByb3BlcnRpZXMuXG4gKiAyLiBMaW5lIGRpZmZlcmVudCBzaXplZCBidXR0b25zIHVwIGEgbGl0dGxlIG5pY2VyLlxuICogMy4gU3RvcCBidXR0b25zIHdyYXBwaW5nIGFuZCBsb29raW5nIGJyb2tlbi5cbiAqIDQuIE1ha2UgYnV0dG9ucyBpbmhlcml0IGZvbnQgc3R5bGVzLlxuICogNS4gRm9yY2UgYWxsIGVsZW1lbnRzIHVzaW5nIGJlYXV0b25zIHRvIGFwcGVhciBjbGlja2FibGUuXG4gKiA2LiBOb3JtYWxpc2UgYm94IG1vZGVsIHN0eWxlcy5cbiAqIDcuIElmIHRoZSBidXR0b27igJlzIHRleHQgaXMgMWVtLCBhbmQgdGhlIGJ1dHRvbiBpcyAoMyAqIGZvbnQtc2l6ZSkgdGFsbCwgdGhlblxuICogICAgdGhlcmUgaXMgMWVtIG9mIHNwYWNlIGFib3ZlIGFuZCBiZWxvdyB0aGF0IHRleHQuIFdlIHRoZXJlZm9yZSBhcHBseSAxZW1cbiAqICAgIG9mIHNwYWNlIHRvIHRoZSBsZWZ0IGFuZCByaWdodCwgYXMgcGFkZGluZywgdG8ga2VlcCBjb25zaXN0ZW50IHNwYWNpbmcuXG4gKiA4LiBCYXNpYyBjb3NtZXRpY3MgZm9yIGRlZmF1bHQgYnV0dG9ucy4gQ2hhbmdlIG9yIG92ZXJyaWRlIGF0IHdpbGwuXG4gKiA5LiBEb27igJl0IGFsbG93IGJ1dHRvbnMgdG8gaGF2ZSB1bmRlcmxpbmVzOyBpdCBraW5kYSBydWlucyB0aGUgaWxsdXNpb24uXG4gKi9cbi5idG4ge1xuICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IC8qIFsxXSAqL1xuICB2ZXJ0aWNhbC1hbGlnbjogbWlkZGxlOyAvKiBbMl0gKi9cbiAgd2hpdGUtc3BhY2U6IG5vd3JhcDsgLyogWzNdICovXG4gIGZvbnQtZmFtaWx5OiBpbmhlcml0OyAvKiBbNF0gKi9cbiAgZm9udC1zaXplOiAxMDAlOyAvKiBbNF0gKi9cbiAgY3Vyc29yOiBwb2ludGVyOyAvKiBbNV0gKi9cbiAgYm9yZGVyOiBub25lOyAvKiBbNl0gKi9cbiAgbWFyZ2luOiAwOyAvKiBbNl0gKi9cbiAgcGFkZGluZy10b3A6IDA7IC8qIFs2XSAqL1xuICBwYWRkaW5nLWJvdHRvbTogMDsgLyogWzZdICovXG4gIGxpbmUtaGVpZ2h0OiAzOyAvKiBbN10gKi9cbiAgcGFkZGluZy1yaWdodDogMWVtOyAvKiBbN10gKi9cbiAgcGFkZGluZy1sZWZ0OiAxZW07IC8qIFs3XSAqL1xuICBib3JkZXItcmFkaXVzOiAzcHg7IC8qIFs4XSAqL1xuICBiYWNrZ3JvdW5kOiAkYmFzZS1idXR0b24tY29sb3I7XG4gIGNvbG9yOiB3aGl0ZTtcbn1cblxuLmJ0biB7XG5cbiAgJixcbiAgJjpob3ZlciB7XG4gICAgdGV4dC1kZWNvcmF0aW9uOiBub25lOyAvKiBbOV0gKi9cbiAgICBiYWNrZ3JvdW5kOiAkaG92ZXItYnV0dG9uLWNvbG9yO1xuICB9XG5cbiAgJjphY3RpdmUsXG4gICY6Zm9jdXMge1xuICAgIG91dGxpbmU6IG5vbmU7XG4gIH1cbn1cblxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qXFxcbiAgICAkU0laRVNcblxcKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4vKipcbiAqIEJ1dHRvbiBzaXplIG1vZGlmaWVycy5cbiAqXG4gKiBUaGVzZSBhbGwgZm9sbG93IHRoZSBzYW1lIHNpemluZyBydWxlcyBhcyBhYm92ZTsgdGV4dCBpcyAxZW0sIHNwYWNlIGFyb3VuZCBpdFxuICogcmVtYWlucyB1bmlmb3JtLlxuICovXG4uYnRuLS1zbWFsbCB7XG4gIHBhZGRpbmctcmlnaHQ6IDAuNWVtO1xuICBwYWRkaW5nLWxlZnQ6IDAuNWVtO1xuICBsaW5lLWhlaWdodDogMjtcbn1cblxuLmJ0bi0tbGFyZ2Uge1xuICBwYWRkaW5nLXJpZ2h0OiAxLjVlbTtcbiAgcGFkZGluZy1sZWZ0OiAxLjVlbTtcbiAgbGluZS1oZWlnaHQ6IDQ7XG59XG5cbi5idG4tLWh1Z2Uge1xuICBwYWRkaW5nLXJpZ2h0OiAyZW07XG4gIHBhZGRpbmctbGVmdDogMmVtO1xuICBsaW5lLWhlaWdodDogNTtcbn1cblxuLyoqXG4gKiBUaGVzZSBidXR0b25zIHdpbGwgZmlsbCB0aGUgZW50aXJldHkgb2YgdGhlaXIgY29udGFpbmVyLlxuICpcbiAqIDEuIFJlbW92ZSBwYWRkaW5nIHNvIHRoYXQgd2lkdGhzIGFuZCBwYWRkaW5ncyBkb27igJl0IGNvbmZsaWN0LlxuICovXG4uYnRuLS1mdWxsIHtcbiAgd2lkdGg6IDEwMCU7XG4gIHBhZGRpbmctcmlnaHQ6IDA7IC8qIFsxXSAqL1xuICBwYWRkaW5nLWxlZnQ6IDA7IC8qIFsxXSAqL1xuICB0ZXh0LWFsaWduOiBjZW50ZXI7XG59XG5cbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKlxcXG4gICAgJEZPTlQtU0laRVNcblxcKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4vKipcbiAqIEJ1dHRvbiBmb250LXNpemUgbW9kaWZpZXJzLlxuICovXG4uYnRuLS1hbHBoYSB7XG4gIGZvbnQtc2l6ZTogM3JlbTtcbn1cblxuLmJ0bi0tYmV0YSB7XG4gIGZvbnQtc2l6ZTogMnJlbTtcbn1cblxuLmJ0bi0tZ2FtbWEge1xuICBmb250LXNpemU6IDFyZW07XG59XG5cbi8qKlxuICogTWFrZSB0aGUgYnV0dG9uIGluaGVyaXQgc2l6aW5nIGZyb20gaXRzIHBhcmVudC5cbiAqL1xuLmJ0bi0tbmF0dXJhbCB7XG4gIHZlcnRpY2FsLWFsaWduOiBiYXNlbGluZTtcbiAgZm9udC1zaXplOiBpbmhlcml0O1xuICBsaW5lLWhlaWdodDogaW5oZXJpdDtcbiAgcGFkZGluZy1yaWdodDogMC41ZW07XG4gIHBhZGRpbmctbGVmdDogMC41ZW07XG59XG5cbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKlxcXG4gICAgJEZVTkNUSU9OU1xuXFwqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbi8qKlxuICogQnV0dG9uIGZ1bmN0aW9uIG1vZGlmaWVycy5cbiAqL1xuLmJ0bi0tcHJpbWFyeSB7XG59XG5cbi5idG4tLXNlY29uZGFyeSB7XG59XG5cbi5idG4tLXRlcnRpYXJ5IHtcbn1cblxuLyoqXG4gKiBQb3NpdGl2ZSBhY3Rpb25zOyBlLmcuIHNpZ24gaW4sIHB1cmNoYXNlLCBzdWJtaXQsIGV0Yy5cbiAqL1xuLmJ0bi0tcG9zaXRpdmUge1xuICBiYWNrZ3JvdW5kLWNvbG9yOiAjNEE5OTNFO1xuICBjb2xvcjogI2ZmZjtcbn1cblxuLyoqXG4gKiBOZWdhdGl2ZSBhY3Rpb25zOyBlLmcuIGNsb3NlIGFjY291bnQsIGRlbGV0ZSBwaG90bywgcmVtb3ZlIGZyaWVuZCwgZXRjLlxuICovXG4uYnRuLS1uZWdhdGl2ZSB7XG4gIGJhY2tncm91bmQtY29sb3I6ICNiMzM2MzA7XG4gIGNvbG9yOiAjZmZmO1xufVxuXG4vKipcbiAqIEluYWN0aXZlLCBkaXNhYmxlZCBidXR0b25zLlxuICpcbiAqIDEuIE1ha2UgdGhlIGJ1dHRvbiBsb29rIGxpa2Ugbm9ybWFsIHRleHQgd2hlbiBob3ZlcmVkLlxuICovXG4uYnRuLS1pbmFjdGl2ZSxcbi5idG4tLWluYWN0aXZlOmhvdmVyLFxuLmJ0bi0taW5hY3RpdmU6YWN0aXZlLFxuLmJ0bi0taW5hY3RpdmU6Zm9jdXMge1xuICBiYWNrZ3JvdW5kLWNvbG9yOiAjZGRkO1xuICBjb2xvcjogIzc3NztcbiAgY3Vyc29yOiB0ZXh0OyAvKiBbMV0gKi9cbn1cblxuLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qXFxcbiAgICAkU1RZTEVTXG5cXCotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuLyoqXG4gKiBCdXR0b24gc3R5bGUgbW9kaWZpZXJzLlxuICpcbiAqIDEuIFVzZSBhbiBvdmVybHktbGFyZ2UgbnVtYmVyIHRvIGVuc3VyZSBjb21wbGV0ZWx5IHJvdW5kZWQsIHBpbGwtbGlrZSBlbmRzLlxuICovXG4uYnRuLS1zb2Z0IHtcbiAgYm9yZGVyLXJhZGl1czogMjAwcHg7IC8qIFsxXSAqL1xufVxuXG4uYnRuLS1oYXJkIHtcbiAgYm9yZGVyLXJhZGl1czogMDtcbn1cbiIsIi5sZWZ0IHtcbiAgQGluY2x1ZGUgbWVkaWEoJGJyZWFrcG9pbnRfMikge1xuICAgIHdpZHRoOiA0OSU7XG4gICAgbWFyZ2luLXJpZ2h0OiAyJTtcbiAgICBmbG9hdDogbGVmdDtcbiAgfVxufVxuXG4ucmlnaHQge1xuICBAaW5jbHVkZSBtZWRpYSgkYnJlYWtwb2ludF8yKSB7XG4gICAgd2lkdGg6IDQ5JTtcbiAgICBmbG9hdDogbGVmdDtcbiAgfVxufSIsIi5uYXZpZ2F0aW9ue1xuICBwYWRkaW5nOiAwO1xuICBtYXJnaW46IDA7XG4gIGRpc3BsYXk6IGJsb2NrO1xuICAmX19pdGVte1xuICAgIG1hcmdpbjogMjBweCAxMHB4IDIwcHggMTBweDtcbiAgICBwYWRkaW5nLWJvdHRvbTogMTBweDtcbiAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xuICB9XG4gICYtLXN0ZXBze1xuXG4gIH1cbiAgJi0tc3RlcHMgJl9faXRlbXtcbiAgICBib3JkZXItYm90dG9tOiA1cHggc29saWQ7XG4gIH1cbn0iLCJcbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKlxcXG4gICAgJEhFTFBFUlxuXFwqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbi8qKlxuICogQSBzZXJpZXMgb2YgaGVscGVyIGNsYXNzZXMgdG8gdXNlIGFyYml0cmFyaWx5LiBPbmx5IHVzZSBhIGhlbHBlciBjbGFzcyBpZiBhblxuICogZWxlbWVudC9jb21wb25lbnQgZG9lc27igJl0IGFscmVhZHkgaGF2ZSBhIGNsYXNzIHRvIHdoaWNoIHlvdSBjb3VsZCBhcHBseSB0aGlzXG4gKiBzdHlsaW5nLCBlLmcuIGlmIHlvdSBuZWVkIHRvIGZsb2F0IGAubWFpbi1uYXZgIGxlZnQgdGhlbiBhZGQgYGZsb2F0OmxlZnQ7YCB0b1xuICogdGhhdCBydWxlc2V0IGFzIG9wcG9zZWQgdG8gYWRkaW5nIHRoZSBgLmZsb2F0LS1sZWZ0YCBjbGFzcyB0byB0aGUgbWFya3VwLlxuICpcbiAqIEEgbG90IG9mIHRoZXNlIGNsYXNzZXMgY2FycnkgYCFpbXBvcnRhbnRgIGFzIHlvdSB3aWxsIGFsd2F5cyB3YW50IHRoZW0gdG8gd2luXG4gKiBvdXQgb3ZlciBvdGhlciBzZWxlY3RvcnMuXG4gKi9cblxuXG4vKipcbiAqIEFkZC9yZW1vdmUgZmxvYXRzXG4gKi9cbi5mbG9hdC0tcmlnaHQgICB7IGZsb2F0OnJpZ2h0IWltcG9ydGFudDsgfVxuLmZsb2F0LS1sZWZ0ICAgIHsgZmxvYXQ6bGVmdCAhaW1wb3J0YW50OyB9XG4uZmxvYXQtLW5vbmUgICAgeyBmbG9hdDpub25lICFpbXBvcnRhbnQ7IH1cblxuXG4vKipcbiAqIFRleHQgYWxpZ25tZW50XG4gKi9cbi50ZXh0LS1sZWZ0ICAgICB7IHRleHQtYWxpZ246bGVmdCAgIWltcG9ydGFudDsgfVxuLnRleHQtLWNlbnRlciAgIHsgdGV4dC1hbGlnbjpjZW50ZXIhaW1wb3J0YW50OyB9XG4udGV4dC0tcmlnaHQgICAgeyB0ZXh0LWFsaWduOnJpZ2h0ICFpbXBvcnRhbnQ7IH1cblxuXG4vKipcbiAqIEZvbnQgd2VpZ2h0c1xuICovXG4ud2VpZ2h0LS1saWdodCAgICAgIHsgZm9udC13ZWlnaHQ6MzAwIWltcG9ydGFudDsgfVxuLndlaWdodC0tbm9ybWFsICAgICB7IGZvbnQtd2VpZ2h0OjQwMCFpbXBvcnRhbnQ7IH1cbi53ZWlnaHQtLXNlbWlib2xkICAgeyBmb250LXdlaWdodDo2MDAhaW1wb3J0YW50OyB9XG5cblxuLyoqXG4gKiBBZGQvcmVtb3ZlIG1hcmdpbnNcbiAqL1xuLnB1c2ggICAgICAgICAgIHsgbWFyZ2luOiAgICAgICAkYmFzZS1zcGFjaW5nIWltcG9ydGFudDsgfVxuLnB1c2gtLXRvcCAgICAgIHsgbWFyZ2luLXRvcDogICAkYmFzZS1zcGFjaW5nIWltcG9ydGFudDsgfVxuLnB1c2gtLXJpZ2h0ICAgIHsgbWFyZ2luLXJpZ2h0OiAkYmFzZS1zcGFjaW5nIWltcG9ydGFudDsgfVxuLnB1c2gtLWJvdHRvbSAgIHsgbWFyZ2luLWJvdHRvbTokYmFzZS1zcGFjaW5nIWltcG9ydGFudDsgfVxuLnB1c2gtLWxlZnQgICAgIHsgbWFyZ2luLWxlZnQ6ICAkYmFzZS1zcGFjaW5nIWltcG9ydGFudDsgfVxuLnB1c2gtLWVuZHMgICAgIHsgbWFyZ2luLXRvcDogICAkYmFzZS1zcGFjaW5nIWltcG9ydGFudDsgbWFyZ2luLWJvdHRvbTokYmFzZS1zcGFjaW5nIWltcG9ydGFudDsgfVxuLnB1c2gtLXNpZGVzICAgIHsgbWFyZ2luLXJpZ2h0OiAkYmFzZS1zcGFjaW5nIWltcG9ydGFudDsgbWFyZ2luLWxlZnQ6ICAkYmFzZS1zcGFjaW5nIWltcG9ydGFudDsgfVxuXG4ucHVzaC1oYWxmICAgICAgICAgIHsgbWFyZ2luOiAgICAgICAkc21hbGwtc3BhY2luZyFpbXBvcnRhbnQ7IH1cbi5wdXNoLWhhbGYtLXRvcCAgICAgeyBtYXJnaW4tdG9wOiAgICRzbWFsbC1zcGFjaW5nIWltcG9ydGFudDsgfVxuLnB1c2gtaGFsZi0tcmlnaHQgICB7IG1hcmdpbi1yaWdodDogJHNtYWxsLXNwYWNpbmchaW1wb3J0YW50OyB9XG4ucHVzaC1oYWxmLS1ib3R0b20gIHsgbWFyZ2luLWJvdHRvbTokc21hbGwtc3BhY2luZyFpbXBvcnRhbnQ7IH1cbi5wdXNoLWhhbGYtLWxlZnQgICAgeyBtYXJnaW4tbGVmdDogICRzbWFsbC1zcGFjaW5nIWltcG9ydGFudDsgfVxuLnB1c2gtaGFsZi0tZW5kcyAgICB7IG1hcmdpbi10b3A6ICAgJHNtYWxsLXNwYWNpbmchaW1wb3J0YW50OyBtYXJnaW4tYm90dG9tOiRzbWFsbC1zcGFjaW5nIWltcG9ydGFudDsgfVxuLnB1c2gtaGFsZi0tc2lkZXMgICB7IG1hcmdpbi1yaWdodDogJHNtYWxsLXNwYWNpbmchaW1wb3J0YW50OyBtYXJnaW4tbGVmdDogICRzbWFsbC1zcGFjaW5nIWltcG9ydGFudDsgfVxuXG4uZmx1c2ggICAgICAgICAgeyBtYXJnaW46ICAgICAgIDAhaW1wb3J0YW50OyB9XG4uZmx1c2gtLXRvcCAgICAgeyBtYXJnaW4tdG9wOiAgIDAhaW1wb3J0YW50OyB9XG4uZmx1c2gtLXJpZ2h0ICAgeyBtYXJnaW4tcmlnaHQ6IDAhaW1wb3J0YW50OyB9XG4uZmx1c2gtLWJvdHRvbSAgeyBtYXJnaW4tYm90dG9tOjAhaW1wb3J0YW50OyB9XG4uZmx1c2gtLWxlZnQgICAgeyBtYXJnaW4tbGVmdDogIDAhaW1wb3J0YW50OyB9XG4uZmx1c2gtLWVuZHMgICAgeyBtYXJnaW4tdG9wOiAgIDAhaW1wb3J0YW50OyBtYXJnaW4tYm90dG9tOjAhaW1wb3J0YW50OyB9XG4uZmx1c2gtLXNpZGVzICAgeyBtYXJnaW4tcmlnaHQ6IDAhaW1wb3J0YW50OyBtYXJnaW4tbGVmdDogIDAhaW1wb3J0YW50OyB9XG5cblxuLyoqXG4gKiBBZGQvcmVtb3ZlIHBhZGRpbmdzXG4gKi9cbi5zb2Z0ICAgICAgICAgICB7IHBhZGRpbmc6ICAgICAgICRiYXNlLXNwYWNpbmchaW1wb3J0YW50OyB9XG4uc29mdC0tdG9wICAgICAgeyBwYWRkaW5nLXRvcDogICAkYmFzZS1zcGFjaW5nIWltcG9ydGFudDsgfVxuLnNvZnQtLXJpZ2h0ICAgIHsgcGFkZGluZy1yaWdodDogJGJhc2Utc3BhY2luZyFpbXBvcnRhbnQ7IH1cbi5zb2Z0LS1ib3R0b20gICB7IHBhZGRpbmctYm90dG9tOiRiYXNlLXNwYWNpbmchaW1wb3J0YW50OyB9XG4uc29mdC0tbGVmdCAgICAgeyBwYWRkaW5nLWxlZnQ6ICAkYmFzZS1zcGFjaW5nIWltcG9ydGFudDsgfVxuLnNvZnQtLWVuZHMgICAgIHsgcGFkZGluZy10b3A6ICAgJGJhc2Utc3BhY2luZyFpbXBvcnRhbnQ7IHBhZGRpbmctYm90dG9tOiRiYXNlLXNwYWNpbmchaW1wb3J0YW50OyB9XG4uc29mdC0tc2lkZXMgICAgeyBwYWRkaW5nLXJpZ2h0OiAkYmFzZS1zcGFjaW5nIWltcG9ydGFudDsgcGFkZGluZy1sZWZ0OiAgJGJhc2Utc3BhY2luZyFpbXBvcnRhbnQ7IH1cblxuLnNvZnQtaGFsZiAgICAgICAgICAgeyBwYWRkaW5nOiAgICAgICAkc21hbGwtc3BhY2luZyFpbXBvcnRhbnQ7IH1cbi5zb2Z0LWhhbGYtLXRvcCAgICAgIHsgcGFkZGluZy10b3A6ICAgJHNtYWxsLXNwYWNpbmchaW1wb3J0YW50OyB9XG4uc29mdC1oYWxmLS1yaWdodCAgICB7IHBhZGRpbmctcmlnaHQ6ICRzbWFsbC1zcGFjaW5nIWltcG9ydGFudDsgfVxuLnNvZnQtaGFsZi0tYm90dG9tICAgeyBwYWRkaW5nLWJvdHRvbTokc21hbGwtc3BhY2luZyFpbXBvcnRhbnQ7IH1cbi5zb2Z0LWhhbGYtLWxlZnQgICAgIHsgcGFkZGluZy1sZWZ0OiAgJHNtYWxsLXNwYWNpbmchaW1wb3J0YW50OyB9XG4uc29mdC1oYWxmLS1lbmRzICAgICB7IHBhZGRpbmctdG9wOiAgICRzbWFsbC1zcGFjaW5nIWltcG9ydGFudDsgcGFkZGluZy1ib3R0b206JHNtYWxsLXNwYWNpbmchaW1wb3J0YW50OyB9XG4uc29mdC1oYWxmLS1zaWRlcyAgICB7IHBhZGRpbmctcmlnaHQ6ICRzbWFsbC1zcGFjaW5nIWltcG9ydGFudDsgcGFkZGluZy1sZWZ0OiAgJHNtYWxsLXNwYWNpbmchaW1wb3J0YW50OyB9XG5cbi5oYXJkICAgICAgICAgICB7IHBhZGRpbmc6ICAgICAgIDAhaW1wb3J0YW50OyB9XG4uaGFyZC0tdG9wICAgICAgeyBwYWRkaW5nLXRvcDogICAwIWltcG9ydGFudDsgfVxuLmhhcmQtLXJpZ2h0ICAgIHsgcGFkZGluZy1yaWdodDogMCFpbXBvcnRhbnQ7IH1cbi5oYXJkLS1ib3R0b20gICB7IHBhZGRpbmctYm90dG9tOjAhaW1wb3J0YW50OyB9XG4uaGFyZC0tbGVmdCAgICAgeyBwYWRkaW5nLWxlZnQ6ICAwIWltcG9ydGFudDsgfVxuLmhhcmQtLWVuZHMgICAgIHsgcGFkZGluZy10b3A6ICAgMCFpbXBvcnRhbnQ7IHBhZGRpbmctYm90dG9tOjAhaW1wb3J0YW50OyB9XG4uaGFyZC0tc2lkZXMgICAgeyBwYWRkaW5nLXJpZ2h0OiAwIWltcG9ydGFudDsgcGFkZGluZy1sZWZ0OiAgMCFpbXBvcnRhbnQ7IH1cblxuXG4vKipcbiAqIFB1bGwgaXRlbXMgZnVsbCB3aWR0aCBvZiBgLmlzbGFuZGAgcGFyZW50cy5cbiAqL1xuLmZ1bGwtYmxlZWR7XG4gIG1hcmdpbi1yaWdodDotJGJhc2Utc3BhY2luZyFpbXBvcnRhbnQ7XG4gIG1hcmdpbi1sZWZ0OiAtJGJhc2Utc3BhY2luZyFpbXBvcnRhbnQ7XG5cbiAgLmlzbGV0ICZ7XG4gICAgbWFyZ2luLXJpZ2h0Oi0oJHNtYWxsLXNwYWNpbmcpIWltcG9ydGFudDtcbiAgICBtYXJnaW4tbGVmdDogLSgkc21hbGwtc3BhY2luZykhaW1wb3J0YW50O1xuICB9XG59XG4iLCIubG9hZGVyLFxuLmxvYWRlcjpiZWZvcmUsXG4ubG9hZGVyOmFmdGVyIHtcbiAgYm9yZGVyLXJhZGl1czogNTAlO1xufVxuLmxvYWRlcjpiZWZvcmUsXG4ubG9hZGVyOmFmdGVyIHtcbiAgcG9zaXRpb246IGFic29sdXRlO1xuICBjb250ZW50OiAnJztcbn1cbi5sb2FkZXI6YmVmb3JlIHtcbiAgd2lkdGg6IDUuMmVtO1xuICBoZWlnaHQ6IDEwLjJlbTtcbiAgYmFja2dyb3VuZDogJGxpZ2h0LWdyYXk7XG4gIGJvcmRlci1yYWRpdXM6IDEwLjJlbSAwIDAgMTAuMmVtO1xuICB0b3A6IC0wLjFlbTtcbiAgbGVmdDogLTAuMWVtO1xuICAtd2Via2l0LXRyYW5zZm9ybS1vcmlnaW46IDUuMmVtIDUuMWVtO1xuICB0cmFuc2Zvcm0tb3JpZ2luOiA1LjJlbSA1LjFlbTtcbiAgLXdlYmtpdC1hbmltYXRpb246IGxvYWQyIDJzIGluZmluaXRlIGVhc2UgMS41cztcbiAgYW5pbWF0aW9uOiBsb2FkMiAycyBpbmZpbml0ZSBlYXNlIDEuNXM7XG59XG5cbi5sb2FkZXIge1xuICBmb250LXNpemU6IDExcHg7XG4gIHRleHQtaW5kZW50OiAtOTk5OTllbTtcbiAgbWFyZ2luOiA1NXB4IGF1dG87XG4gIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgd2lkdGg6IDEwZW07XG4gIGhlaWdodDogMTBlbTtcbiAgYm94LXNoYWRvdzogaW5zZXQgMCAwIDAgMWVtICNmZmZmZmY7XG4gIC13ZWJraXQtdHJhbnNmb3JtOiB0cmFuc2xhdGVaKDApO1xuICAtbXMtdHJhbnNmb3JtOiB0cmFuc2xhdGVaKDApO1xuICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVooMCk7XG59XG4ubG9hZGVyOmFmdGVyIHtcbiAgd2lkdGg6IDUuMmVtO1xuICBoZWlnaHQ6IDEwLjJlbTtcbiAgYmFja2dyb3VuZDogJGxpZ2h0LWdyYXk7XG4gIGJvcmRlci1yYWRpdXM6IDAgMTAuMmVtIDEwLjJlbSAwO1xuICB0b3A6IC0wLjFlbTtcbiAgbGVmdDogNS4xZW07XG4gIC13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjogMHB4IDUuMWVtO1xuICB0cmFuc2Zvcm0tb3JpZ2luOiAwcHggNS4xZW07XG4gIC13ZWJraXQtYW5pbWF0aW9uOiBsb2FkMiAycyBpbmZpbml0ZSBlYXNlO1xuICBhbmltYXRpb246IGxvYWQyIDJzIGluZmluaXRlIGVhc2U7XG59XG5ALXdlYmtpdC1rZXlmcmFtZXMgbG9hZDIge1xuICAwJSB7XG4gICAgLXdlYmtpdC10cmFuc2Zvcm06IHJvdGF0ZSgwZGVnKTtcbiAgICB0cmFuc2Zvcm06IHJvdGF0ZSgwZGVnKTtcbiAgfVxuICAxMDAlIHtcbiAgICAtd2Via2l0LXRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7XG4gICAgdHJhbnNmb3JtOiByb3RhdGUoMzYwZGVnKTtcbiAgfVxufVxuQGtleWZyYW1lcyBsb2FkMiB7XG4gIDAlIHtcbiAgICAtd2Via2l0LXRyYW5zZm9ybTogcm90YXRlKDBkZWcpO1xuICAgIHRyYW5zZm9ybTogcm90YXRlKDBkZWcpO1xuICB9XG4gIDEwMCUge1xuICAgIC13ZWJraXQtdHJhbnNmb3JtOiByb3RhdGUoMzYwZGVnKTtcbiAgICB0cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpO1xuICB9XG59XG4iXSwibWFwcGluZ3MiOiI7QXVGR0UsSUFBSSxDQUFDO0VBQ0gsVUFBVSxFQUFFLFVBQVcsR0FDeEI7O0FBRUQsQ0FBQyxFQUFELENBQUMsQUFFRSxPQUFPLEVBRlYsQ0FBQyxBQUdFLFFBQVEsQ0FBQztFQUNSLFVBQVUsRUFBRSxPQUFRLEdBQ3JCOztBdkZSTCxHQUFHLENBQUM7RUFDRixTQUFTLEVvR0RNLElBQUk7RXBHRW5CLFdBQVcsRW9HUU0sR0FBRztFcEdQcEIsVUFBVSxFb0dvQlEsT0FBTztFcEduQnpCLEtBQUssRUFBRSxJQUFLO0VBQ1osS0FBSyxFQUFFLElBQUs7RXFHVGQ7d0NBRXdDO0VBQ3hDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXFERztFQW9CSDs7R0FFRztFQWlCSDs7Ozs7R0FLRztFQUcwQixTQUFTO0VBR1QsU0FBUztFQUVULFNBQVM7RUFFVCxTQUFTO0VBR1QsU0FBUztFQUdULFNBQVM7RUFFVCxTQUFTO0VBRVQsUUFBUTtFQUdSLFNBQVM7RUFLdEM7O0dBRUc7RUFzQkg7O0dBRUc7RUFTSDs7R0FFRztFS3JLSDt3Q0FFd0M7RUFDeEM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FtQkc7RUFFSDs7OztHQUlHO0VBRUg7d0NBRXdDO0VBQ3hDOzs7Ozs7Ozs7Ozs7OztHQWNHO0VBa0NIO3dDQUV3QztFQUN4Qzs7Ozs7R0FLRztFQW1CSDs7OztHQUlHO0VBUUg7d0NBRXdDO0VBQ3hDOztHQUVHO0VBYUg7O0dBRUc7RUFTSDt3Q0FFd0M7RUFDeEM7O0dBRUc7RUFVSDs7R0FFRztFQU1IOztHQUVHO0VBTUg7Ozs7R0FJRztFQVVIO3dDQUV3QztFQUN4Qzs7OztHQUlHO0VHeE1IO3dDQUV3QztFQUN4Qzs7Ozs7Ozs7R0FRRztFQUdIOztHQUVHO0VBTUg7O0dBRUc7RUFNSDs7R0FFRztFQU1IOztHQUVHO0VBMEJIOztHQUVHO0VBMEJIOztHQUVHLEU3R2lFRjtFQTlKRCxHQUFHLENxR3FESCxLQUFLLENBQUE7SUFDSCxLQUFLLEVBQUMsSUFBSyxHQU9aO0lyRzdERCxHQUFHLENxR3FESCxLQUFLLEVBRUgsQUFBQSxlQUFDLENBQWdCLE1BQU0sQUFBdEIsQ0FBdUIsT0FBTztJckd2RGpDLEdBQUcsQ3FHcURILEtBQUssRUFHSCxBQUFBLGVBQUMsQ0FBZ0IsTUFBTSxBQUF0QixDQUF1QixNQUFNLENBQUE7TUFDNUIsTUFBTSxFQUFDLElBQUs7TUFDWixPQUFPLEVBQUMsSUFBSztNQUNiLFVBQVUsRURwQ00sT0FBTyxHQ3FDeEI7RXJHNURILEdBQUcsQ3FHOERILEVBQUU7RXJHOURGLEdBQUcsQ3FHK0RILEVBQUUsQ0FBQTtJQUNBLE9BQU8sRUFBQyxPQUFhO0lBSXJCLFVBQVUsRUFBQyxJQUFLLEdBQ2pCO0lBSkMsTUFBTSxDQUFOLE1BQU0sTUFBTSxTQUFTLEVBQUUsS0FBSztNckdqRTlCLEdBQUcsQ3FHOERILEVBQUU7TXJHOURGLEdBQUcsQ3FHK0RILEVBQUUsQ0FBQTtRQUdFLE9BQU8sRUFBQyxNQUFhLEdBR3hCO0VyR3JFRCxHQUFHLEVxRzJFSCxBQUFBLE9BQUMsQUFBQSxFQUFRO0lBQ1AsVUFBVSxFQUFDLE1BQU8sR0FDbkI7RXJHN0VELEdBQUcsRXFHOEVILEFBQUEsT0FBQyxDQUFRLEdBQUcsQUFBWCxFQUFZO0lBQ1gsVUFBVSxFQUFDLElBQUssR0FDakI7RXJHaEZELEdBQUcsRXFHaUZILEFBQUEsT0FBQyxBQUFBLEVBQVE7SUFDUCxjQUFjLEVBQUMsTUFBTyxHQUN2QjtFckduRkQsR0FBRyxFcUdvRkgsQUFBQSxPQUFDLENBQVEsR0FBRyxBQUFYLEVBQVk7SUFDWCxjQUFjLEVBQUMsR0FBSSxHQUNwQjtFckd0RkQsR0FBRyxDcUd1RkgsVUFBVSxDQUFBO0lBQ1IsVUFBVSxFQUFDLEtBQU0sR0FDbEI7RXJHekZELEdBQUcsQ3FHaUdILEdBQUcsQ0FBSztJQUFFLEtBQUssRUFBRSxFQUFJLEdBQUU7RXJHakd2QixHQUFHLENxR2tHSCxJQUFJLENBQUk7SUFBRSxLQUFLLEVBQUMsR0FBSyxHQUFFO0VyR2xHdkIsR0FBRyxDcUdtR0gsSUFBSSxDQUFJO0lBQUUsS0FBSyxFQUFDLEtBQU8sR0FBRTtFckduR3pCLEdBQUcsQ3FHb0dILElBQUksQ0FBSTtJQUFFLEtBQUssRUFBQyxHQUFLLEdBQUU7RXJHcEd2QixHQUFHLENxR3FHSCxJQUFJLENBQUk7SUFBRSxLQUFLLEVBQUMsR0FBSyxHQUFFO0VyR3JHdkIsR0FBRyxDcUdzR0gsSUFBSSxDQUFJO0lBQUUsS0FBSyxFQUFDLEdBQUssR0FBRTtFckd0R3ZCLEdBQUcsQ3FHdUdILElBQUksQ0FBSTtJQUFFLEtBQUssRUFBQyxHQUFLLEdBQUU7RXJHdkd2QixHQUFHLENxR3dHSCxJQUFJLENBQUk7SUFBRSxLQUFLLEVBQUMsT0FBUyxHQUFFO0VyR3hHM0IsR0FBRyxDcUd5R0gsSUFBSSxDQUFJO0lBQUUsS0FBSyxFQUFDLEdBQUssR0FBRTtFckd6R3ZCLEdBQUcsQ3FHMEdILElBQUksQ0FBSTtJQUFFLEtBQUssRUFBQyxLQUFPLEdBQUU7RXJHMUd6QixHQUFHLENxRzJHSCxJQUFJLENBQUk7SUFBRSxLQUFLLEVBQUMsR0FBSyxHQUFFO0VyRzNHdkIsR0FBRyxDcUc0R0gsSUFBSSxDQUFJO0lBQUUsS0FBSyxFQUFDLEdBQUssR0FBRTtFckc1R3ZCLEdBQUcsQ3FHNkdILElBQUksQ0FBSTtJQUFFLEtBQUssRUFBQyxHQUFLLEdBQUU7RXJHN0d2QixHQUFHLENxRzhHSCxJQUFJLENBQUk7SUFBRSxLQUFLLEVBQUMsR0FBSyxHQUFFO0VyRzlHdkIsR0FBRyxDcUcrR0gsSUFBSSxDQUFJO0lBQUUsS0FBSyxFQUFDLEdBQUssR0FBRTtFckcvR3ZCLEdBQUcsQ3FHZ0hILElBQUksQ0FBSTtJQUFFLEtBQUssRUFBQyxLQUFPLEdBQUU7RXJHaEh6QixHQUFHLENxR2lISCxJQUFJLENBQUk7SUFBRSxLQUFLLEVBQUMsR0FBSyxHQUFFO0VyR2pIdkIsR0FBRyxDcUdrSEgsSUFBSSxDQUFJO0lBQUUsS0FBSyxFQUFDLE9BQVMsR0FBRTtFckdsSDNCLEdBQUcsQ3FHbUhILElBQUksQ0FBSTtJQUFFLEtBQUssRUFBQyxHQUFLLEdBQUU7RXJHbkh2QixHQUFHLENxR29ISCxJQUFJLENBQUk7SUFBRSxLQUFLLEVBQUMsR0FBSyxHQUFFO0VyR3BIdkIsR0FBRyxDcUdxSEgsSUFBSSxDQUFJO0lBQUUsS0FBSyxFQUFDLEdBQUssR0FBRTtFckdySHZCLEdBQUcsQ3FHc0hILElBQUksQ0FBSTtJQUFFLEtBQUssRUFBQyxHQUFLLEdBQUU7RXJHdEh2QixHQUFHLENxR3VISCxJQUFJLENBQUk7SUFBRSxLQUFLLEVBQUMsS0FBTyxHQUFFO0VyR3ZIekIsR0FBRyxDcUd3SEgsSUFBSSxDQUFJO0lBQUUsS0FBSyxFQUFDLEdBQUssR0FBRTtFckd4SHZCLEdBQUcsQ3FHeUhILElBQUksQ0FBSTtJQUFFLEtBQUssRUFBQyxHQUFLLEdBQUU7RXJHekh2QixHQUFHLENxRytISCxnQkFBZ0IsQ0FBQTtJQUNkLGVBQWUsRUFBRSxRQUFTLEdBaUIzQjtJckdqSkQsR0FBRyxDcUcrSEgsZ0JBQWdCLENBR2QsRUFBRSxDQUFBO01BQ0EsTUFBTSxFQUFDLEdBQUcsQ0FBQyxLQUFLLENEM0dQLElBQUksR0M0R2Q7SXJHcElILEdBQUcsQ3FHK0hILGdCQUFnQixDQU1kLEVBQUU7SXJHcklKLEdBQUcsQ3FHK0hILGdCQUFnQixDQU9kLEVBQUUsQ0FBQTtNQUNBLFlBQVksRUFBRSxHQUFHLENBQUMsS0FBSyxDRC9HZCxJQUFJLEdDZ0hkO0lyR3hJSCxHQUFHLENxRytISCxnQkFBZ0IsQ0FXZCxLQUFLLENBQUMsRUFBRSxBQUFBLFdBQVcsQ0FBQyxFQUFFLENBQUE7TUFDcEIsbUJBQW1CLEVBQUMsR0FBSSxHQUN6QjtJckc1SUgsR0FBRyxDcUcrSEgsZ0JBQWdCLENBZWQsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEFBQUEsYUFBYSxDQUFBO01BQ3RCLGtCQUFrQixFQUFDLEdBQUksR0FDeEI7RXJHaEpILEdBQUcsQ3FHdUpILGVBQWUsQ0FFYixLQUFLLENBQUMsRUFBRSxBQUFBLFlBQWEsQ0FBQSxHQUFHLEVBQUM7SUFDdkIsZ0JBQWdCLEVBQUMsSUFBSztJQUFFLGtEQUFrRCxFQUMzRTtFckczSkgsR0FBRyxDcUdrS0gsWUFBWSxDQUFBO0lBQ1YsSUFBSSxFQUFDLG1CQUFvQixHQUMxQjtFckdwS0QsR0FBRyxDcUdxS0gsZ0JBQWdCLENBQUE7SUFDZCxLQUFLLEVBQUUsSUFBSztJQUNaLFlBQVksRUFBQyxJQUFLLEdBQ25CO0VyR3hLRCxHQUFHLENzR0hILFFBQVEsQ0FBQztJQUNQLGdCQUFnQixFRnlCRSxPQUFPO0lFeEJ6QixNQUFNLEVGb0RNLEdBQUcsQ0FBQyxLQUFLLENBM0JWLElBQUk7SUV4QmYsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENGaUJHLE1BQWE7SUVoQjNCLE9BQU8sRUZjTSxLQUFpQixHRWIvQjtFdEdGRCxHQUFHLENzR0lILEtBQUs7RXRHSkwsR0FBRyxDc0dLSCxLQUFLO0V0R0xMLEdBQUcsQ3NHTUgsTUFBTSxDQUFDO0lBQ0wsT0FBTyxFQUFFLEtBQU07SUFDZixXQUFXLEVGUE0sWUFBWTtJRVE3QixTQUFTLEVGVE0sSUFBSSxHRVVwQjtFdEdWRCxHQUFHLENzR1lILEtBQUssQ0FBQztJQUNKLFdBQVcsRUFBRSxHQUFJLEdBUWxCO0l0R3JCRCxHQUFHLENzR1lILEtBQUssQUFFRixTQUFTLEFBQUEsT0FBTyxDQUFDO01BQ2hCLE9BQU8sRUFBRSxHQUFJLEdBQ2Q7SXRHaEJILEdBQUcsQ3NHWUgsS0FBSyxDQU1ILElBQUksQ0FBQztNQUNILE9BQU8sRUFBRSxJQUFLLEdBQ2Y7RXRHcEJILEdBQUcsQ3NHdUJILEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxPQUFPLEFBQVosR3RHdkJOLEdBQUcsQ3NHdUJrQixLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssTUFBTSxBQUFYLEd0R3ZCM0IsR0FBRyxDc0d1QnNDLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxVQUFVLEFBQWYsR3RHdkIvQyxHQUFHLENzR3VCOEQsS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLGdCQUFnQixBQUFyQixHdEd2QnZFLEdBQUcsQ3NHdUI0RixLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssT0FBTyxBQUFaLEd0R3ZCckcsR0FBRyxDc0d1QmlILEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxPQUFPLEFBQVosR3RHdkIxSCxHQUFHLENzR3VCc0ksS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLFFBQVEsQUFBYixHdEd2Qi9JLEdBQUcsQ3NHdUI0SixLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssVUFBVSxBQUFmLEd0R3ZCckssR0FBRyxDc0d1Qm9MLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxRQUFRLEFBQWIsR3RHdkI3TCxHQUFHLENzR3VCME0sS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLEtBQUssQUFBVixHdEd2Qm5OLEdBQUcsQ3NHdUI2TixLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssTUFBTSxBQUFYLEd0R3ZCdE8sR0FBRyxDc0d1QmlQLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxNQUFNLEFBQVgsR3RHdkIxUCxHQUFHLENzR3VCcVEsS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLEtBQUssQUFBVixHdEd2QjlRLEdBQUcsQ3NHdUJ3UixLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssTUFBTSxBQUFYLEd0R3ZCalMsR0FBRyxDc0d1QjRTLFFBQVE7RXRHdkJ2VCxHQUFHLENzR3dCSCxNQUFNLENBRE47SUFDRSxnQkFBZ0IsRUZNTSxLQUFLO0lFTDNCLE1BQU0sRUFBRSxpQkFBa0I7SUFDMUIsYUFBYSxFRlpNLEdBQUc7SUVhdEIsVUFBVSxFRitCTSxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQU0sbUJBQUs7SUU5QjFDLFVBQVUsRUFBRSxVQUFXO0lBQ3ZCLFdBQVcsRUY1Qk0sWUFBWTtJRTZCN0IsU0FBUyxFRjlCTSxJQUFJO0lFK0JuQixPQUFPLEVBQUUsT0FBYTtJQUN0QixVQUFVLEVBQUUsWUFBWSxDRmdDVixJQUFJLENBQ04sT0FBTztJRWhDbkIsU0FBUyxFQUFFLElBQUssR0FtQmpCO0l0R3BERCxHQUFHLENzR3VCSCxLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssT0FBTyxBQUFaLENBV0gsTUFBTSxFdEdsQ1QsR0FBRyxDc0d1QmtCLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxNQUFNLEFBQVgsQ0FXeEIsTUFBTSxFdEdsQ1QsR0FBRyxDc0d1QnNDLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxVQUFVLEFBQWYsQ0FXNUMsTUFBTSxFdEdsQ1QsR0FBRyxDc0d1QjhELEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxnQkFBZ0IsQUFBckIsQ0FXcEUsTUFBTSxFdEdsQ1QsR0FBRyxDc0d1QjRGLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxPQUFPLEFBQVosQ0FXbEcsTUFBTSxFdEdsQ1QsR0FBRyxDc0d1QmlILEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxPQUFPLEFBQVosQ0FXdkgsTUFBTSxFdEdsQ1QsR0FBRyxDc0d1QnNJLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxRQUFRLEFBQWIsQ0FXNUksTUFBTSxFdEdsQ1QsR0FBRyxDc0d1QjRKLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxVQUFVLEFBQWYsQ0FXbEssTUFBTSxFdEdsQ1QsR0FBRyxDc0d1Qm9MLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxRQUFRLEFBQWIsQ0FXMUwsTUFBTSxFdEdsQ1QsR0FBRyxDc0d1QjBNLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxLQUFLLEFBQVYsQ0FXaE4sTUFBTSxFdEdsQ1QsR0FBRyxDc0d1QjZOLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxNQUFNLEFBQVgsQ0FXbk8sTUFBTSxFdEdsQ1QsR0FBRyxDc0d1QmlQLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxNQUFNLEFBQVgsQ0FXdlAsTUFBTSxFdEdsQ1QsR0FBRyxDc0d1QnFRLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxLQUFLLEFBQVYsQ0FXM1EsTUFBTSxFdEdsQ1QsR0FBRyxDc0d1QndSLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxNQUFNLEFBQVgsQ0FXOVIsTUFBTSxFdEdsQ1QsR0FBRyxDc0d1QjRTLFFBQVEsQUFXcFQsTUFBTTtJdEdsQ1QsR0FBRyxDc0d3QkgsTUFBTSxBQVVILE1BQU0sQ0FBQztNQUNOLFlBQVksRXhGakJOLE9BQUcsR3dGa0JWO0l0R3BDSCxHQUFHLENzR3VCSCxLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssT0FBTyxBQUFaLENBZUgsTUFBTSxFdEd0Q1QsR0FBRyxDc0d1QmtCLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxNQUFNLEFBQVgsQ0FleEIsTUFBTSxFdEd0Q1QsR0FBRyxDc0d1QnNDLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxVQUFVLEFBQWYsQ0FlNUMsTUFBTSxFdEd0Q1QsR0FBRyxDc0d1QjhELEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxnQkFBZ0IsQUFBckIsQ0FlcEUsTUFBTSxFdEd0Q1QsR0FBRyxDc0d1QjRGLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxPQUFPLEFBQVosQ0FlbEcsTUFBTSxFdEd0Q1QsR0FBRyxDc0d1QmlILEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxPQUFPLEFBQVosQ0FldkgsTUFBTSxFdEd0Q1QsR0FBRyxDc0d1QnNJLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxRQUFRLEFBQWIsQ0FlNUksTUFBTSxFdEd0Q1QsR0FBRyxDc0d1QjRKLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxVQUFVLEFBQWYsQ0FlbEssTUFBTSxFdEd0Q1QsR0FBRyxDc0d1Qm9MLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxRQUFRLEFBQWIsQ0FlMUwsTUFBTSxFdEd0Q1QsR0FBRyxDc0d1QjBNLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxLQUFLLEFBQVYsQ0FlaE4sTUFBTSxFdEd0Q1QsR0FBRyxDc0d1QjZOLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxNQUFNLEFBQVgsQ0Flbk8sTUFBTSxFdEd0Q1QsR0FBRyxDc0d1QmlQLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxNQUFNLEFBQVgsQ0FldlAsTUFBTSxFdEd0Q1QsR0FBRyxDc0d1QnFRLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxLQUFLLEFBQVYsQ0FlM1EsTUFBTSxFdEd0Q1QsR0FBRyxDc0d1QndSLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxNQUFNLEFBQVgsQ0FlOVIsTUFBTSxFdEd0Q1QsR0FBRyxDc0d1QjRTLFFBQVEsQUFlcFQsTUFBTTtJdEd0Q1QsR0FBRyxDc0d3QkgsTUFBTSxBQWNILE1BQU0sQ0FBQztNQUNOLFlBQVksRUZuQlQsT0FBTztNRW9CVixVQUFVLEVGa0JJLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBTSxtQkFBSyxFQUNGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFNLHVCQUFNO01FbEJ6RCxPQUFPLEVBQUUsSUFBSyxHQUNmO0l0RzFDSCxHQUFHLENzR3VCSCxLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssT0FBTyxBQUFaLENBcUJILFNBQVMsRXRHNUNaLEdBQUcsQ3NHdUJrQixLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssTUFBTSxBQUFYLENBcUJ4QixTQUFTLEV0RzVDWixHQUFHLENzR3VCc0MsS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLFVBQVUsQUFBZixDQXFCNUMsU0FBUyxFdEc1Q1osR0FBRyxDc0d1QjhELEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxnQkFBZ0IsQUFBckIsQ0FxQnBFLFNBQVMsRXRHNUNaLEdBQUcsQ3NHdUI0RixLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssT0FBTyxBQUFaLENBcUJsRyxTQUFTLEV0RzVDWixHQUFHLENzR3VCaUgsS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLE9BQU8sQUFBWixDQXFCdkgsU0FBUyxFdEc1Q1osR0FBRyxDc0d1QnNJLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxRQUFRLEFBQWIsQ0FxQjVJLFNBQVMsRXRHNUNaLEdBQUcsQ3NHdUI0SixLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssVUFBVSxBQUFmLENBcUJsSyxTQUFTLEV0RzVDWixHQUFHLENzR3VCb0wsS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLFFBQVEsQUFBYixDQXFCMUwsU0FBUyxFdEc1Q1osR0FBRyxDc0d1QjBNLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxLQUFLLEFBQVYsQ0FxQmhOLFNBQVMsRXRHNUNaLEdBQUcsQ3NHdUI2TixLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssTUFBTSxBQUFYLENBcUJuTyxTQUFTLEV0RzVDWixHQUFHLENzR3VCaVAsS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLE1BQU0sQUFBWCxDQXFCdlAsU0FBUyxFdEc1Q1osR0FBRyxDc0d1QnFRLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxLQUFLLEFBQVYsQ0FxQjNRLFNBQVMsRXRHNUNaLEdBQUcsQ3NHdUJ3UixLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssTUFBTSxBQUFYLENBcUI5UixTQUFTLEV0RzVDWixHQUFHLENzR3VCNFMsUUFBUSxBQXFCcFQsU0FBUztJdEc1Q1osR0FBRyxDc0d3QkgsTUFBTSxBQW9CSCxTQUFTLENBQUM7TUFDVCxnQkFBZ0IsRXhGM0JWLE9BQUc7TXdGNEJULE1BQU0sRUFBRSxXQUFZLEdBS3JCO010R25ESCxHQUFHLENzR3VCSCxLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssT0FBTyxBQUFaLENBcUJILFNBQVMsQUFJUCxNQUFNLEV0R2hEWCxHQUFHLENzR3VCa0IsS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLE1BQU0sQUFBWCxDQXFCeEIsU0FBUyxBQUlQLE1BQU0sRXRHaERYLEdBQUcsQ3NHdUJzQyxLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssVUFBVSxBQUFmLENBcUI1QyxTQUFTLEFBSVAsTUFBTSxFdEdoRFgsR0FBRyxDc0d1QjhELEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxnQkFBZ0IsQUFBckIsQ0FxQnBFLFNBQVMsQUFJUCxNQUFNLEV0R2hEWCxHQUFHLENzR3VCNEYsS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLE9BQU8sQUFBWixDQXFCbEcsU0FBUyxBQUlQLE1BQU0sRXRHaERYLEdBQUcsQ3NHdUJpSCxLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssT0FBTyxBQUFaLENBcUJ2SCxTQUFTLEFBSVAsTUFBTSxFdEdoRFgsR0FBRyxDc0d1QnNJLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxRQUFRLEFBQWIsQ0FxQjVJLFNBQVMsQUFJUCxNQUFNLEV0R2hEWCxHQUFHLENzR3VCNEosS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLFVBQVUsQUFBZixDQXFCbEssU0FBUyxBQUlQLE1BQU0sRXRHaERYLEdBQUcsQ3NHdUJvTCxLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssUUFBUSxBQUFiLENBcUIxTCxTQUFTLEFBSVAsTUFBTSxFdEdoRFgsR0FBRyxDc0d1QjBNLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxLQUFLLEFBQVYsQ0FxQmhOLFNBQVMsQUFJUCxNQUFNLEV0R2hEWCxHQUFHLENzR3VCNk4sS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLE1BQU0sQUFBWCxDQXFCbk8sU0FBUyxBQUlQLE1BQU0sRXRHaERYLEdBQUcsQ3NHdUJpUCxLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssTUFBTSxBQUFYLENBcUJ2UCxTQUFTLEFBSVAsTUFBTSxFdEdoRFgsR0FBRyxDc0d1QnFRLEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxLQUFLLEFBQVYsQ0FxQjNRLFNBQVMsQUFJUCxNQUFNLEV0R2hEWCxHQUFHLENzR3VCd1IsS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLE1BQU0sQUFBWCxDQXFCOVIsU0FBUyxBQUlQLE1BQU0sRXRHaERYLEdBQUcsQ3NHdUI0UyxRQUFRLEFBcUJwVCxTQUFTLEFBSVAsTUFBTTtNdEdoRFgsR0FBRyxDc0d3QkgsTUFBTSxBQW9CSCxTQUFTLEFBSVAsTUFBTSxDQUFDO1FBQ04sTUFBTSxFRkVFLEdBQUcsQ0FBQyxLQUFLLENBM0JWLElBQUksR0UwQlo7RXRHbERMLEdBQUcsQ3NHc0RILFFBQVEsQ0FBQztJQUNQLEtBQUssRUFBRSxJQUFLO0lBQ1osTUFBTSxFQUFFLFFBQVMsR0FDbEI7RXRHekRELEdBQUcsQ3NHMkRILEtBQUssQ0FBQSxBQUFBLElBQUMsQ0FBSyxRQUFRLEFBQWIsRUFBZTtJQUNuQixVQUFVLEVBQUUsSUFBSyxHQUNsQjtFdEc3REQsR0FBRyxDc0crREgsS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLFVBQVUsQUFBZjtFdEcvRE4sR0FBRyxDc0dnRUgsS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLE9BQU8sQUFBWixFQUFjO0lBQ2xCLE9BQU8sRUFBRSxNQUFPO0lBQ2hCLFlBQVksRUFBRSxPQUFjLEdBSzdCO0l0R3ZFRCxHQUFHLENzRytESCxLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssVUFBVSxBQUFmLElBS0YsS0FBSztJdEdwRVQsR0FBRyxDc0dnRUgsS0FBSyxDQUFBLEFBQUEsSUFBQyxDQUFLLE9BQU8sQUFBWixJQUlGLEtBQUssQ0FBQztNQUNOLE9BQU8sRUFBRSxZQUFhLEdBQ3ZCO0V0R3RFSCxHQUFHLENzR3lFSCxLQUFLLENBQUEsQUFBQSxJQUFDLENBQUssTUFBTSxBQUFYLEVBQWE7SUFDakIsS0FBSyxFQUFFLElBQUssR0FDYjtFdEczRUQsR0FBRyxDc0c2RUgsTUFBTSxDQUFDO0lBQ0wsU0FBUyxFQUFFLElBQUs7SUFDaEIsS0FBSyxFQUFFLElBQUssR0FDYjtFdEdoRkQsR0FBRyxDc0drRkgsVUFBVSxDQUFBO0lBQ1IsS0FBSyxFQUFFLElBQUs7SUFDWixLQUFLLEVBQUUsSUFBSztJQU1aLGFBQWEsRUFBRSxNQUFhLEdBbUI3QjtJUHZERyxNQUFNLENBQU4sTUFBTSxNQUFNLFNBQVMsRUFBRSxLQUFLO00vRnREaEMsR0FBRyxDc0drRkgsVUFBVSxDQUFBO1FBSU4sT0FBTyxFQUFFLElBQUs7UUFDZCxXQUFXLEVBQUUsTUFBTztRQUNwQixlQUFlLEVBQUUsTUFBTyxHQXFCM0I7SXRHN0dELEdBQUcsQ3NHa0ZILGlCQUFVLENBU0E7TUFDTixLQUFLLEVBQUUsSUFBSyxHQUliO01QMUNDLE1BQU0sQ0FBTixNQUFNLE1BQU0sU0FBUyxFQUFFLEtBQUs7US9GdERoQyxHQUFHLENzR2tGSCxpQkFBVSxDQVNBO1VBR0osS0FBSyxFQUFFLEdBQUksR0FFZDtJdEdoR0gsR0FBRyxDc0drRkgsaUJBQVUsQ0FnQkE7TUFDTixLQUFLLEVBQUUsSUFBSztNQUNaLGNBQWMsRUFBRSxNQUFhLEdBUTlCO01QdERDLE1BQU0sQ0FBTixNQUFNLE1BQU0sU0FBUyxFQUFFLEtBQUs7US9GdERoQyxHQUFHLENzR2tGSCxpQkFBVSxDQWdCQTtVQUtKLE9BQU8sRUFBRSxDQUFFO1VBQ1gsS0FBSyxFQUFFLEdBQUk7VUFDWCxVQUFVLEVBQUUsS0FBTTtVQUNsQixZQUFZLEVGM0ZILEtBQWlCLEdFNkY3QjtFdEc1R0gsR0FBRyxDc0crR0gsWUFBWSxDQUFBO0lBT1YsT0FBTyxFQUFFLE9BQWEsQ0FBRyxDQUFDLENBQUMsTUFBYSxDQUFHLENBQUMsR0FDN0M7SXRHdkhELEdBQUcsQ3NHK0dILG1CQUFZLENBQ0Y7TUFDTixjQUFjLEVBQUUsTUFBYSxHQUM5QjtFdEdsSEgsR0FBRyxDdUdISCxFQUFFLENBQUM7SUFDRCxNQUFNLEVBQUUsQ0FBRTtJQUNWLE9BQU8sRUFBRSxDQUFFO0lBQ1gsU0FBUyxFSEVJLElBQWUsR0dEN0I7RXZHREQsR0FBRyxDdUdHSCxFQUFFLENBQUM7SUFDRCxNQUFNLEVBQUUsQ0FBRTtJQUNWLE9BQU8sRUFBRSxDQUFFO0lBQ1gsU0FBUyxFSEhJLE1BQWUsR0dJN0I7RXZHUEQsR0FBRyxDdUdTSCxFQUFFLENBQUM7SUFDRCxNQUFNLEVBQUUsQ0FBRTtJQUNWLE9BQU8sRUFBRSxDQUFFO0lBQ1gsU0FBUyxFSFJJLElBQWUsR0dTN0I7RXZHYkQsR0FBRyxDdUdlSCxFQUFFLENBQUM7SUFDRCxNQUFNLEVBQUUsQ0FBRTtJQUNWLE9BQU8sRUFBRSxDQUFFO0lBQ1gsU0FBUyxFSGJJLE1BQWUsR0djN0I7RXZHbkJELEdBQUcsQ3VHcUJILEVBQUUsQ0FBQztJQUNELE1BQU0sRUFBRSxDQUFFO0lBQ1YsT0FBTyxFQUFFLENBQUU7SUFDWCxTQUFTLEVIbEJJLE9BQWUsR0dtQjdCO0V2R3pCRCxHQUFHLEN1RzJCSCxFQUFFLENBQUM7SUFDRCxNQUFNLEVBQUUsQ0FBRTtJQUNWLE9BQU8sRUFBRSxDQUFFO0lBQ1gsU0FBUyxFSDlCTSxJQUFJLEdHK0JwQjtFdkcvQkQsR0FBRyxDd0dKSCx3QkFBd0IsQ0FBQztJQUV2QixhQUFhLEVKaUJBLEtBQWlCO0lJaEI5QixRQUFRLEVBQUUsTUFBTztJQUNqQixPQUFPLEVBQUUsSUFBSyxHQTBGZjtJeEcxRkQsR0FBRyxDd0dKSCx3QkFBd0IsQXhDbUJyQixPQUFPLENBQUM7TUFDUCxLQUFLLEVBQUUsSUFBSztNQUNaLE9BQU8sRUFBRSxFQUFHO01BQ1osT0FBTyxFQUFFLEtBQU0sR0FDaEI7SWhFbkJILEdBQUcsQ3dHSkgsd0JBQXdCLENBS3RCLGNBQWMsQ0FBQztNQUNiLE9BQU8sRUFBRSxDQUFFO01BQ1gsTUFBTSxFQUFFLENBQUU7TUFDVixPQUFPLEVBQUUsTUFBTztNQUNoQixLQUFLLEVBQUUsSUFBSztNQUNaLEtBQUssRUFBRSxHQUFJO01BQ1gsVUFBVSxFQUFFLElBQUs7TUFDakIsWUFBWSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENKZ0JkLElBQUksR0lmZDtJeEdUSCxHQUFHLEN3R0pILHdCQUF3QixDQWV0QixFQUFFLEFBQ0MsT0FBTyxDQUFDO01BQ1AsZ0JBQWdCLEVBQUUsS0FBTTtNQUN4QixZQUFZLEVBQUUsSUFBSztNQUNuQixNQUFNLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0pTVixJQUFJO01JUlgsa0JBQWtCLEVBQUUsS0FBTSxHQU8zQjtNeEd2QkwsR0FBRyxDd0dKSCx3QkFBd0IsQ0FldEIsRUFBRSxBQUNDLE9BQU8sQ0FLTixXQUFXLENBQUE7UUFDVCxLQUFLLEVKRU4sT0FBTyxHSURQO014R25CUCxHQUFHLEN3R0pILHdCQUF3QixDQWV0QixFQUFFLEFBQ0MsT0FBTyxDQVFOLGVBQWUsQ0FBQTtRQUNiLEtBQUssRUpBRCxJQUFJLEdJQ1Q7SXhHdEJQLEdBQUcsQ3dHSkgsd0JBQXdCLENBZXRCLEVBQUUsQ0FjQSxDQUFDLENBQUM7TUFDQSxPQUFPLEVBQUUsTUFBYSxDQUFHLE9BQU87TUFDaEMsZUFBZSxFQUFFLElBQUs7TUFDdEIsS0FBSyxFQUFFLE9BQVE7TUFDZixPQUFPLEVBQUUsS0FBTSxHQUNoQjtJeEc5QkwsR0FBRyxDd0dKSCx3QkFBd0IsQ0FldEIsRUFBRSxDQW9CQSxFQUFFLENBQUE7TUFDQSxVQUFVLEVBQUUsSUFBSztNQUNqQixPQUFPLEVBQUUsQ0FBRTtNQUNYLE1BQU0sRUFBRSxDQUFFLEdBS1g7TXhHdkNMLEdBQUcsQ3dHSkgsd0JBQXdCLENBZXRCLEVBQUUsQ0FvQkEsRUFBRSxDQUlBLEVBQUUsQ0FBQTtRQUNBLGNBQWMsRUFBRSxHQUFJO1FBQ3BCLFlBQVksRUFBRSxJQUFLLEdBQ3BCO0l4R3RDUCxHQUFHLEN3R0pILHdCQUF3QixDQThDdEIsYUFBYSxBQUFBLE1BQU0sQ0FBQztNQUNsQixPQUFPLEVBQUUsSUFBSyxHQUVmO0l4RzdDSCxHQUFHLEN3R0pILHdCQUF3QixDQW1EdEIsK0JBQStCLENBQUM7TUFDOUIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENKeEJSLElBQUk7TUl5QmIsV0FBVyxFQUFFLElBQUs7TUFDbEIsT0FBTyxFQUFFLFlBQWE7TUFDdEIsS0FBSyxFQUFFLEdBQUk7TUFDWCxnQkFBZ0IsRUFBRSxLQUFNO01BQ3hCLE1BQU0sRUFBRSxNQUFPLEdBTWhCO014RzNESCxHQUFHLEN3R0pILHdCQUF3QixDQW1EdEIsK0JBQStCLENBUTNCLENBQUMsQUFBQSxNQUFNLENBQUM7UUFDUixPQUFPLEVBQUUsSUFBSyxHQUNmO0l4R3pETCxHQUFHLEN3R0pILHdCQUF3QixDQWlFdEIscUJBQXFCLENBQUM7TUFDcEIsT0FBTyxFQUFFLFlBQWE7TUFDdEIsZ0JBQWdCLEVBQUUsS0FBTTtNQUN4QixPQUFPLEVKakRJLEtBQWlCLENqRnlCbEIsT0FBRztNcUZ5QmIsTUFBTSxFQUFFLElBQUs7TUFDYixLQUFLLEVBQUUsSUFBSyxHQUNiO0l4R25FSCxHQUFHLEN3R0pILHdCQUF3QixDQXlFdEIsK0JBQStCLENBQUM7TUFDOUIsVUFBVSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENKOUNaLElBQUk7TUkrQ2IsTUFBTSxFQUFFLE9BQVE7TUFDaEIsT0FBTyxFQUFFLEtBQU07TUFDZixXQUFXLEVBQUUsSUFBSztNQUNsQixPQUFPLEVBQUUsTUFBYSxDQUFHLE9BQU8sR0FlakM7TXhHekZILEdBQUcsQ3dHSkgsd0JBQXdCLENBeUV0QiwrQkFBK0IsQUFPNUIsTUFBTSxDQUFDO1FBQ04sS0FBSyxFSnpESixPQUFPLEdJMERUO014RzlFTCxHQUFHLEN3R0pILHdCQUF3QixDQXlFdEIsK0JBQStCLEFBVzVCLFlBQVksQ0FBQztRQUNaLFVBQVUsRUFBRSxJQUFLLEdBQ2xCO014R2xGTCxHQUFHLEN3R0pILHdCQUF3QixDQXlFdEIsK0JBQStCLEFBZTVCLE9BQU8sQ0FBQztRQUNQLFVBQVUsRUFBRSxLQUFNO1FBQ2xCLGFBQWEsRUFBRSxJQUFLLEdBQ3JCO0V4R3ZGTCxHQUFHLEN5R0pILHVCQUF1QixDQUFDO0lBQ3RCLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBYTtJQUV2QixXQUFXLEVBQUUsR0FBSTtJQUNqQixPQUFPLEVBQUUsQ0FBRSxHQTJDWjtJekczQ0QsR0FBRyxDeUdKSCx1QkFBdUIsQXpDbUJwQixPQUFPLENBQUM7TUFDUCxLQUFLLEVBQUUsSUFBSztNQUNaLE9BQU8sRUFBRSxFQUFHO01BQ1osT0FBTyxFQUFFLEtBQU0sR0FDaEI7SWhFbkJILEdBQUcsQ3lHSkgsdUJBQXVCLENBS3JCLEVBQUUsQUFBQSxTQUFTLENBQUM7TUFDVixNQUFNLEVBQUUsQ0FBRTtNQUNWLE9BQU8sRUFBRSxDQUFFLEdBQ1o7SXpHSkgsR0FBRyxDeUdKSCx1QkFBdUIsQ0FTckIsRUFBRSxBQUFBLHVCQUF1QixDQUFDO01BQ3hCLFVBQVUsRUFBRSxJQUFLO01BQ2pCLE9BQU8sRUFBRSxNQUFPLEdBQ2pCO0l6R1JILEdBQUcsQ3lHSkgsdUJBQXVCLENBY3JCLFNBQVMsQ0FBQztNQUNSLFVBQVUsRUFBRSxHQUFHLENBQUMsS0FBSyxDTGFaLElBQUk7TUtaYixPQUFPLEVBQUUsWUFBYTtNQUN0QixVQUFVLEVBQUUsQ0FBRSxHQW9CZjtNekdqQ0gsR0FBRyxDeUdKSCx1QkFBdUIsQ0FjckIsU0FBUyxDQUlQLENBQUMsQ0FBQztRQUNBLGVBQWUsRUFBRSxJQUFLO1FBQ3RCLE9BQU8sRUFBRSxLQUFNO1FBQ2YsT0FBTyxFQUFHLE1BQWEsQ3RGdUJmLE9BQUcsR3NGUlo7UXpHaENMLEdBQUcsQ3lHSkgsdUJBQXVCLENBY3JCLFNBQVMsQ0FJUCxDQUFDLEFBS0UsTUFBTSxDQUFDO1VBQ04sS0FBSyxFTG1CTSxPQUFNLEdLbEJsQjtRekdyQlAsR0FBRyxDeUdKSCx1QkFBdUIsQ0FjckIsU0FBUyxDQUlQLENBQUMsQUFRRSxNQUFNLENBQUM7VUFDTixPQUFPLEVBQUUsSUFBSyxHQUNmO1F6R3hCUCxHQUFHLEN5R0pILHVCQUF1QixDQWNyQixTQUFTLENBSVAsQ0FBQyxBQVdFLFVBQVUsQ0FBQztVQUNWLE1BQU0sRUFBRSxHQUFHLENBQUMsS0FBSyxDTEZaLElBQUk7VUtHVCxtQkFBbUIsRUFBRSxLQUFNO1VBQzNCLFVBQVUsRUFBRSxLQUFNO1VBQ2xCLGFBQWEsRUFBRSxJQUFLO1VBQ3BCLEtBQUssRUxWTixPQUFPLEdLV1A7SXpHL0JQLEdBQUcsQ3lHSkgsdUJBQXVCLENBdUNyQixZQUFZLENBQUM7TUFDWCxNQUFNLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0xaUixJQUFJO01LYWIsT0FBTyxFTHRCSSxLQUFpQixDakZ5QmxCLE9BQUc7TXNGRmIsS0FBSyxFQUFFLElBQUs7TUFDWixLQUFLLEVBQUUsSUFBSztNQUNaLFVBQVUsRUFBRSxLQUFNO01BQ2xCLFVBQVUsRUFBRSxLQUFNLEdBQ25CO0V6RzFDSCxHQUFHLEMwRzRDSCxJQUFJLENBQUM7SUFDSCxPQUFPLEVBQUUsWUFBYTtJQUFFLFNBQVM7SUFDakMsY0FBYyxFQUFFLE1BQU87SUFBRSxTQUFTO0lBQ2xDLFdBQVcsRUFBRSxNQUFPO0lBQUUsU0FBUztJQUMvQixXQUFXLEVBQUUsT0FBUTtJQUFFLFNBQVM7SUFDaEMsU0FBUyxFQUFFLElBQUs7SUFBRSxTQUFTO0lBQzNCLE1BQU0sRUFBRSxPQUFRO0lBQUUsU0FBUztJQUMzQixNQUFNLEVBQUUsSUFBSztJQUFFLFNBQVM7SUFDeEIsTUFBTSxFQUFFLENBQUU7SUFBRSxTQUFTO0lBQ3JCLFdBQVcsRUFBRSxDQUFFO0lBQUUsU0FBUztJQUMxQixjQUFjLEVBQUUsQ0FBRTtJQUFFLFNBQVM7SUFDN0IsV0FBVyxFQUFFLENBQUU7SUFBRSxTQUFTO0lBQzFCLGFBQWEsRUFBRSxHQUFJO0lBQUUsU0FBUztJQUM5QixZQUFZLEVBQUUsR0FBSTtJQUFFLFNBQVM7SUFDN0IsYUFBYSxFQUFFLEdBQUk7SUFBRSxTQUFTO0lBQzlCLFVBQVUsRU52Q0wsT0FBTztJTXdDWixLQUFLLEVBQUUsS0FBTSxHQUNkO0UxRzdERCxHQUFHLEMwRytESCxJQUFJLEUxRy9ESixHQUFHLEMwRytESCxJQUFJLEFBR0QsTUFBTSxDQUFDO0lBQ04sZUFBZSxFQUFFLElBQUs7SUFBRSxTQUFTO0lBQ2pDLFVBQVUsRU43QkssT0FBTSxHTThCdEI7RTFHckVILEdBQUcsQzBHK0RILElBQUksQUFRRCxPQUFPLEUxR3ZFVixHQUFHLEMwRytESCxJQUFJLEFBU0QsTUFBTSxDQUFDO0lBQ04sT0FBTyxFQUFFLElBQUssR0FDZjtFMUcxRUgsR0FBRyxDMEdzRkgsV0FBVyxDQUFDO0lBQ1YsYUFBYSxFQUFFLEtBQU07SUFDckIsWUFBWSxFQUFFLEtBQU07SUFDcEIsV0FBVyxFQUFFLENBQUUsR0FDaEI7RTFHMUZELEdBQUcsQzBHNEZILFdBQVcsQ0FBQztJQUNWLGFBQWEsRUFBRSxLQUFNO0lBQ3JCLFlBQVksRUFBRSxLQUFNO0lBQ3BCLFdBQVcsRUFBRSxDQUFFLEdBQ2hCO0UxR2hHRCxHQUFHLEMwR2tHSCxVQUFVLENBQUM7SUFDVCxhQUFhLEVBQUUsR0FBSTtJQUNuQixZQUFZLEVBQUUsR0FBSTtJQUNsQixXQUFXLEVBQUUsQ0FBRSxHQUNoQjtFMUd0R0QsR0FBRyxDMEc2R0gsVUFBVSxDQUFDO0lBQ1QsS0FBSyxFQUFFLElBQUs7SUFDWixhQUFhLEVBQUUsQ0FBRTtJQUFFLFNBQVM7SUFDNUIsWUFBWSxFQUFFLENBQUU7SUFBRSxTQUFTO0lBQzNCLFVBQVUsRUFBRSxNQUFPLEdBQ3BCO0UxR2xIRCxHQUFHLEMwRzBISCxXQUFXLENBQUM7SUFDVixTQUFTLEVBQUUsSUFBSyxHQUNqQjtFMUc1SEQsR0FBRyxDMEc4SEgsVUFBVSxDQUFDO0lBQ1QsU0FBUyxFQUFFLElBQUssR0FDakI7RTFHaElELEdBQUcsQzBHa0lILFdBQVcsQ0FBQztJQUNWLFNBQVMsRUFBRSxJQUFLLEdBQ2pCO0UxR3BJRCxHQUFHLEMwR3lJSCxhQUFhLENBQUM7SUFDWixjQUFjLEVBQUUsUUFBUztJQUN6QixTQUFTLEVBQUUsT0FBUTtJQUNuQixXQUFXLEVBQUUsT0FBUTtJQUNyQixhQUFhLEVBQUUsS0FBTTtJQUNyQixZQUFZLEVBQUUsS0FBTSxHQUNyQjtFMUcvSUQsR0FBRyxDMEdtS0gsY0FBYyxDQUFDO0lBQ2IsZ0JBQWdCLEVBQUUsT0FBUTtJQUMxQixLQUFLLEVBQUUsSUFBSyxHQUNiO0UxR3RLRCxHQUFHLEMwRzJLSCxjQUFjLENBQUM7SUFDYixnQkFBZ0IsRUFBRSxPQUFRO0lBQzFCLEtBQUssRUFBRSxJQUFLLEdBQ2I7RTFHOUtELEdBQUcsQzBHcUxILGNBQWM7RTFHckxkLEdBQUcsQzBHc0xILGNBQWMsQUFBQSxNQUFNO0UxR3RMcEIsR0FBRyxDMEd1TEgsY0FBYyxBQUFBLE9BQU87RTFHdkxyQixHQUFHLEMwR3dMSCxjQUFjLEFBQUEsTUFBTSxDQUFDO0lBQ25CLGdCQUFnQixFQUFFLElBQUs7SUFDdkIsS0FBSyxFQUFFLElBQUs7SUFDWixNQUFNLEVBQUUsSUFBSztJQUFFLFNBQVMsRUFDekI7RTFHNUxELEdBQUcsQzBHc01ILFVBQVUsQ0FBQztJQUNULGFBQWEsRUFBRSxLQUFNO0lBQUUsU0FBUyxFQUNqQztFMUd4TUQsR0FBRyxDMEcwTUgsVUFBVSxDQUFDO0lBQ1QsYUFBYSxFQUFFLENBQUUsR0FDbEI7RVh0SkcsTUFBTSxDQUFOLE1BQU0sTUFBTSxTQUFTLEVBQUUsS0FBSztJL0Z0RGhDLEdBQUcsQzJHSkgsS0FBSyxDQUFDO01BRUYsS0FBSyxFQUFFLEdBQUk7TUFDWCxZQUFZLEVBQUUsRUFBRztNQUNqQixLQUFLLEVBQUUsSUFBSyxHQUVmO0Vab0RHLE1BQU0sQ0FBTixNQUFNLE1BQU0sU0FBUyxFQUFFLEtBQUs7SS9GdERoQyxHQUFHLEMyR0lILE1BQU0sQ0FBQztNQUVILEtBQUssRUFBRSxHQUFJO01BQ1gsS0FBSyxFQUFFLElBQUssR0FFZjtFM0dURCxHQUFHLEM0R0pILFdBQVcsQ0FBQTtJQUNULE9BQU8sRUFBRSxDQUFFO0lBQ1gsTUFBTSxFQUFFLENBQUU7SUFDVixPQUFPLEVBQUUsS0FBTSxHQWFoQjtJNUdaRCxHQUFHLEM0R0pILGlCQUFXLENBSUY7TUFDTCxNQUFNLEVBQUUsbUJBQW9CO01BQzVCLGNBQWMsRUFBRSxJQUFLO01BQ3JCLE1BQU0sRUFBRSxPQUFRO01BQ2hCLE9BQU8sRUFBRSxZQUFhLEdBQ3ZCO0k1R0xILEdBQUcsQzRHSkgsa0JBQVcsQzVHSVgsR0FBRyxDNEdKSCxpQkFBVyxDQWFPO01BQ2QsYUFBYSxFQUFFLFNBQVUsR0FDMUI7RTVHWEgsR0FBRyxDNkdjSCxhQUFhLENBQUc7SUFBRSxLQUFLLEVBQUMsS0FBSyxDQUFBLFVBQVUsR0FBSTtFN0dkM0MsR0FBRyxDNkdlSCxZQUFZLENBQUk7SUFBRSxLQUFLLEVBQUMsZUFBZ0IsR0FBSTtFN0dmNUMsR0FBRyxDNkdnQkgsWUFBWSxDQUFJO0lBQUUsS0FBSyxFQUFDLGVBQWdCLEdBQUk7RTdHaEI1QyxHQUFHLEM2R3NCSCxXQUFXLENBQUs7SUFBRSxVQUFVLEVBQUMsZ0JBQWlCLEdBQUk7RTdHdEJsRCxHQUFHLEM2R3VCSCxhQUFhLENBQUc7SUFBRSxVQUFVLEVBQUMsTUFBTSxDQUFBLFVBQVUsR0FBSTtFN0d2QmpELEdBQUcsQzZHd0JILFlBQVksQ0FBSTtJQUFFLFVBQVUsRUFBQyxnQkFBaUIsR0FBSTtFN0d4QmxELEdBQUcsQzZHOEJILGNBQWMsQ0FBTTtJQUFFLFdBQVcsRUFBQyxHQUFHLENBQUEsVUFBVSxHQUFJO0U3RzlCbkQsR0FBRyxDNkcrQkgsZUFBZSxDQUFLO0lBQUUsV0FBVyxFQUFDLEdBQUcsQ0FBQSxVQUFVLEdBQUk7RTdHL0JuRCxHQUFHLEM2R2dDSCxpQkFBaUIsQ0FBRztJQUFFLFdBQVcsRUFBQyxHQUFHLENBQUEsVUFBVSxHQUFJO0U3R2hDbkQsR0FBRyxDNkdzQ0gsS0FBSyxDQUFXO0lBQUUsTUFBTSxFVHZCVCxLQUFpQixDU3VCYSxVQUFVLEdBQUk7RTdHdEMzRCxHQUFHLEM2R3VDSCxVQUFVLENBQU07SUFBRSxVQUFVLEVUeEJiLEtBQWlCLENTd0JhLFVBQVUsR0FBSTtFN0d2QzNELEdBQUcsQzZHd0NILFlBQVksQ0FBSTtJQUFFLFlBQVksRVR6QmYsS0FBaUIsQ1N5QmEsVUFBVSxHQUFJO0U3R3hDM0QsR0FBRyxDNkd5Q0gsYUFBYSxDQUFHO0lBQUUsYUFBYSxFVDFCaEIsS0FBaUIsQ1MwQmEsVUFBVSxHQUFJO0U3R3pDM0QsR0FBRyxDNkcwQ0gsV0FBVyxDQUFLO0lBQUUsV0FBVyxFVDNCZCxLQUFpQixDUzJCYSxVQUFVLEdBQUk7RTdHMUMzRCxHQUFHLEM2RzJDSCxXQUFXLENBQUs7SUFBRSxVQUFVLEVUNUJiLEtBQWlCLENTNEJhLFVBQVU7SUFBRSxhQUFhLEVUNUJ2RCxLQUFpQixDUzRCb0QsVUFBVSxHQUFJO0U3RzNDbEcsR0FBRyxDNkc0Q0gsWUFBWSxDQUFJO0lBQUUsWUFBWSxFVDdCZixLQUFpQixDUzZCYSxVQUFVO0lBQUUsV0FBVyxFVDdCckQsS0FBaUIsQ1M2Qm9ELFVBQVUsR0FBSTtFN0c1Q2xHLEdBQUcsQzZHOENILFVBQVUsQ0FBVTtJQUFFLE1BQU0sRVQ3QlosTUFBYSxDUzZCcUIsVUFBVSxHQUFJO0U3RzlDaEUsR0FBRyxDNkcrQ0gsZUFBZSxDQUFLO0lBQUUsVUFBVSxFVDlCaEIsTUFBYSxDUzhCcUIsVUFBVSxHQUFJO0U3Ry9DaEUsR0FBRyxDNkdnREgsaUJBQWlCLENBQUc7SUFBRSxZQUFZLEVUL0JsQixNQUFhLENTK0JxQixVQUFVLEdBQUk7RTdHaERoRSxHQUFHLEM2R2lESCxrQkFBa0IsQ0FBRTtJQUFFLGFBQWEsRVRoQ25CLE1BQWEsQ1NnQ3FCLFVBQVUsR0FBSTtFN0dqRGhFLEdBQUcsQzZHa0RILGdCQUFnQixDQUFJO0lBQUUsV0FBVyxFVGpDakIsTUFBYSxDU2lDcUIsVUFBVSxHQUFJO0U3R2xEaEUsR0FBRyxDNkdtREgsZ0JBQWdCLENBQUk7SUFBRSxVQUFVLEVUbENoQixNQUFhLENTa0NxQixVQUFVO0lBQUUsYUFBYSxFVGxDM0QsTUFBYSxDU2tDNkQsVUFBVSxHQUFJO0U3R25EeEcsR0FBRyxDNkdvREgsaUJBQWlCLENBQUc7SUFBRSxZQUFZLEVUbkNsQixNQUFhLENTbUNxQixVQUFVO0lBQUUsV0FBVyxFVG5DekQsTUFBYSxDU21DNkQsVUFBVSxHQUFJO0U3R3BEeEcsR0FBRyxDNkdzREgsTUFBTSxDQUFVO0lBQUUsTUFBTSxFQUFRLENBQUMsQ0FBQSxVQUFVLEdBQUk7RTdHdEQvQyxHQUFHLEM2R3VESCxXQUFXLENBQUs7SUFBRSxVQUFVLEVBQUksQ0FBQyxDQUFBLFVBQVUsR0FBSTtFN0d2RC9DLEdBQUcsQzZHd0RILGFBQWEsQ0FBRztJQUFFLFlBQVksRUFBRSxDQUFDLENBQUEsVUFBVSxHQUFJO0U3R3hEL0MsR0FBRyxDNkd5REgsY0FBYyxDQUFFO0lBQUUsYUFBYSxFQUFDLENBQUMsQ0FBQSxVQUFVLEdBQUk7RTdHekQvQyxHQUFHLEM2RzBESCxZQUFZLENBQUk7SUFBRSxXQUFXLEVBQUcsQ0FBQyxDQUFBLFVBQVUsR0FBSTtFN0cxRC9DLEdBQUcsQzZHMkRILFlBQVksQ0FBSTtJQUFFLFVBQVUsRUFBSSxDQUFDLENBQUEsVUFBVTtJQUFFLGFBQWEsRUFBQyxDQUFDLENBQUEsVUFBVSxHQUFJO0U3RzNEMUUsR0FBRyxDNkc0REgsYUFBYSxDQUFHO0lBQUUsWUFBWSxFQUFFLENBQUMsQ0FBQSxVQUFVO0lBQUUsV0FBVyxFQUFHLENBQUMsQ0FBQSxVQUFVLEdBQUk7RTdHNUQxRSxHQUFHLEM2R2tFSCxLQUFLLENBQVc7SUFBRSxPQUFPLEVUbkRWLEtBQWlCLENTbURjLFVBQVUsR0FBSTtFN0dsRTVELEdBQUcsQzZHbUVILFVBQVUsQ0FBTTtJQUFFLFdBQVcsRVRwRGQsS0FBaUIsQ1NvRGMsVUFBVSxHQUFJO0U3R25FNUQsR0FBRyxDNkdvRUgsWUFBWSxDQUFJO0lBQUUsYUFBYSxFVHJEaEIsS0FBaUIsQ1NxRGMsVUFBVSxHQUFJO0U3R3BFNUQsR0FBRyxDNkdxRUgsYUFBYSxDQUFHO0lBQUUsY0FBYyxFVHREakIsS0FBaUIsQ1NzRGMsVUFBVSxHQUFJO0U3R3JFNUQsR0FBRyxDNkdzRUgsV0FBVyxDQUFLO0lBQUUsWUFBWSxFVHZEZixLQUFpQixDU3VEYyxVQUFVLEdBQUk7RTdHdEU1RCxHQUFHLEM2R3VFSCxXQUFXLENBQUs7SUFBRSxXQUFXLEVUeERkLEtBQWlCLENTd0RjLFVBQVU7SUFBRSxjQUFjLEVUeER6RCxLQUFpQixDU3dEc0QsVUFBVSxHQUFJO0U3R3ZFcEcsR0FBRyxDNkd3RUgsWUFBWSxDQUFJO0lBQUUsYUFBYSxFVHpEaEIsS0FBaUIsQ1N5RGMsVUFBVTtJQUFFLFlBQVksRVR6RHZELEtBQWlCLENTeURzRCxVQUFVLEdBQUk7RTdHeEVwRyxHQUFHLEM2RzBFSCxVQUFVLENBQVc7SUFBRSxPQUFPLEVUekRkLE1BQWEsQ1N5RHVCLFVBQVUsR0FBSTtFN0cxRWxFLEdBQUcsQzZHMkVILGVBQWUsQ0FBTTtJQUFFLFdBQVcsRVQxRGxCLE1BQWEsQ1MwRHVCLFVBQVUsR0FBSTtFN0czRWxFLEdBQUcsQzZHNEVILGlCQUFpQixDQUFJO0lBQUUsYUFBYSxFVDNEcEIsTUFBYSxDUzJEdUIsVUFBVSxHQUFJO0U3RzVFbEUsR0FBRyxDNkc2RUgsa0JBQWtCLENBQUc7SUFBRSxjQUFjLEVUNURyQixNQUFhLENTNER1QixVQUFVLEdBQUk7RTdHN0VsRSxHQUFHLEM2RzhFSCxnQkFBZ0IsQ0FBSztJQUFFLFlBQVksRVQ3RG5CLE1BQWEsQ1M2RHVCLFVBQVUsR0FBSTtFN0c5RWxFLEdBQUcsQzZHK0VILGdCQUFnQixDQUFLO0lBQUUsV0FBVyxFVDlEbEIsTUFBYSxDUzhEdUIsVUFBVTtJQUFFLGNBQWMsRVQ5RDlELE1BQWEsQ1M4RGdFLFVBQVUsR0FBSTtFN0cvRTNHLEdBQUcsQzZHZ0ZILGlCQUFpQixDQUFJO0lBQUUsYUFBYSxFVC9EcEIsTUFBYSxDUytEdUIsVUFBVTtJQUFFLFlBQVksRVQvRDVELE1BQWEsQ1MrRGdFLFVBQVUsR0FBSTtFN0doRjNHLEdBQUcsQzZHa0ZILEtBQUssQ0FBVztJQUFFLE9BQU8sRUFBUSxDQUFDLENBQUEsVUFBVSxHQUFJO0U3R2xGaEQsR0FBRyxDNkdtRkgsVUFBVSxDQUFNO0lBQUUsV0FBVyxFQUFJLENBQUMsQ0FBQSxVQUFVLEdBQUk7RTdHbkZoRCxHQUFHLEM2R29GSCxZQUFZLENBQUk7SUFBRSxhQUFhLEVBQUUsQ0FBQyxDQUFBLFVBQVUsR0FBSTtFN0dwRmhELEdBQUcsQzZHcUZILGFBQWEsQ0FBRztJQUFFLGNBQWMsRUFBQyxDQUFDLENBQUEsVUFBVSxHQUFJO0U3R3JGaEQsR0FBRyxDNkdzRkgsV0FBVyxDQUFLO0lBQUUsWUFBWSxFQUFHLENBQUMsQ0FBQSxVQUFVLEdBQUk7RTdHdEZoRCxHQUFHLEM2R3VGSCxXQUFXLENBQUs7SUFBRSxXQUFXLEVBQUksQ0FBQyxDQUFBLFVBQVU7SUFBRSxjQUFjLEVBQUMsQ0FBQyxDQUFBLFVBQVUsR0FBSTtFN0d2RjVFLEdBQUcsQzZHd0ZILFlBQVksQ0FBSTtJQUFFLGFBQWEsRUFBRSxDQUFDLENBQUEsVUFBVTtJQUFFLFlBQVksRUFBRyxDQUFDLENBQUEsVUFBVSxHQUFJO0U3R3hGNUUsR0FBRyxDNkc4RkgsV0FBVyxDQUFBO0lBQ1QsWUFBWSxFVGhGQyxNQUFpQixDU2dGSCxVQUFVO0lBQ3JDLFdBQVcsRVRqRkUsTUFBaUIsQ1NpRkgsVUFBVSxHQU10QztJQUpDLE1BQU0sQzdHbEdSLEdBQUcsQzZHOEZILFdBQVcsQ0FJRDtNQUNOLFlBQVksRVRsRkEsT0FBYSxDU2tGSyxVQUFVO01BQ3hDLFdBQVcsRVRuRkMsT0FBYSxDU21GSyxVQUFVLEdBQ3pDO0U3R3JHSCxHQUFHLEM4R0pILE9BQU87RTlHSVAsR0FBRyxDOEdISCxPQUFPLEFBQUEsT0FBTztFOUdHZCxHQUFHLEM4R0ZILE9BQU8sQUFBQSxNQUFNLENBQUM7SUFDWixhQUFhLEVBQUUsR0FBSSxHQUNwQjtFOUdBRCxHQUFHLEM4R0NILE9BQU8sQUFBQSxPQUFPO0U5R0RkLEdBQUcsQzhHRUgsT0FBTyxBQUFBLE1BQU0sQ0FBQztJQUNaLFFBQVEsRUFBRSxRQUFTO0lBQ25CLE9BQU8sRUFBRSxFQUFHLEdBQ2I7RTlHTEQsR0FBRyxDOEdNSCxPQUFPLEFBQUEsT0FBTyxDQUFDO0lBQ2IsS0FBSyxFQUFFLEtBQU07SUFDYixNQUFNLEVBQUUsTUFBTztJQUNmLFVBQVUsRVZlQyxJQUFJO0lVZGYsYUFBYSxFQUFFLGlCQUFrQjtJQUNqQyxHQUFHLEVBQUUsTUFBTztJQUNaLElBQUksRUFBRSxNQUFPO0lBQ2Isd0JBQXdCLEVBQUUsV0FBWTtJQUN0QyxnQkFBZ0IsRUFBRSxXQUFZO0lBQzlCLGlCQUFpQixFQUFFLDJCQUE0QjtJQUMvQyxTQUFTLEVBQUUsMkJBQTRCLEdBQ3hDO0U5R2pCRCxHQUFHLEM4R21CSCxPQUFPLENBQUM7SUFDTixTQUFTLEVBQUUsSUFBSztJQUNoQixXQUFXLEVBQUUsUUFBUztJQUN0QixNQUFNLEVBQUUsU0FBVTtJQUNsQixRQUFRLEVBQUUsUUFBUztJQUNuQixLQUFLLEVBQUUsSUFBSztJQUNaLE1BQU0sRUFBRSxJQUFLO0lBQ2IsVUFBVSxFQUFFLHVCQUF3QjtJQUNwQyxpQkFBaUIsRUFBRSxhQUFVO0lBQzdCLGFBQWEsRUFBRSxhQUFVO0lBQ3pCLFNBQVMsRUFBRSxhQUFVLEdBQ3RCO0U5RzlCRCxHQUFHLEM4RytCSCxPQUFPLEFBQUEsTUFBTSxDQUFDO0lBQ1osS0FBSyxFQUFFLEtBQU07SUFDYixNQUFNLEVBQUUsTUFBTztJQUNmLFVBQVUsRVZWQyxJQUFJO0lVV2YsYUFBYSxFQUFFLGlCQUFrQjtJQUNqQyxHQUFHLEVBQUUsTUFBTztJQUNaLElBQUksRUFBRSxLQUFNO0lBQ1osd0JBQXdCLEVBQUUsU0FBVTtJQUNwQyxnQkFBZ0IsRUFBRSxTQUFVO0lBQzVCLGlCQUFpQixFQUFFLHNCQUF1QjtJQUMxQyxTQUFTLEVBQUUsc0JBQXVCLEdBQ25DOztBQUNELGtCQUFrQixDQUFDLEtBQUs7RUFDdEIsRUFBRTtJQUNBLGlCQUFpQixFQUFFLFlBQU07SUFDekIsU0FBUyxFQUFFLFlBQU07RUFFbkIsSUFBSTtJQUNGLGlCQUFpQixFQUFFLGNBQU07SUFDekIsU0FBUyxFQUFFLGNBQU07O0FBR3JCLFVBQVUsQ0FBQyxLQUFLO0VBQ2QsRUFBRTtJQUNBLGlCQUFpQixFQUFFLFlBQU07SUFDekIsU0FBUyxFQUFFLFlBQU07RUFFbkIsSUFBSTtJQUNGLGlCQUFpQixFQUFFLGNBQU07SUFDekIsU0FBUyxFQUFFLGNBQU07RTlHNURyQixHQUFHLENBaUJELENBQUMsRUFqQkgsR0FBRyxDQWlCRSxNQUFNLENBQUM7SUFDUixLQUFLLEVvR0VGLE9BQU87SXBHRFYsTUFBTSxFQUFFLE9BQVEsR0FDakI7RUFwQkgsR0FBRyxDQXNCRCxPQUFPLENBQUM7SUFDTixLQUFLLEVvR0hGLE9BQU8sR3BHSVg7RUF4QkgsR0FBRyxDQTBCRCxVQUFVLENBQUM7SUFDVCxLQUFLLEVBQUUsSUFBSyxHQUNiO0VBNUJILEdBQUcsQ0E2QkQsSUFBSSxDQUFBO0lBQ0YsUUFBUSxFQUFFLFFBQVM7SUFDbkIsVUFBVSxFQUFFLEdBQUk7SUFDaEIsS0FBSyxFQUFFLEtBQU07SUFDYixNQUFNLEVBQUUsS0FBTTtJQUNkLE1BQU0sRUFBRSxHQUFHLENBQUMsS0FBSyxDb0dWUixJQUFJO0lwR1diLGFBQWEsRUFBRSxHQUFJLEdBQ3BCO0VBcENILEdBQUcsQ0FxQ0QsT0FBTyxDQUFBO0lBQ0wsYUFBYSxFQUFFLElBQUs7SUFDcEIsZ0JBQWdCLEVBQUUsSUFBSztJQUN2QixLQUFLLEVBQUMsSUFBSztJQUNYLE9BQU8sRUFBRSxZQUFhLEdBOEJ2QjtJQXZFSCxHQUFHLENBcUNELE9BQU8sQ0FLTCxLQUFLLENBQUM7TUFDSixLQUFLLEVBQUUsS0FBTTtNQUNiLFVBQVUsRUFBRSxLQUFNO01BQ2xCLE9BQU8sRUFBRSxPQUFRO01BQ2pCLE1BQU0sRUFBRSxJQUFLLEdBSWQ7TUFsREwsR0FBRyxDQXFDRCxPQUFPLENBS0wsS0FBSyxDQUtILEdBQUcsQ0FBQztRQUNGLE1BQU0sRUFBRSxJQUFLLEdBQ2Q7SUFqRFAsR0FBRyxDQXFDRCxPQUFPLENBY0wsV0FBVyxDQUFBO01BQ1QsV0FBVyxFQUFFLElBQUs7TUFDbEIsVUFBVSxFQUFFLElBQUs7TUFDakIsS0FBSyxFQUFFLElBQUssR0FhYjtNQW5FTCxHQUFHLENBcUNELE9BQU8sQ0FjTCxXQUFXLENBSVQsU0FBUyxDQUFDLENBQUMsQ0FBQTtRQUNULGVBQWUsRUFBRSxJQUFLO1FBQ3RCLEtBQUssRUFBRSxLQUFNLEdBQ2Q7TUExRFAsR0FBRyxDQXFDRCxPQUFPLENBY0wsV0FBVyxDQVNULFNBQVMsQUFBQSxVQUFVLENBQUE7UUFDakIsVUFBVSxFb0d0Q0UsT0FBTztRcEd1Q25CLE1BQU0sRUFBRSxJQUFLLEdBSWQ7UUFsRVAsR0FBRyxDQXFDRCxPQUFPLENBY0wsV0FBVyxDQVNULFNBQVMsQUFBQSxVQUFVLENBR2pCLENBQUMsQ0FBQTtVQUNDLEtBQUssRW9HNUNSLE9BQU8sR3BHNkNMO0lBakVULEdBQUcsQ0FxQ0QsT0FBTyxBQStCSixNQUFNLENBQUE7TUFDTCxLQUFLLEVBQUUsSUFBSyxHQUNiO0VBdEVMLEdBQUcsQ0F3RUQsZ0JBQWdCLENBQUE7SUFDZCxVQUFVLEVBQUUsSUFBSztJQUNqQixNQUFNLEVBQUUsR0FBRyxDQUFDLEtBQUssQ29HbERSLElBQUk7SXBHbURiLFVBQVUsRUFBRSxLQUFNO0lBQ2xCLE9BQU8sRUFBRSxJQUFLO0lBQ2QsT0FBTyxFQUFFLEtBQU07SUFDZixLQUFLLEVBQUUsSUFBSztJQUNaLEtBQUssRUFBRSxJQUFLLEdBQ2I7RUFoRkgsR0FBRyxDQWlGRCxZQUFZLENBQUE7SUFDVixNQUFNLEVBQUUsR0FBRyxDQUFDLEtBQUssQ29HMURSLElBQUk7SXBHMkRiLE9BQU8sRUFBRSxZQUFhO0lBQ3RCLEtBQUssRUFBRSxJQUFLLEdBOEJiO0lBbEhILEdBQUcsQ0FpRkQsWUFBWSxDQUlWLE1BQU0sQ0FBQTtNQUNKLEtBQUssRUFBRSxJQUFLO01BQ1osS0FBSyxFQUFFLElBQUs7TUFDWixPQUFPLEVBQUUsVUFBVztNQUNwQixVQUFVLEVvR2xFSSxPQUFPLEdwR3lFdEI7TUFoR0wsR0FBRyxDQWlGRCxZQUFZLENBSVYsTUFBTSxDQUtKLEVBQUUsRUExRlIsR0FBRyxDQWlGRCxZQUFZLENBSVYsTUFBTSxDQUtBLEVBQUUsQ0FBQTtRQUNKLEtBQUssRUFBRSxJQUFLLEdBQ2I7TUE1RlAsR0FBRyxDQWlGRCxZQUFZLENBSVYsTUFBTSxDQVFKLElBQUksQ0FBQTtRQUNGLEtBQUssRUFBRSxLQUFNLEdBQ2Q7SUEvRlAsR0FBRyxDQWlGRCxZQUFZLENBZ0JWLEtBQUssQ0FBQTtNQUNILEtBQUssRUFBRSxJQUFLO01BQ1osS0FBSyxFQUFFLElBQUssR0FjYjtNQWpITCxHQUFHLENBaUZELFlBQVksQ0FnQlYsS0FBSyxDQUdILEtBQUssQ0FBQTtRQUtILEtBQUssRUFBRSxJQUFLO1FBQ1osS0FBSyxFQUFFLElBQUssR0FNYjtRQWhIUCxHQUFHLENBaUZELFlBQVksQ0FnQlYsS0FBSyxDQUdILEtBQUssQ0FDSCxNQUFNLENBQUE7VUFDSixhQUFhLEVBQUUsR0FBRyxDQUFDLEtBQUssQ29HOUVyQixJQUFJO1VwRytFUCxVQUFVLEVBQUUsR0FBRyxDQUFDLEtBQUssQ29HL0VsQixJQUFJLEdwR2dGUjtRQXhHVCxHQUFHLENBaUZELFlBQVksQ0FnQlYsS0FBSyxDQUdILEtBQUssQ0FPSCxRQUFRLENBQUE7VUFDTixLQUFLLEVBQUUsSUFBSztVQUNaLEtBQUssRUFBRSxJQUFLO1VBQ1osV0FBVyxFQUFFLElBQUssR0FDbkI7RUEvR1QsR0FBRyxDQW1IRCxZQUFZLENBQUE7SUFDVixNQUFNLEVBQUUsR0FBRyxDQUFDLEtBQUssQ29HNUZSLElBQUk7SXBHNkZiLFVBQVUsRUFBRSxLQUFNO0lBQ2xCLE9BQU8sRUFBRSxTQUFVO0lBQ25CLE9BQU8sRUFBRSxLQUFNO0lBQ2YsYUFBYSxFQUFFLElBQUssR0FDckI7RUF6SEgsR0FBRyxDQTBIRCxTQUFTLENBQUE7SUFDUCxPQUFPLEVBQUUsWUFBYTtJQUN0QixLQUFLLEVBQUUsSUFBSztJQUNaLGNBQWMsRUFBRSxJQUFLLEdBUXRCO0lBcklILEdBQUcsQ0EwSEQsU0FBUyxDQUlQLEVBQUUsQ0FBQTtNQUNBLEtBQUssRUFBRSxJQUFLLEdBQ2I7SUFoSUwsR0FBRyxDQTBIRCxTQUFTLENBT1AsSUFBSSxDQUFBO01BQ0YsV0FBVyxFQUFFLElBQUs7TUFDbEIsS0FBSyxFQUFFLEtBQU0sR0FDZDtFQXBJTCxHQUFHLENBc0lELGFBQWEsQ0FBQztJQUNaLE9BQU8sRUFBRSxJQUFLO0lBQ2QsU0FBUyxFQUFFLElBQUssR0FlakI7SUF2SkgsR0FBRyxDQXNJRCxtQkFBYSxDQUdIO01BQ04sT0FBTyxFQUFFLE1BQWE7TUFDdEIsTUFBTSxFQUFFLEdBQUk7TUFDWixLQUFLLEVBQUUsS0FBTTtNQUNiLE1BQU0sRUFBRSxPQUFRO01BQ2hCLE1BQU0sRUFBRSxlQUFnQjtNQUN4QixVQUFVLEVBQUUsS0FBTTtNQUNsQixVQUFVLEVBQUUsZ0JBQWdCLENvRy9FcEIsT0FBTyxDQURMLElBQUksRXBHZ0Y0QyxZQUFZLENvRy9FOUQsT0FBTyxDQURMLElBQUksR3BHc0ZmO01BdEpMLEdBQUcsQ0FzSUQsbUJBQWEsQUFXUixNQUFNLENBQUE7UUFDTCxVQUFVLEVvRzNIRSxPQUFPO1FwRzRIbkIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENvRzNIWixJQUFJLEdwRzRIVjtFQXBKUCxHQUFHLENBeUpELFVBQVUsQ0FBQztJQUNULE9BQU8sRUFBRSxJQUFLO0lBQ2QsVUFBVSxFb0duSUQsSUFBSSxHcEdvSWQiLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9 */\n"; (require("browserify-css").createStyle(css, { "href": "src/css/style.css"})); module.exports = css;
},{"browserify-css":5}],113:[function(require,module,exports){
(function() {
    // Load the framework and Highcharts. Framework is passed as a parameter.
    var mediator;
    var configService;
    var that = {};

    that.load = function (element, services) {
        mediator = services.mediator;
        configService = services.config;
        var options = configService.get();
        options.chart.renderTo = element;
        var chart = new Highcharts.Chart(options);
        mediator.on('configUpdate', function (config) {
            config.chart.renderTo = element;
            chart = new Highcharts.Chart(config);
        });
    };

    module.exports = that;
})();
},{}],114:[function(require,module,exports){
(function () {
    //var _ = require('lodash');

    var _ = {
        forEach: require('lodash.foreach'),
        isEmpty: require('lodash.isempty'),
        isUndefined: require('lodash.isundefined')
    };


    var h = require('virtual-dom/h');
    var createElement = require('virtual-dom/create-element');
    var hot;
    function constructor(services) {
        var that = {};
        var element;
        var readOnly;
        that.load = function (_element_) {
            element = _element_;
            var wrapper = createElement(h('div'));


            readOnly = services.data.getUrl() ? true : false;
            if (readOnly){
                element.appendChild(createElement(h('div.readOnlyBox', h('span', 'A data url was found, the data will be read only'))));
            }
            element.appendChild(wrapper);
            var data = services.data.get();
            data = _.isUndefined(data[0]) ? [[]] : data;

            hot = new Handsontable(wrapper, {
                minRows: 1,
                minCols: 2,
                minSpareRows: 1,
                //minSpareCols: 1,
                height: 500,
                stretchH: 'all',
                rowHeaders: true,
                colHeaders: true,
                contextMenu: true,
                data: data,
                afterChange: function () {
                    services.data.set(removeEmptyRows(this));
                },
                afterRemoveRow:function () {
                    services.data.set(removeEmptyRows(this));
                },
                afterRemoveCol:function (test) {
                    services.data.set(removeEmptyRows(this));
                }
            });
            hot.updateSettings({
                cells: function (row, col, prop) {
                    var cellProperties = {};
                    cellProperties.readOnly = readOnly;
                    return cellProperties;
                }
            });

            services.mediator.on('dataUpdate', function (_data_) {
                readOnly = services.data.getUrl() ? true : false;
                if(_data_.length > 0){
                    hot.updateSettings({
                        data: _data_,
                        cells: function (row, col, prop) {
                            var cellProperties = {};
                            cellProperties.readOnly = readOnly;
                            return cellProperties;
                        }
                    });
                } else {
                    hot.clear();
                }

            }, 'hot');
        };

        var Hook = function () {};
        Hook.prototype.hook = function (node) {
            setTimeout(function () {
                that.load(node);
            });
        };

        that.template = function () {
            return h('div', {
                'afterRender': new Hook()
            });
        };


        that.destroy = function () {
            services.mediator.off(null, null, 'hot');
            var data = removeEmptyRows(hot);
            if (!_.isEmpty(data)) {
                services.data.set(removeEmptyRows(hot));
            }
            hot.destroy();
            element.innerHTML = '';
        };

        function removeEmptyRows(hot) {
            var gridData = hot.getData();
            var cleanedGridData = [];
            _.forEach(gridData, function (object, rowKey) {
                if (!hot.isEmptyRow(rowKey)) cleanedGridData[rowKey] = object;
            });
            return cleanedGridData;
        }

        return that;
    }

    module.exports = constructor;
})();

},{"lodash.foreach":46,"lodash.isempty":49,"lodash.isundefined":54,"virtual-dom/create-element":79,"virtual-dom/h":81}],115:[function(require,module,exports){
(function () {
    var constructor = function (services) {
        var h = require('virtual-dom/h');
        var paste = require('./import/paste');
        var upload = require('./import/upload');
        var dad = require('./import/dragAndDrop');
        var url = require('./import/url');
        var table = require('./table')(services);
        var hot = require('./hot')(services);
        var activeTab = services.data.getUrl() ? 'url' : services.data.get().length == 0 ? 'paste' : 'data';
        var mediator = services.mediator;
        mediator.on('goToTable', goToTable);
        var tabOptions = {
            paste: {
                label: 'Paste CSV',
                template: function () {
                    return paste.template(services);
                }
            },
            upload: {
                label: 'upload CSV',
                template: function () {
                    return h('div', [
                        upload.template(services),
                        dad.template(services)
                    ]);
                }
            },
            url: {
                label: 'url CSV',
                template: function () {
                    return url.template(services);
                }
            },
            data: {
                label: 'Data table',
                template: function () {
                    if (typeof Handsontable !== 'undefined') {
                        return hot.template(services);
                    } else {
                        return table.template(services);
                    }

                },
                destroy: function () {
                    if (typeof Handsontable !== 'undefined') {
                        hot.destroy();
                    } else {
                        table.destroy();
                    }
                }
            }
        };

        function tabLinks() {
            var links = ['paste', 'upload', 'url', 'data'];
            return h('ul.vertical-tabs', links.map(function (id) {
                    var className = activeTab === id ? 'active' : '';
                    return h('li', {
                            'className': className
                        }, h('a', {
                            'href': '#' + tabOptions[id].label,
                            'ev-click': function () {
                                load(id);
                            }
                        }, tabOptions[id].label)
                    )
                })
            )
        }

        function load(id) {
            if (tabOptions[activeTab].destroy) {
                tabOptions[activeTab].destroy();
            }
            activeTab = id;
            mediator.trigger('treeUpdate');
        }

        function goToTable() {
            activeTab = 'data';
            mediator.trigger('treeUpdate');
        }

        function destroy() {
            mediator.off('goToTable', goToTable);
            if (tabOptions[activeTab]['destroy']) {
                tabOptions[activeTab]['destroy']();
            }
        }

        function template() {
            return h('div.vertical-tabs-container', [
                tabLinks(),
                h('div.vertical-tab-content-container',
                    h('div.vertical-tab-content', tabOptions[activeTab].template())
                )
            ]);
        }

        return {
            template: template,
            destroy: destroy
        };
    };


    module.exports = constructor;
})();




},{"./hot":114,"./import/dragAndDrop":116,"./import/paste":117,"./import/upload":118,"./import/url":119,"./table":121,"virtual-dom/h":81}],116:[function(require,module,exports){
(function () {
    var dragDrop = require('drag-drop');
    var dataService;
    var h = require('virtual-dom/h');
    var that = {};
    that.template = function (services) {
        dataService = services.data;
        var mediator = services.mediator;
        var Hook = function () {};
        var content = 'Drop your CSV file here';
        Hook.prototype.hook = function (node) {
            dragDrop(node, function (files) {
                // `files` is an Array!
                files.forEach(function (file) {
                    // convert the file to a Buffer that we can use!
                    var reader = new FileReader();
                    reader.addEventListener('loadstart', function (e) {
                        console.log('start');
                        node.innerHTML = '<div class="loader"></div>'
                    });
                    reader.addEventListener('load', function (e) {
                        saveData(reader.result);
                        node.innerHTML = 'Drop your files here';
                        mediator.trigger('goToTable');
                    });

                    reader.addEventListener('error', function (err) {
                        console.error('FileReader error' + err)
                    });
                    reader.readAsText(file);
                })
            });
        };

        return h('div.file_drop', {
            'hook': new Hook()
        }, content);
    };

    function saveData(value) {
        dataService.setCSV(value);
    }

    module.exports = that;
})();

},{"drag-drop":15,"virtual-dom/h":81}],117:[function(require,module,exports){
(function () {
    var h = require('virtual-dom/h');

    var that = {};
    that.template = function (services) {
        var dataService = services.data;
        var mediator = services.mediator;
        var inputNode;
        var Hook = function(){};
        Hook.prototype.hook = function(node) {
            inputNode = node;
        };

        var input = h('textArea', {
            'style': {'height': '200px'},
            "hook": new Hook()
        });

        var importElement = h('button.btn.btn--small', {
            'ev-click': function(e){
                e.preventDefault();
                saveData(inputNode.value);
            }
        }, 'import');

        function saveData(value) {
            dataService.setCSV(value);
            mediator.trigger('goToTable');
        }

        return h('div', [input, importElement])
    };
    module.exports = that;
})();

},{"virtual-dom/h":81}],118:[function(require,module,exports){
(function () {
    var h = require('virtual-dom/h');
    var that = {};
    that.template = function (services) {
        var dataService = services.data;
        var mediator = services.mediator;
        var uploadElement;
        // Check for the various File API support.
        if (window.FileReader) {
            uploadElement =
                h('input.soft--ends', {
                    type: 'file',
                    "size": 50,
                    onchange: function(e){
                        loadFile(e);
                    }
                }, 'upload');
        }

        function loadFile(e) {
            var file = e.target.files[0];
            var reader  = new FileReader();
            reader.onloadend = function () {
                saveData(reader.result)
            };
            if (file) {
                reader.readAsText(file);
            }
        }

        function saveData(value) {
            dataService.setCSV(value);
            mediator.trigger('goToTable');
        }

        return uploadElement;
    };

    module.exports = that;
})();
},{"virtual-dom/h":81}],119:[function(require,module,exports){
(function () {
    var that = {};
    var h = require('virtual-dom/h');
    that.template = function (services) {
        var dataService = services.data;
        var mediator = services.mediator;
        var inputNode;

        var Hook = function(){};

        Hook.prototype.hook = function(node) {
            inputNode = node;
        };
        var input = h('input.push-half', {
            "size": 50,
            "type": "text",
            "style" : {
                display: "inline"
            },
            value: services.data.getUrl(),
            "hook": new Hook()
        });


        var importElement = h('button.btn.btn--small.push-half', {
            "style" : {
                display: "inline"
            },
            'ev-click': function (e) {
                e.preventDefault();
                dataService.setUrl(inputNode.value);
                mediator.trigger('goToTable');
            }
        }, 'save');

        return h('div', [input, importElement])
    };
    module.exports = that;
})();

},{"virtual-dom/h":81}],120:[function(require,module,exports){
var constructor = function (mediator, list) {
    var h = require('virtual-dom/h');
    var createElement = require('virtual-dom/create-element');
    var template = createElement(h('div'));

    function update(_list_) {
        list = _list_;
        template.innerHTML = '';
        if (list.length > 0) {
            var item = list.pop();
            template.appendChild(
                createElement(h('div.revisionElement', [
                    h('span', 'Data updated on ' + new Date(item.time).toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1") + '. '),
                    h('a',
                        {
                            'ev-click': function () {
                                mediator.trigger('backup.revert.last');
                            }
                        }
                        , 'Undo last update'
                    )]
                ))
            );
        }
    }


    mediator.on('backup.list.update', function (_list_) {
        update(_list_);
    });

    function toHHMMSS(string) {
        var sec_num = parseInt(string, 10); // don't forget the second param
        var hours = Math.floor(sec_num / 3600);
        var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
        var seconds = sec_num - (hours * 3600) - (minutes * 60);

        if (hours < 10) {
            hours = "0" + hours;
        }
        if (minutes < 10) {
            minutes = "0" + minutes;
        }
        if (seconds < 10) {
            seconds = "0" + seconds;
        }
        var time = hours + ':' + minutes + ':' + seconds;

        return time;
    }

    update(list);
    return {
        template: function () {
            return template;
        }
    };
};

module.exports = constructor;



},{"virtual-dom/create-element":79,"virtual-dom/h":81}],121:[function(require,module,exports){
(function () {
    var constructor = function (services) {
        var _ = {
            forEach: require('lodash.foreach'),
            trim: require('lodash.trim'),
            isEqual: require('lodash.isequal')
        };
        var h = require('virtual-dom/h');
        var mediator = services.mediator;
        var data;

        function template() {
            data = services.data.get();
            mediator.on('dataUpdate', updateData);
            var editable = services.data.getUrl() ? false : true;
            var rows = [];
            var readOnly = !editable ? h('div.readOnlyBox', h('span', 'A data url was found, the data will be read only')) : '';
            var editRow = [];
            // only add if there is data
            if (data[0]) {
                rows.push(h('tr', editRow));
                _.forEach(data, function (row, rowIndex) {
                    var cells = [];
                    _.forEach(row, function (cell, cellIndex) {
                        cells.push(h('td', {
                            contentEditable: services.data.getUrl() ? false : true,
                            "ev-input": function (e) {
                                var value = _.trim(e.target.innerHTML);
                                data[rowIndex][cellIndex] = value;
                                services.data.setValue(rowIndex, cellIndex, value);
                            }
                        }, cell));
                    });
                    rows.push(h('tr', cells));
                });
            }

            return h('div', [
                readOnly,
                h('table.table--data.table--bordered', {
                    className: !editable ? "table--disabled" : ""
                }, rows)
            ]);
        }


        function updateData(_data_) {
            console.log(_data_);
            console.log(data);
            if (!_.isEqual(_data_, data)) {
                data = _data_;
                mediator.trigger('treeUpdate');
            }
        }

        function destroy() {
            mediator.off('dataUpdate', updateData);
        }

        return {
            template: template,
            destroy: destroy
        };
    };

    module.exports = constructor;
})();





},{"lodash.foreach":46,"lodash.isequal":50,"lodash.trim":66,"virtual-dom/h":81}],122:[function(require,module,exports){
(function () {
    var constructor = function (services) {
        var that = {};
        var _ = {
            find: require('lodash.find'),
            forEach: require('lodash.foreach'),
            first: require('lodash.first')
        };
        var h = require('virtual-dom/h');
        var iconLoader = require('../factories/iconLoader');
        var mediator = services.mediator;
        var activeId = _.first(services.templates.get()).id;
        var config = services.config;

        that.template = function () {
            var activeType = _.find(services.templates.get(), function (type) {
                return type.id == activeId;
            });
            var templates = services.templates.get();
            var tabs = generateTabs(templates, activeId);
            var content = generateContent(activeType);
            return h('div', {className: 'vertical-tabs-container'}, [tabs, content]);
        };

        function generateContent(activeType) {
            var templateList = [];

            _.forEach(activeType.templates, function (template) {
                var svg = iconLoader.get(template.icon ? template.icon : activeType.icon);
                var item = h('a',
                    {
                        className: "templatelist__item",
                        'ev-click': function () {
                            config.loadTemplate(template.definition);
                        }
                    }, [
                        svg,
                        h('div', template.title)
                    ]);
                templateList.push(item)
            });
            var templateGrid = h('div', {className: "templatelist"}, templateList);
            return h('div.vertical-tab-content-container', h('div.vertical-tab-content', templateGrid));
        }

        function generateTabs(types, active) {
            var links = [];
            _.forEach(types, function (type, index) {
                var className = type.id === active ? 'active' : '';

                var link = h('li', {
                    'className': className
                }, h('a', {
                    'href': '#' + type.type,
                    'ev-click': function (e) {
                        e.preventDefault();
                        activeId = type.id;
                        mediator.trigger('treeUpdate');
                    }
                }, type.type));

                links.push(link);
            });
            return h('ul', {className: "vertical-tabs"}, links);
        }

        return that;
    };


    module.exports = constructor;
})();
},{"../factories/iconLoader":125,"lodash.find":44,"lodash.first":45,"lodash.foreach":46,"virtual-dom/h":81}],123:[function(require,module,exports){
module.exports=module.exports = [
    {
        "id": "chart",
        "panelTitle": "Chart settings",
        "panes": [
            {
                "title": "Chart type and interaction",
                "options": [
                    {
                        "name": "chart--type",
                        "fullname": "chart.type",
                        "title": "type",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "line",
                        "values": "[\"line\", \"spline\", \"column\", \"bar\", \"area\", \"areaspline\", \"pie\", \"arearange\", \"areasplinerange\", \"boxplot\", \"bubble\", \"columnrange\", \"errorbar\", \"funnel\", \"gauge\", \"heatmap\", \"polygon\", \"pyramid\", \"scatter\", \"solidgauge\", \"treemap\", \"waterfall\"]",
                        "since": "2.1.0",
                        "description": "The default series type for the chart. Can be any of the chart types listed under <a href=\"#plotOptions\">plotOptions</a>.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/type-bar/\" target=\"_blank\">Bar</a>",
                        "deprecated": false
                    },
                    {
                        "name": "chart--inverted",
                        "fullname": "chart.inverted",
                        "title": "inverted",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "false",
                        "since": "",
                        "description": "Whether to invert the axes so that the x axis is vertical and y axis is horizontal.\r When true, the x axis is reversed by default. If a bar series is present in the chart,\r it will be inverted automatically.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/inverted/\" target=\"_blank\">Inverted line</a>",
                        "seeAlso": "",
                        "deprecated": false
                    },
                    {
                        "name": "chart--zoomType",
                        "fullname": "chart.zoomType",
                        "title": "zoomType",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "String",
                        "values": "[null, \"x\", \"y\", \"xy\"]",
                        "description": "Decides in what dimensions the user can zoom by dragging the mouse. Can be one of <code>x</code>, <code>y</code> or <code>xy</code>.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/zoomtype-none/\" target=\"_blank\">None by default</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/zoomtype-x/\" target=\"_blank\">x</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/zoomtype-y/\" target=\"_blank\">y</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/zoomtype-xy/\" target=\"_blank\">xy</a>",
                        "seeAlso": "<a href=\"#chart.panKey\">panKey</a>",
                        "deprecated": false
                    },
                    {
                        "name": "plotOptions-column--stacking",
                        "fullname": "plotOptions.column.stacking",
                        "title": "column stacking",
                        "parent": "plotOptions-column",
                        "isParent": false,
                        "returnType": "String",
                        "values": "[null, \"normal\", \"percent\"]",
                        "description": "Whether to stack the values of each series on top of each other. Possible values are null to disable, \"normal\" to stack by value or \"percent\".",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-line/\" target=\"_blank\">Line</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-column/\" target=\"_blank\">column</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-bar/\" target=\"_blank\">bar</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-area/\" target=\"_blank\">area</a> with \"normal\" stacking. \r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-line/\" target=\"_blank\">Line</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-column/\" target=\"_blank\">column</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-bar/\" target=\"_blank\">bar</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-area/\" target=\"_blank\">area</a> with \"percent\" stacking.",
                        "seeAlso": "<a href=\"#yAxis.reversedStacks\">yAxis.reversedStacks</a>",
                        "deprecated": false
                    },
                    {
                        "name": "plotOptions-bar--stacking",
                        "fullname": "plotOptions.bar.stacking",
                        "title": "bar stacking",
                        "parent": "plotOptions-bar",
                        "isParent": false,
                        "returnType": "String",
                        "values": "[null, \"normal\", \"percent\"]",
                        "description": "Whether to stack the values of each series on top of each other. Possible values are null to disable, \"normal\" to stack by value or \"percent\".",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-line/\" target=\"_blank\">Line</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-column/\" target=\"_blank\">column</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-bar/\" target=\"_blank\">bar</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-area/\" target=\"_blank\">area</a> with \"normal\" stacking. \r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-line/\" target=\"_blank\">Line</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-column/\" target=\"_blank\">column</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-bar/\" target=\"_blank\">bar</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-area/\" target=\"_blank\">area</a> with \"percent\" stacking.",
                        "seeAlso": "<a href=\"#yAxis.reversedStacks\">yAxis.reversedStacks</a>",
                        "deprecated": false
                    }
                ]
            },
            {
                "title": "Size and margins",
                "options": [
                    {
                        "name": "chart--width",
                        "fullname": "chart.width",
                        "title": "width",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "An explicit width for the chart. By default the width is calculated from the offset width of the containing element.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/width/\" target=\"_blank\">800px wide</a>"
                    },
                    {
                        "name": "chart--height",
                        "fullname": "chart.height",
                        "title": "height",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "An explicit height for the chart. By default the height is calculated from the offset height of the containing element, or 400 pixels if the containing element's height is 0.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/height/\" target=\"_blank\">500px height</a>",
                        "deprecated": false
                    },
                    {
                        "name": "chart--spacingTop",
                        "fullname": "chart.spacingTop",
                        "title": "spacingTop",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "10",
                        "since": "2.1",
                        "description": "<p>The space between the top edge of the chart and the content (plot area, axis title and labels, title, subtitle or \r\n legend in top position).</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/spacingtop-100/\" target=\"_blank\">A top spacing of 100</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/spacingtop-10/\" target=\"_blank\">floating chart title makes the plot area align to the \r\n\t\t\tdefault spacingTop of 10.</a>.",
                        "deprecated": false
                    },
                    {
                        "name": "chart--spacingRight",
                        "fullname": "chart.spacingRight",
                        "title": "spacingRight",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "10",
                        "since": "2.1",
                        "description": "<p>The space between the right edge of the chart and the content (plot area, axis title and labels, title, subtitle or \r legend in top position).</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/spacingright-100/\" target=\"_blank\">Spacing set to 100</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/spacingright-legend/\" target=\"_blank\">legend in right position with default spacing</a>",
                        "deprecated": false
                    },
                    {
                        "name": "chart--spacingBottom",
                        "fullname": "chart.spacingBottom",
                        "title": "spacingBottom",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "15",
                        "since": "2.1",
                        "description": "<p>The space between the bottom edge of the chart and the content (plot area, axis title and labels, title, subtitle or \r legend in top position).</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/spacingbottom/\" target=\"_blank\">Spacing bottom set to 100</a>.",
                        "deprecated": false
                    },
                    {
                        "name": "chart--spacingLeft",
                        "fullname": "chart.spacingLeft",
                        "title": "spacingLeft",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "10",
                        "since": "2.1",
                        "description": "<p>The space between the left edge of the chart and the content (plot area, axis title and labels, title, subtitle or \r legend in top position).</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/spacingleft/\" target=\"_blank\">Spacing left set to 100</a>",
                        "deprecated": false
                    }
                ]
            }
        ]
    },
    {
        "id": "colorsAndBorders",
        "panelTitle": "Colors and borders",
        "panes": [
            {
                "title": "default colors",
                "options": [
                    {
                        "name": "colors",
                        "fullname": "colors",
                        "title": "colors",
                        "isParent": false,
                        "returnType": "Array<Color>",
                        "defaults": "[ \"#7cb5ec\" , \"#434348\" , \"#90ed7d\" , \"#f7a35c\" , \"#8085e9\" , \"#f15c80\" , \"#e4d354\" , \"#2b908f\" , \"#f45b5b\" , \"#91e8e1\"]",
                        "description": "<p>An array containing the default colors for the chart's series. When all colors are used, new colors are pulled from the start again. Defaults to:\r\n<pre>colors: ['#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9', \r\n   '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1']</pre>\r\n\r\nDefault colors can also be set on a series or series.type basis, see <a href=\"#plotOptions.column.colors\">column.colors</a>, <a href=\"#plotOptions.pie.colors\">pie.colors</a>.\r\n</p>\r\n\r\n<h3>Legacy</h3>\r\n<p>In Highcharts 3.x, the default colors were:\r\n<pre>colors: ['#2f7ed8', '#0d233a', '#8bbc21', '#910000', '#1aadce', \r\n   '#492970', '#f28f43', '#77a1e5', '#c42525', '#a6c96a']</pre>\r\n</p>\r\n\r\n<p>In Highcharts 2.x, the default colors were:\r\n<pre>colors: ['#4572A7', '#AA4643', '#89A54E', '#80699B', '#3D96AE', \r\n   '#DB843D', '#92A8CD', '#A47D7C', '#B5CA92']</pre></p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/colors/\" target=\"_blank\">Assign a global color theme</a>",
                        "deprecated": false
                    }
                ]
            },
            {
                "title": "Chart area",
                "options": [
                    {
                        "name": "chart--backgroundColor",
                        "fullname": "chart.backgroundColor",
                        "title": "backgroundColor",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Color",
                        "defaults": "#FFFFFF",
                        "description": "The background color or gradient for the outer chart area.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/backgroundcolor-color/\" target=\"_blank\">Color</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/backgroundcolor-gradient/\" target=\"_blank\">gradient</a>"
                    },
                    {
                        "name": "chart--borderWidth",
                        "fullname": "chart.borderWidth",
                        "title": "borderWidth",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "0",
                        "description": "The pixel width of the outer chart border.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/borderwidth/\" target=\"_blank\">5px border</a>",
                        "deprecated": false
                    },
                    {
                        "name": "chart--borderRadius",
                        "fullname": "chart.borderRadius",
                        "title": "borderRadius",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "0",
                        "description": "The corner radius of the outer chart border.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/borderradius/\" target=\"_blank\">20px radius</a>",
                        "deprecated": false
                    },
                    {
                        "name": "chart--borderColor",
                        "fullname": "chart.borderColor",
                        "title": "borderColor",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Color",
                        "defaults": "#4572A7",
                        "description": "The color of the outer chart border.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/bordercolor/\" target=\"_blank\">Brown border</a>",
                        "deprecated": false
                    }
                ]
            },
            {
                "title": "Plot area",
                "options": [
                    {
                        "name": "chart--plotBackgroundColor",
                        "fullname": "chart.plotBackgroundColor",
                        "title": "plotBackgroundColor",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Color",
                        "description": "The background color or gradient for the plot area.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/plotbackgroundcolor-color/\" target=\"_blank\">Color</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/plotbackgroundcolor-gradient/\" target=\"_blank\">gradient</a>"
                    },
                    {
                        "name": "chart--plotBackgroundImage",
                        "fullname": "chart.plotBackgroundImage",
                        "title": "plotBackgroundImage",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "String",
                        "description": "The URL for an image to use as the plot background. To set an image as the background for the entire chart, set a CSS background image to the container element. Note that for the image to be applied to exported charts, its URL needs to be accessible by the export server.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/plotbackgroundimage/\" target=\"_blank\">Skies</a>",
                        "deprecated": false
                    },
                    {
                        "name": "chart--plotBorderWidth",
                        "fullname": "chart.plotBorderWidth",
                        "title": "plotBorderWidth",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "0",
                        "description": "The pixel width of the plot area border.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/plotborderwidth/\" target=\"_blank\">1px border</a>"
                    },
                    {
                        "name": "chart--plotBorderColor",
                        "fullname": "chart.plotBorderColor",
                        "title": "plotBorderColor",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Color",
                        "defaults": "#C0C0C0",
                        "description": "The color of the inner chart or plot area border.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/plotbordercolor/\" target=\"_blank\">Blue border</a>"
                    }
                ]
            }
        ]
    },
    {
        "id": "titles",
        "panelTitle": "Titles",
        "panes": [
            {
                "title": "Titles",
                "options": [
                    {
                        "name": "title--text",
                        "fullname": "title.text",
                        "title": "chart title",
                        "parent": "title",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "Chart title",
                        "description": "The title of the chart. To disable the title, set the <code>text</code> to <code>null</code>.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/title/text/\" target=\"_blank\">Custom title</a>"
                    },
                    {
                        "name": "subtitle--text",
                        "fullname": "subtitle.text",
                        "title": "chart subtitle",
                        "parent": "subtitle",
                        "isParent": false,
                        "returnType": "String",
                        "description": "The subtitle of the chart.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/subtitle/text/\" target=\"_blank\">Custom subtitle</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/subtitle/text-formatted/\" target=\"_blank\">formatted and linked text.</a>"
                    }
                ]
            },
            {
                "title": "Title advanced",
                "options": [
                    {
                        "name": "title--style",
                        "fullname": "title.style",
                        "title": "style",
                        "parent": "title",
                        "isParent": false,
                        "returnType": "CSSObject",
                        "defaults": "{ \"color\": \"#333333\", \"fontSize\": \"18px\" }",
                        "description": "CSS styles for the title. Use this for font styling, but use <code>align</code>, <code>x</code> and <code>y</code> for text alignment.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/title/style/\" target=\"_blank\">Custom color and weight</a>",
                        "deprecated": false
                    }
                ]
            }
        ]
    },
    {
        "id": "axis",
        "panelTitle": "Axis",
        "panes": [
            {
                "title": "Axes setup",
                "id": "general",
                "options": [
                    {
                        "name": "chart--inverted",
                        "fullname": "chart.inverted",
                        "title": "inverted",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "false",
                        "since": "",
                        "description": "Whether to invert the axes so that the x axis is vertical and y axis is horizontal.\r When true, the x axis is reversed by default. If a bar series is present in the chart,\r it will be inverted automatically.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/inverted/\" target=\"_blank\">Inverted line</a>",
                        "seeAlso": "",
                        "deprecated": false
                    }
                ]
            },
            {
                "title": "X axis",
                "id": "xAxis",
                "options": [
                    {
                        "name": "xAxis-title--text",
                        "fullname": "xAxis.title.text",
                        "title": "text",
                        "parent": "xAxis-title",
                        "isParent": false,
                        "returnType": "String",
                        "description": "The actual text of the axis title. It can contain basic HTML text markup like &lt;b&gt;, &lt;i&gt; and spans with style.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/title-text/\" target=\"_blank\">Custom HTML</a> title for X axis"
                    },
                    {
                        "name": "xAxis--type",
                        "fullname": "xAxis.type",
                        "title": "type",
                        "parent": "xAxis",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "linear",
                        "values": "[\"linear\", \"logarithmic\", \"datetime\", \"category\"]",
                        "description": "The type of axis. Can be one of <code>\"linear\"</code>, <code>\"logarithmic\"</code>, <code>\"datetime\"</code> or <code>\"category\"</code>. In a datetime axis, the numbers are given in milliseconds, and tick marks are placed \t\ton appropriate values like full hours or days. In a category axis, the <a href=\"#series.data\">point names</a> of the chart's series are used for categories, if not a <a href=\"#xAxis.categories\">categories</a> array is defined.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-linear/\" target=\"_blank\">\"linear\"</a>, \r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-datetime/\" target=\"_blank\">\"datetime\" with regular intervals</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-datetime-irregular/\" target=\"_blank\">\"datetime\" with irregular intervals</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/type-log/\" target=\"_blank\">\"logarithmic\"</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/type-log-minorgrid/\" target=\"_blank\">\"logarithmic\" with minor grid lines</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-log-both/\" target=\"_blank\">\"logarithmic\" on two axes</a>.",
                        "deprecated": false
                    },
                    {
                        "name": "xAxis--min",
                        "fullname": "xAxis.min",
                        "title": "min",
                        "parent": "xAxis",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "The minimum value of the axis. If <code>null</code> the min value is automatically calculated. If the <code>startOnTick</code> option is true, the <code>min</code> value might be rounded down.",
                        "demo": "Y axis min of <a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/min-startontick-false/\" target=\"_blank\">-50 with startOnTick to false</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/min-startontick-true/\" target=\"_blank\">-50 with startOnTick true by default</a>"
                    },
                    {
                        "name": "xAxis--max",
                        "fullname": "xAxis.max",
                        "title": "max",
                        "parent": "xAxis",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "The maximum value of the axis. If <code>null</code>, the max value is automatically calculated. If the <code>endOnTick</code> option is true, the <code>max</code> value might be rounded up. The actual maximum value is also influenced by  <a class=\"internal\" href=\"#chart\">chart.alignTicks</a>.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/max-200/\" target=\"_blank\">Y axis max of 200</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/max-logarithmic/\" target=\"_blank\">Y axis max on logarithmic axis</a>"
                    },
                    {
                        "name": "xAxis--opposite",
                        "fullname": "xAxis.opposite",
                        "title": "opposite",
                        "parent": "xAxis",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "false",
                        "description": "Whether to display the axis on the opposite side of the normal. The normal is on the left side for vertical axes and bottom for horizontal, so the opposite sides will be right and top respectively. This is typically used with dual or multiple axes.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/opposite/\" target=\"_blank\">Secondary Y axis opposite</a>"
                    },
                    {
                        "name": "xAxis--reversed",
                        "fullname": "xAxis.reversed",
                        "title": "reversed",
                        "parent": "xAxis",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "false",
                        "description": "Whether to reverse the axis so that the highest number is closest to the origin. If the chart is inverted, the x axis is reversed by default.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/reversed/\" target=\"_blank\">Reversed Y axis</a>",
                        "deprecated": false
                    },
                    {
                        "name": "xAxis--tickInterval",
                        "fullname": "xAxis.tickInterval",
                        "title": "tickInterval",
                        "parent": "xAxis",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "<p>The interval of the tick marks in axis units. When <code>null</code>, the tick interval\r\n is computed to approximately follow the <a href=\"#xAxis.tickPixelInterval\">tickPixelInterval</a> on linear and datetime axes.\r\n On categorized axes, a <code>null</code> tickInterval will default to 1, one category. \r\n Note that datetime axes are based on milliseconds, so for \r\n example an interval of one day is expressed as <code>24 * 3600 * 1000</code>.</p>\r\n <p>On logarithmic axes, the tickInterval is based on powers, so a tickInterval of 1 means\r\n \tone tick on each of 0.1, 1, 10, 100 etc. A tickInterval of 2 means a tick of 0.1, 10, 1000 etc.\r\n \tA tickInterval of 0.2 puts a tick on 0.1, 0.2, 0.4, 0.6, 0.8, 1, 2, 4, 6, 8, 10, 20, 40 etc.</p>\r\n<p>If the tickInterval is too dense for labels to be drawn, Highcharts may remove ticks.</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/tickinterval-5/\" target=\"_blank\">Tick interval of 5 on a linear axis</a>",
                        "seeAlso": "<a href=\"#xAxis.tickPixelInterval\">tickPixelInterval</a>, <a href=\"#xAxis.tickPositions\">tickPositions</a>, <a href=\"#xAxis.tickPositioner\">tickPositioner</a>",
                        "deprecated": false
                    },
                    {
                        "name": "xAxis-labels--format",
                        "fullname": "xAxis.labels.format",
                        "title": "format",
                        "parent": "xAxis-labels",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "{value}",
                        "since": "3.0",
                        "description": "A <a href=\"http://www.highcharts.com/docs/chart-concepts/labels-and-string-formatting\">format string</a> for the axis label. ",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/labels-format/\" target=\"_blank\">Add units to Y axis label</a>",
                        "deprecated": false
                    },
                    {
                        "name": "xAxis-labels--rotation",
                        "fullname": "xAxis.labels.rotation",
                        "title": "rotation",
                        "parent": "xAxis-labels",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "0",
                        "description": "Rotation of the labels in degrees.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/labels-rotation/\" target=\"_blank\">X axis labels rotated 90°</a>"
                    },
                    {
                        "name": "xAxis-labels--align",
                        "fullname": "xAxis.labels.align",
                        "title": "align",
                        "parent": "xAxis-labels",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "center",
                        "values": "[\"left\", \"center\", \"right\"]",
                        "description": "What part of the string the given position is anchored to. Can be one of <code>\"left\"</code>, <code>\"center\"</code> or <code>\"right\"</code>. Defaults to an intelligent guess based on which side of the chart the axis is on and the rotation of the label.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/labels-align-left/\" target=\"_blank\">\"left\"</a>, \r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/labels-align-right/\" target=\"_blank\">\"right\"</a> on X axis",
                        "deprecated": false
                    },
                    {
                        "name": "xAxis-plotBands",
                        "fullname": "xAxis.plotBands",
                        "title": "plotBands",
                        "parent": "xAxis",
                        "isParent": true,
                        "returnType": "Array<Object>",
                        "description": "<p>An array of colored bands stretching across the plot area marking an interval on the axis.</p>\r\n\r\n<p>In a gauge, a plot band on the Y axis (value axis) will stretch along the perimeter of the gauge.</p>",
                        "deprecated": false,
                        "options": [
                            {
                                "name": "xAxis-plotBands--color",
                                "fullname": "xAxis.plotBands.color",
                                "title": "color",
                                "parent": "xAxis-plotBands",
                                "isParent": false,
                                "returnType": "Color",
                                "description": "The color of the plot band.",
                                "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/plotbands-color/\" target=\"_blank\">Color band</a>"
                            },
                            {
                                "name": "xAxis-plotBands--from",
                                "fullname": "xAxis.plotBands.from",
                                "title": "from",
                                "parent": "xAxis-plotBands",
                                "isParent": false,
                                "returnType": "Number",
                                "description": "The start position of the plot band in axis units.",
                                "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/plotbands-color/\" target=\"_blank\">Datetime axis</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/plotbands-from/\" target=\"_blank\">categorized axis</a>,"
                            },
                            {
                                "name": "xAxis-plotBands--to",
                                "fullname": "xAxis.plotBands.to",
                                "title": "to",
                                "parent": "xAxis-plotBands",
                                "isParent": false,
                                "returnType": "Number",
                                "description": "The end position of the plot band in axis units.",
                                "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/plotbands-color/\" target=\"_blank\">Datetime axis</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/plotbands-from/\" target=\"_blank\">categorized axis</a>,"
                            }
                        ]
                    }
                ]
            },
            {
                "title": "Value axis",
                "id": "yAxis",
                "options": [
                    {
                        "name": "yAxis-title--text",
                        "fullname": "yAxis.title.text",
                        "title": "text",
                        "parent": "yAxis-title",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "Values",
                        "description": "The actual text of the axis title. Horizontal texts can contain HTML, \r but rotated texts are painted using vector techniques and must be \r clean text. The Y axis title is disabled by setting the <code>text</code>\r option to <code>null</code>.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/title-text/\" target=\"_blank\">Custom HTML</a> title for X axis",
                        "deprecated": false
                    },
                    {
                        "name": "yAxis--type",
                        "fullname": "yAxis.type",
                        "title": "type",
                        "parent": "yAxis",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "linear",
                        "values": "[\"linear\", \"logarithmic\", \"datetime\", \"category\"]",
                        "description": "The type of axis. Can be one of <code>\"linear\"</code>, <code>\"logarithmic\"</code>, <code>\"datetime\"</code> or <code>\"category\"</code>. In a datetime axis, the numbers are given in milliseconds, and tick marks are placed \t\ton appropriate values like full hours or days. In a category axis, the <a href=\"#series.data\">point names</a> of the chart's series are used for categories, if not a <a href=\"#xAxis.categories\">categories</a> array is defined.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-linear/\" target=\"_blank\">\"linear\"</a>, \r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-datetime/\" target=\"_blank\">\"datetime\" with regular intervals</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-datetime-irregular/\" target=\"_blank\">\"datetime\" with irregular intervals</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/type-log/\" target=\"_blank\">\"logarithmic\"</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/type-log-minorgrid/\" target=\"_blank\">\"logarithmic\" with minor grid lines</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-log-both/\" target=\"_blank\">\"logarithmic\" on two axes</a>.",
                        "deprecated": false
                    },
                    {
                        "name": "yAxis--min",
                        "fullname": "yAxis.min",
                        "title": "min",
                        "parent": "yAxis",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "<p>The minimum value of the axis. If <code>null</code> the min value is automatically calculated.</p>\r\n\r\n<p>If the <code>startOnTick</code> option is true, the <code>min</code> value might be rounded down.</p>\r\n\r\n<p>The automatically calculated minimum value is also affected by <a href=\"#yAxis.floor\">floor</a>, <a href=\"#yAxis.minPadding\">minPadding</a>, <a href=\"#yAxis.minRange\">minRange</a> as well as <a href=\"#plotOptions.series.threshold\">series.threshold</a> and <a href=\"#plotOptions.series.softThreshold\">series.softThreshold</a>.</p>",
                        "demo": "Y axis min of <a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/min-startontick-false/\" target=\"_blank\">-50 with startOnTick to false</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/min-startontick-true/\" target=\"_blank\">-50 with startOnTick true by default</a>",
                        "deprecated": false
                    },
                    {
                        "name": "yAxis--max",
                        "fullname": "yAxis.max",
                        "title": "max",
                        "parent": "yAxis",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "The maximum value of the axis. If <code>null</code>, the max value is automatically calculated. If the <code>endOnTick</code> option is true, the <code>max</code> value might be rounded up. The actual maximum value is also influenced by  <a class=\"internal\" href=\"#chart\">chart.alignTicks</a>.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/max-200/\" target=\"_blank\">Y axis max of 200</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/max-logarithmic/\" target=\"_blank\">Y axis max on logarithmic axis</a>"
                    },
                    {
                        "name": "yAxis--opposite",
                        "fullname": "yAxis.opposite",
                        "title": "opposite",
                        "parent": "yAxis",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "false",
                        "description": "Whether to display the axis on the opposite side of the normal. The normal is on the left side for vertical axes and bottom for horizontal, so the opposite sides will be right and top respectively. This is typically used with dual or multiple axes.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/opposite/\" target=\"_blank\">Secondary Y axis opposite</a>"
                    },
                    {
                        "name": "yAxis--reversed",
                        "fullname": "yAxis.reversed",
                        "title": "reversed",
                        "parent": "yAxis",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "false",
                        "description": "Whether to reverse the axis so that the highest number is closest to the origin. If the chart is inverted, the x axis is reversed by default.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/reversed/\" target=\"_blank\">Reversed Y axis</a>",
                        "deprecated": false
                    },
                    {
                        "name": "yAxis-labels--format",
                        "fullname": "yAxis.labels.format",
                        "title": "format",
                        "parent": "yAxis-labels",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "{value}",
                        "since": "3.0",
                        "description": "A <a href=\"http://www.highcharts.com/docs/chart-concepts/labels-and-string-formatting\">format string</a> for the axis label. ",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/labels-format/\" target=\"_blank\">Add units to Y axis label</a>",
                        "deprecated": false
                    },
                    {
                        "name": "yAxis-labels--rotation",
                        "fullname": "yAxis.labels.rotation",
                        "title": "rotation",
                        "parent": "yAxis-labels",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "0",
                        "description": "Rotation of the labels in degrees.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/labels-rotation/\" target=\"_blank\">X axis labels rotated 90°</a>"
                    }
                ]
            }
        ]
    },
    {
        "id": "legend",
        "panelTitle": "Legend",
        "panes": [
            {
                "title": "General",
                "options": [
                    {
                        "name": "legend--enabled",
                        "fullname": "legend.enabled",
                        "title": "enabled",
                        "parent": "legend",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "true",
                        "description": "Enable or disable the legend.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/legend/enabled-false/\" target=\"_blank\">Legend disabled</a>"
                    },
                    {
                        "name": "legend--layout",
                        "fullname": "legend.layout",
                        "title": "layout",
                        "parent": "legend",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "horizontal",
                        "values": "[\"horizontal\", \"vertical\"]",
                        "description": "The layout of the legend items. Can be one of \"horizontal\" or \"vertical\".",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/legend/layout-horizontal/\" target=\"_blank\">Horizontal by default</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/legend/layout-vertical/\" target=\"_blank\">vertical</a>"
                    }
                ]
            },
            {
                "title": "Placement",
                "options": [
                    {
                        "name": "legend--align",
                        "fullname": "legend.align",
                        "title": "align",
                        "parent": "legend",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "center",
                        "values": "[\"left\", \"center\", \"right\"]",
                        "since": "2.0",
                        "description": "<p>The horizontal alignment of the legend box within the chart area. Valid values are <code>left</code>, <code>center</code> and <code>right</code>.</p>\r\n\r\n<p>In the case that the legend is aligned in a corner position, the <code>layout</code> option will determine whether to place it above/below or on the side of the plot area.</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/legend/align/\" target=\"_blank\">Legend at the right of the chart</a>",
                        "deprecated": false
                    },
                    {
                        "name": "legend--verticalAlign",
                        "fullname": "legend.verticalAlign",
                        "title": "verticalAlign",
                        "parent": "legend",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "bottom",
                        "values": "[\"top\", \"middle\", \"bottom\"]",
                        "since": "2.0",
                        "description": "<p>The vertical alignment of the legend box. Can be one of <code>top</code>, <code>middle</code> or  <code>bottom</code>. Vertical position can be further determined by the <code>y</code> option.</p>\r\n\r\n<p>In the case that the legend is aligned in a corner position, the <code>layout</code> option will determine whether to place it above/below or on the side of the plot area.</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/legend/verticalalign/\" target=\"_blank\">Legend 100px from the top of the chart</a>",
                        "deprecated": false
                    }
                ]
            },
            {
                "title": "Color and border",
                "options": []
            }
        ]
    },
    {
        "id": "tooltip",
        "panelTitle": "Tooltip",
        "panes": [
            {
                "title": "General",
                "options": [
                    {
                        "name": "tooltip--headerFormat",
                        "fullname": "tooltip.headerFormat",
                        "title": "headerFormat",
                        "parent": "tooltip",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "",
                        "values": "",
                        "since": "",
                        "description": "<p>The HTML of the tooltip header line. Variables are enclosed by curly brackets. Available variables\t\t\tare <code>point.key</code>, <code>series.name</code>, <code>series.color</code> and other members from the <code>point</code> and <code>series</code> objects. The <code>point.key</code> variable contains the category name, x value or datetime string depending on the type of axis. For datetime axes, the <code>point.key</code> date format can be set using tooltip.xDateFormat.</p>\r \r\n<p>Defaults to <code>&lt;span style=\"font-size: 10px\"&gt;{point.key}&lt;/span&gt;&lt;br/&gt;</code></p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/tooltip/footerformat/\" target=\"_blank\">A HTML table in the tooltip</a>",
                        "seeAlso": "",
                        "deprecated": false
                    },
                    {
                        "name": "tooltip--pointFormat",
                        "fullname": "tooltip.pointFormat",
                        "title": "pointFormat",
                        "parent": "tooltip",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "<span style=\"color:{point.color}\">\\u25CF</span> {series.name}: <b>{point.y}</b><br/>",
                        "since": "2.2",
                        "description": "<p>The HTML of the point's line in the tooltip. Variables are enclosed by curly brackets. Available variables are point.x, point.y, series.name and series.color and other properties on the same form. Furthermore,  point.y can be extended by the <code>tooltip.valuePrefix</code> and <code>tooltip.valueSuffix</code> variables. This can also be overridden for each series, which makes it a good hook for displaying units.</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/tooltip/pointformat/\" target=\"_blank\">A different point format with value suffix</a>",
                        "deprecated": false
                    },
                    {
                        "name": "tooltip--valuePrefix",
                        "fullname": "tooltip.valuePrefix",
                        "title": "valuePrefix",
                        "parent": "tooltip",
                        "isParent": false,
                        "returnType": "String",
                        "since": "2.2",
                        "description": "A string to prepend to each series' y value. Overridable in each series' tooltip options object.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/tooltip/valuedecimals/\" target=\"_blank\">Set decimals, prefix and suffix for the value</a>"
                    },
                    {
                        "name": "tooltip--valueSuffix",
                        "fullname": "tooltip.valueSuffix",
                        "title": "valueSuffix",
                        "parent": "tooltip",
                        "isParent": false,
                        "returnType": "String",
                        "since": "2.2",
                        "description": "A string to append to each series' y value. Overridable in each series' tooltip options object.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/tooltip/valuedecimals/\" target=\"_blank\">Set decimals, prefix and suffix for the value</a>"
                    }
                ]
            },
            {
                "title": "Color and border",
                "options": []
            }
        ]
    },
    {
        "id": "exportingCredits",
        "panelTitle": "Exporting/Credits",
        "panes": [
            {
                "title": "Exporting",
                "options": [
                    {
                        "name": "exporting--enabled",
                        "fullname": "exporting.enabled",
                        "title": "enabled",
                        "parent": "exporting",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "true",
                        "since": "2.0",
                        "description": "Whether to enable the exporting module. Disabling the module will hide the context button, but API methods will still be available.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/exporting/enabled-false/\" target=\"_blank\">Exporting module is loaded but disabled</a>",
                        "deprecated": false
                    }
                ]
            },
            {
                "title": "Credits",
                "options": [
                    {
                        "name": "credits--enabled",
                        "fullname": "credits.enabled",
                        "title": "enabled",
                        "parent": "credits",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "true",
                        "description": "Whether to show the credits text.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/credits/enabled-false/\" target=\"_blank\">Credits disabled</a>"
                    },
                    {
                        "name": "credits--text",
                        "fullname": "credits.text",
                        "title": "text",
                        "parent": "credits",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "Highcharts.com",
                        "description": "The text for the credits label.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/credits/href/\" target=\"_blank\">Custom URL and text</a>"
                    },
                    {
                        "name": "credits--href",
                        "fullname": "credits.href",
                        "title": "href",
                        "parent": "credits",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "http://www.highcharts.com",
                        "description": "The URL for the credits label.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/credits/href/\" target=\"_blank\">Custom URL and text</a>"
                    }
                ]
            }
        ]
    },
    {
        "id": "series",
        "panelTitle": "Series",
        "panes": [
            {
                "title": "Series configuration",
                "options": [
                    {
                        "name": "series--name",
                        "fullname": "series.name",
                        "title": "name",
                        "parent": "series",
                        "isParent": false,
                        "returnType": "String",
                        "description": "The name of the series as shown in the legend, tooltip etc.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/series/name/\" target=\"_blank\">Series name</a>"
                    },
                    {
                        "name": "series--type",
                        "fullname": "series.type",
                        "title": "type",
                        "parent": "series",
                        "isParent": false,
                        "returnType": "String",
                        "values": "[null, \"line\", \"spline\", \"column\", \"area\", \"areaspline\", \"pie\", \"arearange\", \"areasplinerange\", \"boxplot\", \"bubble\", \"columnrange\", \"errorbar\", \"funnel\", \"gauge\", \"scatter\", \"waterfall\"]",
                        "since": "",
                        "description": "The type of series. Can be one of <code>area</code>, <code>areaspline</code>,\r <code>bar</code>, <code>column</code>, <code>line</code>, <code>pie</code>,\r <code>scatter</code> or <code>spline</code>. From version 2.3, <code>arearange</code>, <code>areasplinerange</code> and <code>columnrange</code> are supported with the highcharts-more.js component.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/series/type/\" target=\"_blank\">Line and column in the same chart</a>",
                        "seeAlso": "",
                        "deprecated": false
                    },
                    {
                        "name": "series--index",
                        "fullname": "series.index",
                        "title": "index",
                        "parent": "series",
                        "isParent": false,
                        "returnType": "Number",
                        "since": "2.3.0",
                        "description": "The index of the series in the chart, affecting the internal index in the <code>chart.series</code> array, the visible Z index as well as the order in the legend.",
                        "demo": "",
                        "seeAlso": "",
                        "deprecated": false
                    }
                ],
                "panes": [
                    {
                        "title": "axis",
                        "options": [
                            {
                                "name": "series--xAxis",
                                "fullname": "series.xAxis",
                                "title": "xAxis",
                                "parent": "series",
                                "isParent": false,
                                "returnType": "Number|String",
                                "defaults": "0",
                                "description": "When using dual or multiple x axes, this number defines which xAxis the particular series is connected to. It refers to either the <a href=\"#xAxis.id\">axis id</a> or the index of the axis in the xAxis array, with 0 being the first.",
                                "deprecated": false
                            },
                            {
                                "name": "series--yAxis",
                                "fullname": "series.yAxis",
                                "title": "yAxis",
                                "parent": "series",
                                "isParent": false,
                                "returnType": "Number|String",
                                "defaults": "0",
                                "description": "When using dual or multiple y axes, this number defines which yAxis the particular series is connected to. It refers to either the <a href=\"#yAxis.id\">axis id</a> or the index of the axis in the yAxis array, with 0 being the first.",
                                "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/series/yaxis/\" target=\"_blank\">Apply the column series to the secondary Y axis</a>",
                                "deprecated": false
                            }
                        ]
                    }
                ]
            }
        ]
    }
]
},{}],124:[function(require,module,exports){
var templates = [
    {
        "id": "line",
        "type": "Line charts",
        "icon": "line",
        "templates": [
            {
                "id": "basic",
                "icon": "line_basic",
                "title": "Line chart",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "dataLabels",
                "icon": "line_labels",
                "title": "With data labels",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values. Data labels by default displays the Y value.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "spline",
                "icon": "spline_basic",
                "title": "Spline",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "spline"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "splineDataLabels",
                "icon": "spline_labels",
                "title": "Spline with labels",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "spline"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "splineLogarithmic",

                "title": "Logarithmic",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "spline"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "yAxis": [{
                        "type": "logarithmic"
                    }],
                    "plotOptions": {
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "step",
                "icon": "line_step",
                "title": "Step line",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "step": "left"
                        }
                    }
                }
            },
            {
                "id": "stepWithLabels",
                "icon": "line_step_labels",
                "title": "Step line with labels",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "step": "left",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "inverted",
                "icon": "line_inverted",
                "title": "Inverted",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "line",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "negativeColor",
                "icon": "line_negative_color",
                "title": "Negative color",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "negativeColor": "#0088FF"
                        }
                    }
                }
            },
            {
                "id": "errorBar",
                "icon": "line_errorbar",
                "title": "Error bar",
                "desc": "Requires one data column for X values or categories, subsequently one data column for the series' Y values and two columns for the error bar series maximum and minimum.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "series": [
                        {"type": null},
                        {"type": "errorbar"}
                    ]
                }
            }
        ]
    },
    {
        "id": "area",
        "type": "Area charts",
        "icon": "area",
        "templates": [
            {
                "id": "basic",
                "title": "Area Chart",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "withLabels",
                "title": "Area with labels",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "stacked",
                "title": "Stacked",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "stacking": "normal"
                        }
                    }
                }
            },
            {
                "id": "stackedWithLabels",
                "title": "Stacked with labels",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "stacking": "normal",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "stackedPercentage",
                "title": "Stacked percentage",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "stacking": "percent"
                        }
                    }
                }
            },
            {
                "id": "inverted",
                "title": "Inverted",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "invertedWithLabels",
                "title": "Inverted with labels",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "stacking": "normal",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "stepLine",
                "title": "Step line",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "step": "left"
                        }
                    }
                }
            },
            {
                "id": "negativeColor",
                "title": "Negative color",
                "desc": "Displays negative values with an alternative color. Colors can be set in plotOptions.series.negativeColor. Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "negativeColor": "#0088FF",
                            "color": "#FF000000"
                        }
                    }
                }
            },
            {
                "id": "range",
                "title": "Area range",
                "desc": "Requires one data column for X values or categories, subsequently two data column for each arearange series' Y values.",
                "definition": {
                    "chart": {
                        "type": "arearange"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            }
        ]
    },
    {
        "id": "column",
        "type": "Column charts",
        "icon": "column",
        "templates": [
            {
                "id": "basic",
                "title": "Basic",
                "description": "Grouped column chart. Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "withLabels",
                "title": "With labels",
                "description": "Grouped column chart. Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions":{
                        "series":{
                            "dataLabels":{
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "fixedPlacement",
                "title": "Column with fixed placement",
                "description": "Grouped column chart. Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    chart: {
                        type: 'column'
                    },
                    yAxis: [{
                        min: 0,
                        title: {
                            text: 'Employees'
                        }
                    }, {
                        title: {
                            text: 'Profit (millions)'
                        },
                        opposite: true
                    }],
                    xAxis:[{type:'category'}],
                    tooltip: {
                        shared: true
                    },
                    plotOptions: {
                        column: {
                            grouping: false,
                            shadow: false,
                            borderWidth: 0
                        }
                    },
                    series: [{
                        color: 'rgba(165,170,217,1)',
                        pointPadding: 0.3,
                        pointPlacement: -0.2
                    }, {
                        color: 'rgba(126,86,134,.9)',
                        pointPadding: 0.4,
                        pointPlacement: -0.2
                    }, {
                        color: 'rgba(248,161,63,1)',
                        tooltip: {
                            valuePrefix: '$',
                            valueSuffix: ' M'
                        },
                        pointPadding: 0.3,
                        pointPlacement: 0.2,
                        yAxis: 1
                    }, {
                        color: 'rgba(186,60,61,.9)',
                        tooltip: {
                            valuePrefix: '$',
                            valueSuffix: ' M'
                        },
                        pointPadding: 0.4,
                        pointPlacement: 0.2,
                        yAxis: 1
                    }]
                }
            },
            {
                "id": "3d",
                "title": "Column 3D",
                "description": "Grouped column chart. Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "margin": 75,
                        "options3d": {
                            "enabled": true,
                            "alpha": 15,
                            "beta": 15,
                            "depth": 50,
                            "viewDistance": 15
                        }
                    },
                    "plotOptions": {
                        "column": {
                            "depth": 25
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stacked",
                "title": "Stacked",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "normal"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stackedWithLabels",
                "title": "Stacked with labels",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "normal",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stacked3d",
                "title": "Stacked 3D",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "margin": 75,
                        "options3d": {
                            "enabled": true,
                            "alpha": 15,
                            "beta": 15,
                            "depth": 50,
                            "viewDistance": 15
                        }
                    },
                    "plotOptions": {
                        "column": {
                            "depth": 25
                        },
                        "series": {
                            "stacking": "normal"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stackedPercent",
                "title": "Stacked percent",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "percent"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stackedPercentWithLabels",
                "title": "Stacked percent with labels",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "percent",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "negativeColor",
                "title": "Negative color",
                "desc": "Displays negative values with an alternative color. Colors can be set in plotOptions.series.negativeColor. Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions":{
                        "series":{
                            "negativeColor": "#0088FF",
                            "color": "#FF0000"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "multiColor",
                "title": "Multi color",
                "desc": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions":{
                        "series":{
                            "colorByPoint": true
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "logarithmic",
                "title": "Logarithmic",
                "desc": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "yAxis": [{
                        "type": "logarithmic",
                        "minorTickInterval": "auto"
                    }]
                }
            },
            {
                "id": "range",
                "title": "Columnrange",
                "desc": "Requires one data column for X values or categories, subsequently two data columns for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "columnrange"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "rangeWithLabels",
                "title": "Columnrange with labels",
                "desc": "Requires one data column for X values or categories, subsequently two data columns for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "columnrange"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions":{
                        "series":{
                            "dataLabels":{
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "packed",
                "title": "Packed Columns",
                "desc": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions": {
                        "series": {
                            "pointPadding": 0,
                            "groupPadding": 0,
                            "borderWidth": 0,
                            "shadow": false
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "errorbar",
                "title": "Error bar",
                "desc": "Requires one data column for X values or categories, subsequently one data column for the series' Y values. and two columns for the error bar series maximum and minimum.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "series": [
                        {"type": null},
                        {
                            "type": "errorbar",
                            "showInLegend": true
                        }
                    ],
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            }
        ]
    },
    {
        "id": "bar",
        "type": "Bar charts",
        "icon": "bar",
        "templates": [
            {
                "id": "basic",
                "title": "Basic bar",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "barWithNegativeStack",
                "title": "Bar with negative stack",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    chart: {
                        type: 'bar'
                    },
                    xAxis: [{
                        reversed: false,
                        labels: {
                            step: 1
                        }
                    }, { // mirror axis on right side
                        opposite: true,
                        reversed: false,
                        linkedTo: 0,
                        labels: {
                            step: 1
                        }
                    }],
                    yAxis: [{
                        title: {
                            text: null
                        },
                        labels: {
                            formatter: function () {
                                return Math.abs(this.value) + '%';
                            }
                        }
                    }],
                    plotOptions: {
                        series: {
                            stacking: 'normal'
                        }
                    },
                    tooltip: {
                        formatter: function () {
                            return '<b>' + this.series.name + ', age ' + this.point.category + '</b><br/>' +
                                'Population: ' + Highcharts.numberFormat(Math.abs(this.point.y), 0);
                        }
                    }
                }
            },
            {
                "id": "basicWithLabels",
                "title": "Basic with labels",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions":{
                        "series":{
                            "dataLabels":{
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "stacked",
                "title": "Stacked bar",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "normal"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stackedWithLabels",
                "title": "Stacked with labels",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "normal",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stackedPercentage",
                "title": "Stacked percentage bar",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "percent"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stackedPercentageWithLabels",
                "title": "Stacked percentage bar with labels",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "percent",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "negativeColor",
                "title": "Negative color",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions":{
                        "series":{
                            "negativeColor": "#0088FF",
                            "color": "#FF0000"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "multiColor",
                "title": "Multi color",
                "desc": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "colorByPoint": true
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "horizontalColumnrange",
                "title": "Horizontal columnrange",
                "desc": "Requires one data column for X values or categories, subsequently two data columns for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "columnrange",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "logarithmic",
                "title": "Logarithmic",
                "desc": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "yAxis": [{
                        "type": "logarithmic",
                        "minorTickInterval": "auto"
                    }],
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "horizontalColumnrangeWithLabels",
                "title": "Horizontal columnrange with labels",
                "desc": "Requires one data column for X values or categories, subsequently two data columns for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "columnrange",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "packedBars",
                "title": "Packed Bars",
                "desc": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "pointPadding": 0,
                            "groupPadding": 0,
                            "borderWidth": 0,
                            "shadow": false
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "errorbar",
                "title": "Error bar",
                "desc": "Requires one data column for X values or categories, subsequently one data column for the series' Y values. and two columns for the error bar series maximum and minimum.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "series": [
                        {"type": null},
                        {"type": "errorbar"}
                    ]
                }
            }
        ]
    },
    {
        "id": "scatterAndBubble",
        "type": "Scatter and bubble",
        "icon": "spider",
        "templates": [
            {
                "id": "scatter",
                "title": "Scatter chart",
                "description": "Requires one data column for X values and one for Y values.",
                "definition": {
                    "chart": {
                        "type": "scatter"
                    }
                }
            },
            {
                "id": "bubble",
                "title": "Bubble chart",
                "description": "Requires three data columns: one for X values, one for Y values and one for the size of the bubble (Z value).",
                "definition": {
                    "chart": {
                        "type": "bubble"
                    }
                }
            }
        ]
    },
    {
        "id": "pie",
        "type": "Pie charts",
        "icon": "spider",
        "templates": [
            {
                "id": "basic",
                "title": "Pie chart",
                "description": "Requires two data columns: one for slice names (shown in data labels) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "3d",
                "title": "3D pie chart",
                "description": "Requires two data columns: one for slice names (shown in data labels) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie",
                        "options3d": {
                            "enabled": true,
                            "alpha": 45,
                            "beta": 0
                        }
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "depth": 35,
                            "cursor": "pointer"
                        },
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "withLegend",
                "title": "Pie chart",
                "description": "Requires two data columns: one for slice names (shown in legend) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie"
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "cursor": true,
                            "showInLegend": true,
                            "dataLabels": {
                                "enabled": false
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "3dWithLegend",
                "title": "3D pie with legend",
                "description": "Requires two data columns: one for slice names (shown in legend) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie",
                        "options3d": {
                            "enabled": true,
                            "alpha": 45,
                            "beta": 0
                        }
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "depth": 35,
                            "cursor": "pointer",
                            "showInLegend": true,
                            "dataLabels": {
                                "enabled": false
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "donut",
                "title": "Donut",
                "description": "Requires two data columns: one for slice names (shown in data labels) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie"
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "cursor": true,
                            "innerSize": "60%",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "donutWithLegend",
                "title": "Donut with legend",
                "description": "Requires two data columns: one for slice names (shown in legend) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie"
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "cursor": true,
                            "showInLegend": true,
                            "innerSize": "60%",
                            "dataLabels": {
                                "enabled": false
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "3dDonut",
                "title": "3D donut chart",
                "description": "Requires two data columns: one for slice names (shown in data labels) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie",
                        "options3d": {
                            "enabled": true,
                            "alpha": 45,
                            "beta": 0
                        }
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "depth": 35,
                            "innerSize": "60%",
                            "cursor": "pointer"
                        },
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "3dDonutWithLegend",
                "title": "3D donut chart with legend",
                "description": "Requires two data columns: one for slice names (shown in legend) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie",
                        "options3d": {
                            "enabled": true,
                            "alpha": 45,
                            "beta": 0
                        }
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "depth": 35,
                            "cursor": "pointer",
                            "showInLegend": true,
                            "innerSize": "60%"
                        },
                        "series": {
                            "dataLabels": {
                                "enabled": false
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "semiCircleDonut",
                "title": "Semi circle donut",
                "description": "Requires two data columns: one for slice names (shown in data labels) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie"
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": false,
                            "dataLabels": {
                                "distance": -30,
                                "style": {
                                    "fontWeight": "bold",
                                    "color": "white",
                                    "textShadow": "0px 1px 2px black"
                                }
                            },
                            "innerSize": "50%",
                            "startAngle": -90,
                            "endAngle": 90,
                            "center": ["50%", "75%"]
                        },
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            }
        ]
    },
    {
        "id": "polar",
        "type": "Polar charts",
        "icon": "bar",
        "templates": [
            {
                "id": "line",
                "title": "Polar line",
                "description": "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out).",
                "definition": {
                    "chart": {
                        "type": "line",
                        "polar": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "spider",
                "title": "Spider line",
                "description": "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out).",
                "definition": {
                    "chart": {
                        "type": "line",
                        "polar": true
                    },
                    "xAxis": [{
                        "type": "category",
                        "tickmarkPlacement": "on",
                        "lineWidth": 0
                    }],
                    "yAxis": [{
                        "lineWidth": 0,
                        "gridLineInterpolation": "polygon"
                    }]
                }
            },
            {
                "id": "area",
                "title": "Polar area",
                "description": "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out).",
                "definition": {
                    "chart": {
                        "type": "area",
                        "polar": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "spiderArea",
                "title": "Spider area",
                "description": "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out).",
                "definition": {
                    "chart": {
                        "type": "area",
                        "polar": true
                    },
                    "xAxis": [{
                        "type": "category",
                        "tickmarkPlacement": "on",
                        "lineWidth": 0
                    }],
                    "yAxis": [{
                        "lineWidth": 0,
                        "gridLineInterpolation": "polygon"
                    }]
                }
            },
            {
                "id": "appleWatchIsh",
                "title": "Activity Gauge",
                "description": "",
                "definition": {
                    chart: {
                        type: 'solidgauge',
                        marginTop: 50
                    },
                    tooltip: {
                        borderWidth: 0,
                        backgroundColor: 'none',
                        shadow: false,
                        style: {
                            fontSize: '16px'
                        },
                        positioner: function (labelWidth, labelHeight) {
                            return {
                                x: 200 - labelWidth / 2,
                                y: 180
                            };
                        },
                        pointFormat: '{series.name}<br><span style="font-size:2em; color: {point.color}; font-weight: bold">{point.y}%</span>'
                    },

                    pane: {
                        startAngle: 0,
                        endAngle: 360,
                        background: [{ // Track for Move
                            outerRadius: '112%',
                            innerRadius: '88%',
                            backgroundColor: Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0.3).get(),
                            borderWidth: 0
                        }, { // Track for Exercise
                            outerRadius: '87%',
                            innerRadius: '63%',
                            backgroundColor: Highcharts.Color(Highcharts.getOptions().colors[1]).setOpacity(0.3).get(),
                            borderWidth: 0
                        }, { // Track for Stand
                            outerRadius: '62%',
                            innerRadius: '38%',
                            backgroundColor: Highcharts.Color(Highcharts.getOptions().colors[2]).setOpacity(0.3).get(),
                            borderWidth: 0
                        }]
                    },

                    yAxis: [{
                        min: 0,
                        max: 100,
                        lineWidth: 0,
                        tickPositions: []
                    }],

                    plotOptions: {
                        solidgauge: {
                            borderWidth: '34px',
                            dataLabels: {
                                enabled: false
                            },
                            linecap: 'round',
                            stickyTracking: false
                        }
                    },

                    series: [{
                        borderColor: Highcharts.getOptions().colors[0],
                        data: {
                            color: Highcharts.getOptions().colors[0],
                            radius: '100%',
                            innerRadius: '100%'

                        }
                    }, {

                        borderColor: Highcharts.getOptions().colors[1],
                        data: {
                            color: Highcharts.getOptions().colors[1],
                            radius: '75%',
                            innerRadius: '75%'
                        }
                    }, {
                        borderColor: Highcharts.getOptions().colors[2],
                        data: {
                            color: Highcharts.getOptions().colors[2],
                            radius: '50%',
                            innerRadius: '50%'
                        }
                    }]

                }
            },
            {
                "id": "appleWatch",
                "title": "Activity Gauge (Apple Watch)",
                "description": "",
                "definition": {
                    chart: {
                        type: 'solidgauge',
                        marginTop: 50,
                        backgroundColor: 'black',
                        width:400,
                        events:{
                            load: function(){
                                this.renderer.path(['M', -8, 0, 'L', 8, 0, 'M', 0, -8, 'L', 8, 0, 0, 8])
                                    .attr({
                                        'stroke': '#303030',
                                        'stroke-linecap': 'round',
                                        'stroke-linejoin': 'round',
                                        'stroke-width': 2,
                                        'zIndex': 10
                                    })
                                    .translate(190, 26)
                                    .add(this.series[2].group);

                                // Exercise icon
                                this.renderer.path(['M', -8, 0, 'L', 8, 0, 'M', 0, -8, 'L', 8, 0, 0, 8, 'M', 8, -8, 'L', 16, 0, 8, 8])
                                    .attr({
                                        'stroke': '#303030',
                                        'stroke-linecap': 'round',
                                        'stroke-linejoin': 'round',
                                        'stroke-width': 2,
                                        'zIndex': 10
                                    })
                                    .translate(190, 61)
                                    .add(this.series[2].group);

                                // Stand icon
                                this.renderer.path(['M', 0, 8, 'L', 0, -8, 'M', -8, 0, 'L', 0, -8, 8, 0])
                                    .attr({
                                        'stroke': '#303030',
                                        'stroke-linecap': 'round',
                                        'stroke-linejoin': 'round',
                                        'stroke-width': 2,
                                        'zIndex': 10
                                    })
                                    .translate(190, 96)
                                    .add(this.series[2].group);
                            }
                        }
                    },
                    //colors: ['#F62366', '#9DFF02', '#0CCDD6'],

                    title: {
                        text: 'Activity',
                        style: {
                            fontSize: '24px',
                            color: 'silver'
                        }
                    },

                    tooltip: {
                        borderWidth: 0,
                        backgroundColor: 'none',
                        shadow: false,
                        style: {
                            fontSize: '16px',
                            color: 'silver'
                        },
                        positioner: function (labelWidth, labelHeight) {
                            return {
                                x: 200 - labelWidth / 2,
                                y: 180
                            };
                        },
                        pointFormat: '{series.name}<br><span style="font-size:2em; color: {point.color}; font-weight: bold">{point.y}%</span>'
                    },

                    pane: {
                        startAngle: 0,
                        endAngle: 360,
                        background: [{ // Track for Move
                            outerRadius: '112%',
                            innerRadius: '88%',
                            backgroundColor: Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0.3).get(),
                            borderWidth: 0
                        }, { // Track for Exercise
                            outerRadius: '87%',
                            innerRadius: '63%',
                            backgroundColor: Highcharts.Color(Highcharts.getOptions().colors[1]).setOpacity(0.3).get(),
                            borderWidth: 0
                        }, { // Track for Stand
                            outerRadius: '62%',
                            innerRadius: '38%',
                            backgroundColor: Highcharts.Color(Highcharts.getOptions().colors[2]).setOpacity(0.3).get(),
                            borderWidth: 0
                        }]
                    },

                    yAxis: [{
                        min: 0,
                        max: 100,
                        lineWidth: 0,
                        tickPositions: []
                    }],

                    plotOptions: {
                        solidgauge: {
                            borderWidth: '34px',
                            dataLabels: {
                                enabled: false
                            },
                            linecap: 'round',
                            stickyTracking: false
                        }
                    },

                    series: [{
                        borderColor: Highcharts.getOptions().colors[0],
                        data: {
                            color: Highcharts.getOptions().colors[0],
                            radius: '100%',
                            innerRadius: '100%'

                        }
                    }, {

                        borderColor: Highcharts.getOptions().colors[1],
                        data: {
                            color: Highcharts.getOptions().colors[1],
                            radius: '75%',
                            innerRadius: '75%'
                        }
                    }, {
                        borderColor: Highcharts.getOptions().colors[2],
                        data: {
                            color: Highcharts.getOptions().colors[2],
                            radius: '50%',
                            innerRadius: '50%'
                        }
                    }]

                }
            }
        ]
    },
    {
        "id": "combinationCharts",
        "type": "combination charts",
        "icon": "line",
        "templates": [
            {
                "id": "multipleAxes",
                "title": "Multiple axes",
                "description": "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out).",
                "definition": {
                    chart: {
                        zoomType: 'xy'
                    },
                    title: {
                        text: 'Average Monthly Weather Data for Tokyo'
                    },
                    subtitle: {
                        text: 'Source: WorldClimate.com'
                    },
                    xAxis: [{
                        type: 'category',
                        crosshair: true
                    }],
                    yAxis: [{ // Primary yAxis
                        labels: {
                            format: '{value}°C',
                            style: {
                                color: Highcharts.getOptions().colors[2]
                            }
                        },
                        title: {
                            text: 'Temperature',
                            style: {
                                color: Highcharts.getOptions().colors[2]
                            }
                        },
                        opposite: true

                    }, { // Secondary yAxis
                        gridLineWidth: 0,
                        title: {
                            text: 'Rainfall',
                            style: {
                                color: Highcharts.getOptions().colors[0]
                            }
                        },
                        labels: {
                            format: '{value} mm',
                            style: {
                                color: Highcharts.getOptions().colors[0]
                            }
                        }

                    }, { // Tertiary yAxis
                        gridLineWidth: 0,
                        title: {
                            text: 'Sea-Level Pressure',
                            style: {
                                color: Highcharts.getOptions().colors[1]
                            }
                        },
                        labels: {
                            format: '{value} mb',
                            style: {
                                color: Highcharts.getOptions().colors[1]
                            }
                        },
                        opposite: true
                    }],
                    tooltip: {
                        shared: true
                    },
                    legend: {
                        layout: 'vertical',
                        align: 'left',
                        x: 80,
                        verticalAlign: 'top',
                        y: 55,
                        floating: true,
                        backgroundColor: (Highcharts.theme && Highcharts.theme.legendBackgroundColor) || '#FFFFFF'
                    },
                    series: [{
                        type: 'column',
                        yAxis: 1,
                        tooltip: {
                            valueSuffix: ' mm'
                        }

                    }, {
                        type: 'spline',
                        yAxis: 2,
                        marker: {
                            enabled: false
                        },
                        dashStyle: 'shortdot',
                        tooltip: {
                            valueSuffix: ' mb'
                        }

                    }, {
                        type: 'spline',
                        tooltip: {
                            valueSuffix: ' °C'
                        }
                    }]
                }
            },
            {
                "id": "scatterWithLine",
                "title": "Scatter with line",
                "description": "Requires one data column for X values and one for Y values.",
                "definition": {
                    "chart": {
                        "type": "scatter"
                    },
                    "plotOptions":{
                        "series":{
                            "lineWidth": 1
                        }
                    }
                }
            },
            {
                "id": "scatterWithLineNoMarker",
                "title": "Scatter with line, no marker",
                "description": "Requires one data column for X values and one for Y values.",
                "definition": {
                    "chart": {
                        "type": "scatter"
                    },
                    "plotOptions":{
                        "series":{
                            "lineWidth": 1,
                            "marker":{
                                "enabled": false
                            }
                        }
                    }
                }
            },
            {
                "id": "combinationColumn",
                "title": "Combination chart",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "series": [
                        {"type": null},
                        {"type": "column"}
                    ]
                }
            },
            // todo
            {
                "id": "colSplinePie",
                "title": "Combination chart (col, spline, pie)",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    title: {
                        text: 'Combination chart'
                    },
                    xAxis: {
                        type: 'category'
                    },
                    labels: {
                        items: [{
                            html: 'Total fruit consumption',
                            style: {
                                left: '50px',
                                top: '18px',
                                color: (Highcharts.theme && Highcharts.theme.textColor) || 'black'
                            }
                        }]
                    },
                    series: [{
                        type: 'column',
                        name: 'Jane'
                    }, {
                        type: 'column',
                        name: 'John'
                    }, {
                        type: 'column',
                        name: 'Joe'
                    }, {
                        type: 'spline',
                        name: 'Average',
                        marker: {
                            lineWidth: 2,
                            lineColor: Highcharts.getOptions().colors[3],
                            fillColor: 'white'
                        }
                    }, {
                        type: 'pie',
                        //name: 'Total consumption',
                        /*data: [{
                            name: 'Jane',
                            color: Highcharts.getOptions().colors[0] // Jane's color
                        }, {
                            name: 'John',
                            color: Highcharts.getOptions().colors[1] // John's color
                        }, {
                            name: 'Joe',
                            color: Highcharts.getOptions().colors[2] // Joe's color
                        }],*/
                        center: [100, 80],
                        size: 100,
                        showInLegend: false,
                        dataLabels: {
                            enabled: false
                        }
                    }]
                }
            }
        ]
    }
];
module.exports = templates;
},{}],125:[function(require,module,exports){
(function () {
    var includeFolder = undefined,
        icons = (function(){var self={},fs = require("fs");
self["area"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-461 322 100 100\" style=\"enable-background:new -461 322 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-366,419h-90.5c-0.8,0-1.5-0.7-1.5-1.5V327c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v89h89c0.8,0,1.5,0.7,1.5,1.5\r\n\t\t\tS-365.2,419-366,419z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-402,382c-0.3,0-0.5-0.1-0.7-0.3l-30.3-30.3l-22.3,22.3c-0.4,0.4-1,0.4-1.4,0s-0.4-1,0-1.4l23-23c0.4-0.4,1-0.4,1.4,0\r\n\t\t\tl31,31c0.4,0.4,0.4,1,0,1.4C-401.5,381.9-401.7,382-402,382z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-372,418c-0.6,0-1-0.4-1-1v-65.5l-37.3,40.1c-0.2,0.2-0.4,0.3-0.7,0.3c-0.3,0-0.5-0.1-0.7-0.3l-21.3-21.3l-22.3,22.3\r\n\t\t\tc-0.4,0.4-1,0.4-1.4,0s-0.4-1,0-1.4l23-23c0.4-0.4,1-0.4,1.4,0l21.3,21.3l38.3-41.2c0.3-0.3,0.7-0.4,1.1-0.2\r\n\t\t\tc0.4,0.1,0.6,0.5,0.6,0.9v68C-371,417.6-371.4,418-372,418z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["bar"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-461 322 100 100\" style=\"enable-background:new -461 322 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-366,419h-90.5c-0.8,0-1.5-0.7-1.5-1.5V327c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v89h89c0.8,0,1.5,0.7,1.5,1.5\r\n\t\t\tS-365.2,419-366,419z\"/>\r\n\t</g>\r\n\t<path d=\"M-421,365v16h-34v-16H-421 M-421,363h-34c-1.1,0-2,0.9-2,2v16c0,1.1,0.9,2,2,2h34c1.1,0,2-0.9,2-2v-16\r\n\t\tC-419,363.9-419.9,363-421,363L-421,363z\"/>\r\n\t<path d=\"M-401,340v17h-54v-17H-401 M-401,338h-54c-1.1,0-2,0.9-2,2v17c0,1.1,0.9,2,2,2h54c1.1,0,2-0.9,2-2v-17\r\n\t\tC-399,338.9-399.9,338-401,338L-401,338z\"/>\r\n\t<path d=\"M-381,389v17h-74v-17H-381 M-381,387h-74c-1.1,0-2,0.9-2,2v17c0,1.1,0.9,2,2,2h74c1.1,0,2-0.9,2-2v-17\r\n\t\tC-379,387.9-379.9,387-381,387L-381,387z\"/>\r\n</g>\r\n</svg>\r\n";
self["bubble"] = "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" version=\"1.1\" x=\"0px\" y=\"0px\" viewBox=\"0 0 100 125\" enable-background=\"new 0 0 100 100\" xml:space=\"preserve\"><g><g><path d=\"M95,97H4.5C3.671,97,3,96.328,3,95.5V5c0-0.829,0.671-1.5,1.5-1.5S6,4.171,6,5v89h89c0.828,0,1.5,0.672,1.5,1.5    S95.828,97,95,97z\"/></g><g><path d=\"M50.5,63.5C42.505,63.5,36,56.995,36,49s6.505-14.5,14.5-14.5S65,41.005,65,49S58.495,63.5,50.5,63.5z M50.5,36.5    C43.607,36.5,38,42.107,38,49s5.607,12.5,12.5,12.5S63,55.893,63,49S57.393,36.5,50.5,36.5z\"/></g><g><path d=\"M23.5,71.5c-4.687,0-8.5-3.813-8.5-8.5s3.813-8.5,8.5-8.5S32,58.313,32,63S28.187,71.5,23.5,71.5z M23.5,56.5    c-3.584,0-6.5,2.916-6.5,6.5s2.916,6.5,6.5,6.5S30,66.584,30,63S27.084,56.5,23.5,56.5z\"/></g><g><path d=\"M76.5,58.5c-4.687,0-8.5-3.813-8.5-8.5c0-4.687,3.813-8.5,8.5-8.5S85,45.313,85,50C85,54.687,81.187,58.5,76.5,58.5z     M76.5,43.5c-3.584,0-6.5,2.916-6.5,6.5s2.916,6.5,6.5,6.5S83,53.584,83,50S80.084,43.5,76.5,43.5z\"/></g><g><path d=\"M51.5,31.5c-4.687,0-8.5-3.813-8.5-8.5s3.813-8.5,8.5-8.5c4.687,0,8.5,3.813,8.5,8.5S56.187,31.5,51.5,31.5z M51.5,16.5    c-3.584,0-6.5,2.916-6.5,6.5s2.916,6.5,6.5,6.5S58,26.584,58,23S55.084,16.5,51.5,16.5z\"/></g></g><text x=\"0\" y=\"115\" fill=\"#000000\" font-size=\"5px\" font-weight=\"bold\" font-family=\"'Helvetica Neue', Helvetica, Arial-Unicode, Arial, Sans-serif\">Created by Agus Purwanto</text><text x=\"0\" y=\"120\" fill=\"#000000\" font-size=\"5px\" font-weight=\"bold\" font-family=\"'Helvetica Neue', Helvetica, Arial-Unicode, Arial, Sans-serif\">from the Noun Project</text></svg>";
self["chart"] = "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\"><svg xmlns:xlink=\"http://www.w3.org/1999/xlink\" version=\"1.1\" style=\"font-family:'lucida grande', 'lucida sans unicode', arial, helvetica, sans-serif;font-size:12px;\" xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"400\"><desc>Created with Highcharts 4.1.9</desc><defs><clipPath id=\"highcharts-10\"><rect x=\"0\" y=\"0\" width=\"273\" height=\"497\"></rect></clipPath></defs><rect x=\"0\" y=\"0\" width=\"600\" height=\"400\" strokeWidth=\"0\" fill=\"#FFFFFF\" class=\" highcharts-background\"></rect><g class=\"highcharts-grid\" ></g><g class=\"highcharts-grid\" ><path fill=\"none\" d=\"M 92.5 42 L 92.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 142.5 42 L 142.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 191.5 42 L 191.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 241.5 42 L 241.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 291.5 42 L 291.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 341.5 42 L 341.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 390.5 42 L 390.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 440.5 42 L 440.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 490.5 42 L 490.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 539.5 42 L 539.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 590.5 42 L 590.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path></g><g class=\"highcharts-axis\" ><path fill=\"none\" d=\"M 93 97.5 L 83 97.5\" stroke=\"#C0D0E0\" stroke-width=\"1\" opacity=\"1\"></path><path fill=\"none\" d=\"M 93 151.5 L 83 151.5\" stroke=\"#C0D0E0\" stroke-width=\"1\" opacity=\"1\"></path><path fill=\"none\" d=\"M 93 206.5 L 83 206.5\" stroke=\"#C0D0E0\" stroke-width=\"1\" opacity=\"1\"></path><path fill=\"none\" d=\"M 93 260.5 L 83 260.5\" stroke=\"#C0D0E0\" stroke-width=\"1\" opacity=\"1\"></path><path fill=\"none\" d=\"M 93 315.5 L 83 315.5\" stroke=\"#C0D0E0\" stroke-width=\"1\" opacity=\"1\"></path><path fill=\"none\" d=\"M 93 41.5 L 83 41.5\" stroke=\"#C0D0E0\" stroke-width=\"1\" opacity=\"1\"></path><path fill=\"none\" d=\"M 92.5 42 L 92.5 315\" stroke=\"#C0D0E0\" stroke-width=\"1\"  visibility=\"visible\"></path></g><g class=\"highcharts-axis\" ><text x=\"341.5\"  text-anchor=\"middle\" transform=\"translate(0,0)\" class=\" highcharts-yaxis-title\" style=\"color:#707070;fill:#707070;\" visibility=\"visible\" y=\"350\">Values</text></g><g class=\"highcharts-series-group\" ><g class=\"highcharts-series highcharts-series-0\" visibility=\"visible\"  transform=\"translate(590,315) rotate(90) scale(-1,1) scale(1 1)\" width=\"497\" height=\"273\" clip-path=\"url(#highcharts-10)\"><rect x=\"218\" y=\"399\" width=\"19\" height=\"99\" fill=\"#7cb5ec\" rx=\"0\" ry=\"0\"></rect><rect x=\"164\" y=\"399\" width=\"18\" height=\"99\" fill=\"#7cb5ec\" rx=\"0\" ry=\"0\"></rect><rect x=\"109\" y=\"399\" width=\"18\" height=\"99\" fill=\"#7cb5ec\" rx=\"0\" ry=\"0\"></rect><rect x=\"55\" y=\"399\" width=\"18\" height=\"99\" fill=\"#7cb5ec\" rx=\"0\" ry=\"0\"></rect><rect x=\"0\" y=\"399\" width=\"18\" height=\"99\" fill=\"#7cb5ec\" rx=\"0\" ry=\"0\"></rect></g><g class=\"highcharts-markers highcharts-series-0\" visibility=\"visible\"  transform=\"translate(590,315) rotate(90) scale(-1,1) scale(1 1)\" width=\"497\" height=\"273\" clip-path=\"none\"></g><g class=\"highcharts-series highcharts-series-1\" visibility=\"visible\"  transform=\"translate(590,315) rotate(90) scale(-1,1) scale(1 1)\" width=\"497\" height=\"273\" clip-path=\"url(#highcharts-10)\"><rect x=\"237\" y=\"158\" width=\"18\" height=\"340\" fill=\"#434348\" rx=\"0\" ry=\"0\"></rect><rect x=\"182\" y=\"230\" width=\"18\" height=\"268\" fill=\"#434348\" rx=\"0\" ry=\"0\"></rect><rect x=\"127\" y=\"216\" width=\"19\" height=\"282\" fill=\"#434348\" rx=\"0\" ry=\"0\"></rect><rect x=\"73\" y=\"92\" width=\"18\" height=\"406\" fill=\"#434348\" rx=\"0\" ry=\"0\"></rect><rect x=\"18\" y=\"122\" width=\"18\" height=\"376\" fill=\"#434348\" rx=\"0\" ry=\"0\"></rect></g><g class=\"highcharts-markers highcharts-series-1\" visibility=\"visible\"  transform=\"translate(590,315) rotate(90) scale(-1,1) scale(1 1)\" width=\"497\" height=\"273\" clip-path=\"none\"></g><g class=\"highcharts-series highcharts-series-2\" visibility=\"visible\"  transform=\"translate(590,315) rotate(90) scale(-1,1) scale(1 1)\" width=\"497\" height=\"273\" clip-path=\"url(#highcharts-10)\"><rect x=\"255\" y=\"142\" width=\"18\" height=\"356\" fill=\"#90ed7d\" rx=\"0\" ry=\"0\"></rect><rect x=\"200\" y=\"214\" width=\"18\" height=\"284\" fill=\"#90ed7d\" rx=\"0\" ry=\"0\"></rect><rect x=\"146\" y=\"202\" width=\"18\" height=\"296\" fill=\"#90ed7d\" rx=\"0\" ry=\"0\"></rect><rect x=\"91\" y=\"61\" width=\"18\" height=\"437\" fill=\"#90ed7d\" rx=\"0\" ry=\"0\"></rect><rect x=\"36\" y=\"102\" width=\"19\" height=\"396\" fill=\"#90ed7d\" rx=\"0\" ry=\"0\"></rect></g><g class=\"highcharts-markers highcharts-series-2\" visibility=\"visible\"  transform=\"translate(590,315) rotate(90) scale(-1,1) scale(1 1)\" width=\"497\" height=\"273\" clip-path=\"none\"></g></g><text x=\"300\" text-anchor=\"middle\" class=\"highcharts-title\"  style=\"color:#333333;font-size:18px;fill:#333333;width:536px;\" y=\"24\"><tspan>Chart title</tspan></text><g class=\"highcharts-legend\"  transform=\"translate(180,362)\"><g ><g><g class=\"highcharts-legend-item\"  transform=\"translate(8,3)\"><text x=\"21\" style=\"color:#333333;font-size:12px;font-weight:bold;cursor:pointer;fill:#333333;\" text-anchor=\"start\"  y=\"15\">test</text><rect x=\"0\" y=\"4\" width=\"16\" height=\"12\"  fill=\"#7cb5ec\"></rect></g><g class=\"highcharts-legend-item\"  transform=\"translate(71,3)\"><text x=\"21\" y=\"15\" style=\"color:#333333;font-size:12px;font-weight:bold;cursor:pointer;fill:#333333;\" text-anchor=\"start\" >lowpoint</text><rect x=\"0\" y=\"4\" width=\"16\" height=\"12\"  fill=\"#434348\"></rect></g><g class=\"highcharts-legend-item\"  transform=\"translate(159,3)\"><text x=\"21\" y=\"15\" style=\"color:#333333;font-size:12px;font-weight:bold;cursor:pointer;fill:#333333;\" text-anchor=\"start\" >highpoint</text><rect x=\"0\" y=\"4\" width=\"16\" height=\"12\"  fill=\"#90ed7d\"></rect></g></g></g></g><g class=\"highcharts-axis-labels highcharts-xaxis-labels\" ><text x=\"78\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;width:188px;text-overflow:clip;\" text-anchor=\"end\" transform=\"translate(0,0)\" y=\"75\" opacity=\"1\"><tspan>experiment 6</tspan></text><text x=\"78\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;width:188px;text-overflow:clip;\" text-anchor=\"end\" transform=\"translate(0,0)\" y=\"130\" opacity=\"1\"><tspan>experiment 7</tspan></text><text x=\"78\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;width:188px;text-overflow:clip;\" text-anchor=\"end\" transform=\"translate(0,0)\" y=\"185\" opacity=\"1\"><tspan>experiment 8</tspan></text><text x=\"78\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;width:188px;text-overflow:clip;\" text-anchor=\"end\" transform=\"translate(0,0)\" y=\"239\" opacity=\"1\"><tspan>experiment 9</tspan></text><text x=\"78\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;width:188px;text-overflow:clip;\" text-anchor=\"end\" transform=\"translate(0,0)\" y=\"294\" opacity=\"1\"><tspan>experiment 10</tspan></text></g><g class=\"highcharts-axis-labels highcharts-yaxis-labels\" ><text x=\"93\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">0</text><text x=\"142.7\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">25</text><text x=\"192.4\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">50</text><text x=\"242.1\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">75</text><text x=\"291.8\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">100</text><text x=\"341.5\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">125</text><text x=\"391.2\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">150</text><text x=\"440.9\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">175</text><text x=\"490.6\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">200</text><text x=\"540.3\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">225</text><text x=\"581\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">250</text></g><g class=\"highcharts-tooltip\"  style=\"cursor:default;padding:0;pointer-events:none;white-space:nowrap;\" transform=\"translate(0,-9999)\"><path fill=\"none\" d=\"M 3.5 0.5 L 13.5 0.5 C 16.5 0.5 16.5 0.5 16.5 3.5 L 16.5 13.5 C 16.5 16.5 16.5 16.5 13.5 16.5 L 3.5 16.5 C 0.5 16.5 0.5 16.5 0.5 13.5 L 0.5 3.5 C 0.5 0.5 0.5 0.5 3.5 0.5\"  stroke=\"black\" stroke-opacity=\"0.049999999999999996\" stroke-width=\"5\" transform=\"translate(1, 1)\"></path><path fill=\"none\" d=\"M 3.5 0.5 L 13.5 0.5 C 16.5 0.5 16.5 0.5 16.5 3.5 L 16.5 13.5 C 16.5 16.5 16.5 16.5 13.5 16.5 L 3.5 16.5 C 0.5 16.5 0.5 16.5 0.5 13.5 L 0.5 3.5 C 0.5 0.5 0.5 0.5 3.5 0.5\"  stroke=\"black\" stroke-opacity=\"0.09999999999999999\" stroke-width=\"3\" transform=\"translate(1, 1)\"></path><path fill=\"none\" d=\"M 3.5 0.5 L 13.5 0.5 C 16.5 0.5 16.5 0.5 16.5 3.5 L 16.5 13.5 C 16.5 16.5 16.5 16.5 13.5 16.5 L 3.5 16.5 C 0.5 16.5 0.5 16.5 0.5 13.5 L 0.5 3.5 C 0.5 0.5 0.5 0.5 3.5 0.5\"  stroke=\"black\" stroke-opacity=\"0.15\" stroke-width=\"1\" transform=\"translate(1, 1)\"></path><path fill=\"rgb(249, 249, 249)\" fill-opacity=\" .85\" d=\"M 3.5 0.5 L 13.5 0.5 C 16.5 0.5 16.5 0.5 16.5 3.5 L 16.5 13.5 C 16.5 16.5 16.5 16.5 13.5 16.5 L 3.5 16.5 C 0.5 16.5 0.5 16.5 0.5 13.5 L 0.5 3.5 C 0.5 0.5 0.5 0.5 3.5 0.5\"></path><text x=\"8\"  style=\"font-size:12px;color:#333333;fill:#333333;\" y=\"20\"></text></g><text x=\"590\" text-anchor=\"end\"  style=\"cursor:pointer;color:#909090;font-size:9px;fill:#909090;\" y=\"395\">Highcharts.com</text></svg>";
self["columnStackedPercent"] = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<!-- Generator: Adobe Illustrator 19.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\r\n<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-545 791.8 100 100\" style=\"enable-background:new -545 791.8 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-453,891.8h-90.5c-0.8,0-1.5-0.7-1.5-1.5v-90.5c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v89h89c0.8,0,1.5,0.7,1.5,1.5\r\n\t\t\tS-452.2,891.8-453,891.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-490,844.8v44h-16v-44H-490 M-490,842.8h-16c-1.1,0-2,0.9-2,2v44c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2v-44\r\n\t\t\tC-488,843.7-488.9,842.8-490,842.8L-490,842.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-490,818.8v24h-16v-24H-490 M-490,816.8h-16c-1.1,0-2,0.9-2,2v24c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2v-24\r\n\t\t\tC-488,817.7-488.9,816.8-490,816.8L-490,816.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-514,854.8v34h-17v-34H-514 M-514,852.8h-17c-1.1,0-2,0.9-2,2v34c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-34\r\n\t\t\tC-512,853.7-512.9,852.8-514,852.8L-514,852.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-514,818.8v34h-17v-34H-514 M-514,816.8h-17c-1.1,0-2,0.9-2,2v34c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-34\r\n\t\t\tC-512,817.7-512.9,816.8-514,816.8L-514,816.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-465,864.8v24h-17v-24H-465 M-465,862.8h-17c-1.1,0-2,0.9-2,2v24c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-24\r\n\t\t\tC-463,863.7-463.9,862.8-465,862.8L-465,862.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-465,818.8v44h-17v-44H-465 M-465,816.8h-17c-1.1,0-2,0.9-2,2v44c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-44\r\n\t\t\tC-463,817.7-463.9,816.8-465,816.8L-465,816.8z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["columnStacked"] = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<!-- Generator: Adobe Illustrator 19.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\r\n<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-545 791.8 100 100\" style=\"enable-background:new -545 791.8 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-453,891.8h-90.5c-0.8,0-1.5-0.7-1.5-1.5v-90.5c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v89h89c0.8,0,1.5,0.7,1.5,1.5\r\n\t\t\tS-452.2,891.8-453,891.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-490,854.8v34h-16v-34H-490 M-490,852.8h-16c-1.1,0-2,0.9-2,2v34c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2v-34\r\n\t\t\tC-488,853.7-488.9,852.8-490,852.8L-490,852.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-490,838.8v14h-16v-14H-490 M-490,836.8h-16c-1.1,0-2,0.9-2,2v14c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2v-14\r\n\t\t\tC-488,837.7-488.9,836.8-490,836.8L-490,836.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-514,864.8v24h-17v-24H-514 M-514,862.8h-17c-1.1,0-2,0.9-2,2v24c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-24\r\n\t\t\tC-512,863.7-512.9,862.8-514,862.8L-514,862.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-514,818.8v44h-17v-44H-514 M-514,816.8h-17c-1.1,0-2,0.9-2,2v44c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-44\r\n\t\t\tC-512,817.7-512.9,816.8-514,816.8L-514,816.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-465,874.8v14h-17v-14H-465 M-465,872.8h-17c-1.1,0-2,0.9-2,2v14c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-14\r\n\t\t\tC-463,873.7-463.9,872.8-465,872.8L-465,872.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-465,828.8v44h-17v-44H-465 M-465,826.8h-17c-1.1,0-2,0.9-2,2v44c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-44\r\n\t\t\tC-463,827.7-463.9,826.8-465,826.8L-465,826.8z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["column"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-461 322 100 100\" style=\"enable-background:new -461 322 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-366,419h-90.5c-0.8,0-1.5-0.7-1.5-1.5V327c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v89h89c0.8,0,1.5,0.7,1.5,1.5\r\n\t\t\tS-365.2,419-366,419z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-403,382v34h-16v-34H-403 M-403,380h-16c-1.1,0-2,0.9-2,2v34c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2v-34\r\n\t\t\tC-401,380.9-401.9,380-403,380L-403,380z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-427,362v54h-17v-54H-427 M-427,360h-17c-1.1,0-2,0.9-2,2v54c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-54\r\n\t\t\tC-425,360.9-425.9,360-427,360L-427,360z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-378,342v74h-17v-74H-378 M-378,340h-17c-1.1,0-2,0.9-2,2v74c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-74\r\n\t\t\tC-376,340.9-376.9,340-378,340L-378,340z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["iconInfo"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t width=\"512px\" height=\"512px\" viewBox=\"0 0 512 512\" enable-background=\"new 0 0 512 512\" xml:space=\"preserve\">\r\n<g>\r\n\t<path fill=\"#aaa\" d=\"M256,0C114.609,0,0,114.609,0,256s114.609,256,256,256s256-114.609,256-256S397.391,0,256,0z M256,472\r\n\t\tc-119.297,0-216-96.703-216-216S136.703,40,256,40s216,96.703,216,216S375.297,472,256,472z\"/>\r\n\t<rect fill=\"#aaa\" x=\"240\" y=\"352\" width=\"32\" height=\"32\"/>\r\n\t<path fill=\"#aaa\" d=\"M317.734,150.148c-6.484-6.625-14.688-11.922-24.766-16.031c-10.203-4.102-22.172-6.117-36.281-6.117\r\n\t\tc-11.969,0-22.875,2.016-32.781,6.117c-9.938,4.109-18.5,9.773-25.688,17.125c-7.125,7.289-12.672,14.508-16.5,24.773\r\n\t\tC177.906,186.281,176,192,176,208h32.656c0-16,4.234-28.109,12.938-38.516c8.594-10.453,20.266-14.82,35.094-14.82\r\n\t\tc14.438,0,25.234,3.914,32.172,10.938c6.875,7.023,10.391,17.086,10.391,29.797c0,9.883-3.25,18.758-9.734,26.492\r\n\t\tc-6.375,7.75-13.359,15.297-20.844,22.438c-7.594,7.141-13.672,14.766-19.953,22.641S240,284.016,240,294.469V320h32v-13.75\r\n\t\tc0-8.203,1.203-15.312,4.406-21.516c3.094-6.219,6.953-11.859,11.844-16.891c4.734-5.094,9.812-10,15.469-14.828\r\n\t\tc5.5-4.766,10.781-9.859,15.531-15.172c4.844-5.344,8.875-11.344,11.938-17.969c3.219-6.625,4.828-14.406,4.828-23.477\r\n\t\tc0-7.875-1.422-15.891-4.391-24.039C328.719,164.148,324.031,156.766,317.734,150.148z\"/>\r\n</g>\r\n</svg>\r\n";
self["line"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-461 322 100 100\" style=\"enable-background:new -461 322 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-366,419h-90.5c-0.8,0-1.5-0.7-1.5-1.5V327c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v89h89c0.8,0,1.5,0.7,1.5,1.5\r\n\t\t\tS-365.2,419-366,419z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-456,385c-0.3,0-0.5-0.1-0.7-0.3c-0.4-0.4-0.4-1,0-1.4l23-23c0.4-0.4,1-0.4,1.4,0l21.3,21.3l38.3-41.2\r\n\t\t\tc0.4-0.4,1-0.4,1.4-0.1s0.4,1,0.1,1.4l-39,42c-0.2,0.2-0.4,0.3-0.7,0.3c-0.3,0-0.5-0.1-0.7-0.3l-21.3-21.3l-22.3,22.3\r\n\t\t\tC-455.5,384.9-455.7,385-456,385z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-456,404c-0.3,0-0.5-0.1-0.7-0.3c-0.4-0.4-0.4-1,0-1.4l23-23c0.4-0.4,1-0.4,1.4,0l21.3,21.3l38.3-41.2\r\n\t\t\tc0.4-0.4,1-0.4,1.4-0.1s0.4,1,0.1,1.4l-39,42c-0.2,0.2-0.4,0.3-0.7,0.3c-0.3,0-0.5-0.1-0.7-0.3l-21.3-21.3l-22.3,22.3\r\n\t\t\tC-455.5,403.9-455.7,404-456,404z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["line_basic"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st4{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st5{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<polyline class=\"st2\" points=\"1.8,64.2 15,37 29,43.8 43,23 57,51 71,29.2 \"/>\r\n<polyline class=\"st2\" points=\"1.8,78.2 15,73 29,57.8 43,57 57,69 71,53.2 \"/>\r\n</svg>";
self["line_errorbar"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st4{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st5{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<g>\r\n\t<g>\r\n\t\t<line class=\"st4\" x1=\"42.5\" y1=\"14\" x2=\"42.5\" y2=\"32\"/>\r\n\t\t<g>\r\n\t\t\t<rect x=\"40\" y=\"14\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t\t<g>\r\n\t\t\t<rect x=\"40\" y=\"31\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t</g>\r\n</g>\r\n<g>\r\n\t<g>\r\n\t\t<line class=\"st4\" x1=\"56.5\" y1=\"38\" x2=\"56.5\" y2=\"64\"/>\r\n\t\t<g>\r\n\t\t\t<rect x=\"54\" y=\"38\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t\t<g>\r\n\t\t\t<rect x=\"54\" y=\"63\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t</g>\r\n</g>\r\n<g>\r\n\t<g>\r\n\t\t<line class=\"st4\" x1=\"70.5\" y1=\"21\" x2=\"70.5\" y2=\"38\"/>\r\n\t\t<g>\r\n\t\t\t<rect x=\"68\" y=\"21\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t\t<g>\r\n\t\t\t<rect x=\"68\" y=\"37\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t</g>\r\n</g>\r\n<g>\r\n\t<g>\r\n\t\t<line class=\"st4\" x1=\"28.5\" y1=\"31\" x2=\"28.5\" y2=\"56\"/>\r\n\t\t<g>\r\n\t\t\t<rect x=\"26\" y=\"31\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t\t<g>\r\n\t\t\t<rect x=\"26\" y=\"55\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t</g>\r\n</g>\r\n<g>\r\n\t<g>\r\n\t\t<line class=\"st4\" x1=\"14.5\" y1=\"27\" x2=\"14.5\" y2=\"48\"/>\r\n\t\t<g>\r\n\t\t\t<rect x=\"12\" y=\"27\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t\t<g>\r\n\t\t\t<rect x=\"12\" y=\"47\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t</g>\r\n</g>\r\n<polyline class=\"st2\" points=\"1.8,64.2 15,37 29,43.8 43,23 57,51 71,29.2 \"/>\r\n</svg>";
self["line_inverted"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st4{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st5{fill:#989898;}\r\n</style>\r\n<polyline class=\"st2\" points=\"50,77.2 22.8,64 29.5,50 8.8,36 36.8,22 15,8 \"/>\r\n<polyline class=\"st2\" points=\"64,77.2 58.8,64 43.5,50 42.8,36 54.8,22 39,8 \"/>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n</svg>";
self["line_labels"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{font-family:'FlandersArtSans-Light';}\r\n\t.st4{font-size:12px;}\r\n\t.st5{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st6{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st7{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<polyline class=\"st2\" points=\"1.8,64.2 15,37 29,43.8 43,23 57,51 71,29.2 \"/>\r\n<text transform=\"matrix(1 0 0 1 9.083 32.75)\" class=\"st3 st4\">30</text>\r\n<text transform=\"matrix(1 0 0 1 36.668 20)\" class=\"st3 st4\">40</text>\r\n</svg>";
self["line_logaritmic_labels"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{font-family:'FlandersArtSans-Light';}\r\n\t.st4{font-size:12px;}\r\n\t.st5{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st6{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st7{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<polyline class=\"st2\" points=\"1.8,64.2 15,37 29,43.8 43,23 57,51 71,29.2 \"/>\r\n<text transform=\"matrix(1 0 0 1 10.167 32.75)\" class=\"st3 st4\">10</text>\r\n<text transform=\"matrix(1 0 0 1 34.3945 20)\" class=\"st3 st4\">100</text>\r\n</svg>";
self["line_negative_color"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{font-family:'FlandersArtSans-Light';}\r\n\t.st4{font-size:12px;}\r\n\t.st5{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st6{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st7{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<polyline class=\"st2\" points=\"1.8,45.2 15,37 29,43.8 43,73 57,64 71,29.2 \"/>\r\n<text transform=\"matrix(1 0 0 1 10.167 32.75)\" class=\"st3 st4\">10</text>\r\n<text transform=\"matrix(1 0 0 1 34.3945 20)\" class=\"st3 st4\">100</text>\r\n<polyline class=\"st5\" points=\"32.7,51.5 43,73 57,64 62,51.5 \"/>\r\n<line class=\"st2\" x1=\"2\" y1=\"51.5\" x2=\"72\" y2=\"51.5\"/>\r\n</svg>";
self["line_step"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st4{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st5{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<polyline class=\"st2\" points=\"2,62.5 14.5,62.5 14.5,37.5 28.5,37.5 28.5,44.5 42.5,44.5 42.5,23.5 56.5,23.5 56.5,51.5 70.5,51.5 \r\n\t70.5,31 \"/>\r\n</svg>";
self["line_step_labels"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{font-family:'FlandersArtSans-Light';}\r\n\t.st4{font-size:12px;}\r\n\t.st5{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st6{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st7{fill:#989898;}\r\n</style>\r\n<text transform=\"matrix(1 0 0 1 8.333 32.75)\" class=\"st3 st4\">30</text>\r\n<text transform=\"matrix(1 0 0 1 35.918 20)\" class=\"st3 st4\">40</text>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<polyline class=\"st2\" points=\"2,62.5 14.5,62.5 14.5,37.5 28.5,37.5 28.5,44.5 42.5,44.5 42.5,23.5 56.5,23.5 56.5,51.5 70.5,51.5 \r\n\t70.5,31 \"/>\r\n</svg>";
self["logo"] = "<svg version=\"1.1\" id=\"Laag_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 247.8 61.6\" enable-background=\"new 0 0 247.8 61.6\" xml:space=\"preserve\">\r\n<circle fill=\"#C6F4C3\" cx=\"237.8\" cy=\"25.1\" r=\"5.8\"/>\r\n<g>\r\n\t<path fill=\"#ffffff\" d=\"M24,6v6.8H10v5.5H24v6.4H10v5.5H24V37H2.8V6H24z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M36.6,31.5L34.7,37h-7.6L37.7,6h10.5l10.7,31h-7.7l-1.9-5.5H36.6z M46.9,24.7l-4-11.6l-4,11.6H46.9z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M59.6,28.6c2.8,1.2,5.4,2.1,8.6,2.1c1.9,0,3.3-0.4,4.1-0.9c0.9-0.5,1.3-1.2,1.3-1.9c0-1.1-0.9-1.9-2.3-2.5\r\n\t\tc-0.7-0.3-1.5-0.6-2.4-0.9c-1.8-0.6-3.7-1.3-5.5-2.3c-1.8-1-3.3-2.3-4.1-4.3c-0.4-1-0.7-2.1-0.7-3.5c0-3.5,1.5-5.7,3.8-7\r\n\t\ts5.1-1.8,7.8-1.8c3.2,0,6,0.7,7.8,1.3v6.2L78,13.2c-0.5-0.2-1.6-0.4-2.9-0.6c-1.3-0.2-2.8-0.4-4.3-0.4c-1.3,0-2.6,0.1-3.6,0.5\r\n\t\ts-1.6,0.9-1.6,1.8c0,1.1,1,1.9,2.4,2.5c0.7,0.4,1.6,0.7,2.5,1c1.9,0.7,3.9,1.4,5.8,2.3c1.9,1,3.4,2.3,4.3,4.1\r\n\t\tc0.4,0.9,0.7,2,0.7,3.2c0,3.2-1.7,5.6-4.2,7.3c-2.5,1.7-5.8,2.5-9.1,2.5c-3.1,0-6.1-0.8-8.4-2.4V28.6z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M83.3,6h7.2l5.8,11.8L102.1,6h7.3l-9.4,19.4V37h-7.2V25.4L83.3,6z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M129.3,34.1v2.2c-2,0.8-3.8,1.2-5.7,1.2c-2.9,0-5.7-0.9-7.8-3s-3.4-5.3-3.4-9.8c0-4.5,1.3-7.6,3.3-9.6c2-2,4.8-2.9,7.8-2.9\r\n\t\tc1.9,0,3.7,0.3,5.7,1.2v2.1l-0.2,0.3c-1.7-0.7-3.3-0.9-5-0.9c-2.4,0-4.6,0.6-6.2,2.2c-1.6,1.5-2.6,4-2.6,7.6s1,6.2,2.6,7.9\r\n\t\tc1.6,1.7,3.8,2.5,6.2,2.5c1.6,0,3.3-0.3,5-0.9L129.3,34.1z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M138.6,3.4v11.4c2.3-1.5,4.8-2.7,7.5-2.7c1.9,0,3.9,0.6,5.4,1.8c1.5,1.3,2.5,3.2,2.5,6v17h-2.7v-16c0-2.2-0.7-3.7-1.7-4.8\r\n\t\tc-1-1-2.4-1.5-3.9-1.5c-1.2,0-2.5,0.3-3.7,0.8c-1.2,0.5-2.4,1.2-3.3,2V37h-2.7V3.9l2.4-0.5H138.6z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M177.2,28.8c0,1.4,0.3,2.8,0.9,3.9c0.6,1.1,1.6,1.9,2.9,2.2l-1.5,2.5c-1.8-0.6-3.1-2-3.9-3.8c-0.6,1.1-1.6,2-2.8,2.7\r\n\t\tc-1.2,0.7-2.8,1.1-4.5,1.1c-1.6,0-3.6-0.4-5.1-1.5c-1.6-1.1-2.7-3-2.7-6c0-2.3,0.7-4,2.2-5.2s3.9-1.8,7.2-1.8\r\n\t\tc1.2,0,2.7,0.1,4.9,0.3v-3.4c0-1.9-0.7-3.2-1.6-4c-1-0.8-2.3-1.1-3.6-1.1c-1.8,0-4.4,0.5-6.6,1.6l-0.7-2.5c2.3-1.1,5-1.7,7.4-1.7\r\n\t\tc2.1,0,4,0.5,5.5,1.7c1.4,1.2,2.3,3.3,2.3,6.3V28.8z M174.5,25.6c-1.8-0.2-2.7-0.2-3.8-0.2c-1.4,0-3.3,0-4.9,0.6\r\n\t\tc-1.6,0.6-2.8,1.7-2.8,3.8c0,1.3,0.5,2.6,1.4,3.5c0.9,0.9,2.2,1.5,3.9,1.5c2.6,0,4.7-1.3,6.1-4V25.6z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M187.6,12.6l0.8,2.5c1.8-2,3.9-3,6.1-3c1.2,0,2.2,0.3,3.3,0.7l-0.9,2.4c-1.2-0.4-1.7-0.6-2.7-0.6c-2.4,0-4.2,1.2-5.9,3.4\r\n\t\tV37h-2.7V12.6H187.6z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M215.1,36.6c-1.7,0.6-3.2,0.9-4.6,0.9c-1.3,0-3.1-0.3-4.6-1.4c-1.5-1.2-2.6-3.2-2.6-6.8v-14h-2.7v-2.7h2.7V8.2l2.4-0.4h0.3\r\n\t\tv4.9h6v2.7h-6v12.5c0,2.6,0.4,4.3,1.3,5.4c0.8,1.1,2,1.6,3.4,1.6c1.1,0,2.3-0.3,3.7-0.8L215.1,36.6z\"/>\r\n</g>\r\n<g>\r\n\t<path fill=\"#97CCC2\" d=\"M4,46.5v3.3C4.7,49.3,5.4,49,6.2,49c0.5,0,1.1,0.2,1.6,0.5c0.4,0.4,0.7,0.9,0.7,1.7v5H7.7v-4.7\r\n\t\tc0-0.6-0.2-1.1-0.5-1.4c-0.3-0.3-0.7-0.4-1.1-0.4c-0.4,0-0.7,0.1-1.1,0.2c-0.4,0.2-0.7,0.4-1,0.6v5.7H3.3v-9.6L4,46.5L4,46.5z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M11.6,47.4c0-0.2,0.1-0.3,0.2-0.4c0.1-0.1,0.3-0.2,0.4-0.2s0.3,0.1,0.4,0.2c0.1,0.1,0.2,0.2,0.2,0.4\r\n\t\tc0,0.1-0.1,0.3-0.2,0.4c-0.1,0.1-0.3,0.2-0.4,0.2s-0.3-0.1-0.4-0.2C11.7,47.7,11.6,47.5,11.6,47.4z M11.8,56.2v-7.1h0.8v7.1H11.8z\"\r\n\t\t/>\r\n\t<path fill=\"#97CCC2\" d=\"M18.8,54.8c1,0,1.7,0.2,2.1,0.6c0.5,0.4,0.7,0.9,0.7,1.4c0,0.7-0.5,1.4-1.2,1.9s-1.6,0.8-2.5,0.8\r\n\t\tc-0.8,0-1.5-0.3-1.9-0.7c-0.5-0.4-0.7-1-0.7-1.5c0-0.7,0.3-1.4,0.9-1.9c-0.4-0.2-0.6-0.6-0.6-1c0-0.4,0.2-0.9,0.5-1.3\r\n\t\tc-0.4-0.4-0.6-1-0.6-1.6c0-0.7,0.3-1.3,0.7-1.7c0.5-0.4,1.1-0.7,1.9-0.7c0.6,0,1.1,0.2,1.5,0.4c0.3-0.2,0.6-0.4,0.9-0.6\r\n\t\tc0.3-0.1,0.6-0.2,0.8-0.2l0.3,0.7c-0.4,0-0.9,0.2-1.3,0.6c0.3,0.4,0.5,0.9,0.5,1.4c0,0.7-0.3,1.3-0.7,1.7s-1.1,0.7-1.9,0.7\r\n\t\tc-0.6,0-1-0.1-1.4-0.4c-0.2,0.2-0.3,0.5-0.3,0.6c0,0.1,0.1,0.3,0.2,0.4c0.1,0.1,0.4,0.2,0.6,0.2H18.8z M16.8,55.5\r\n\t\tc-0.5,0.5-0.8,1.1-0.8,1.7c0,0.4,0.2,0.8,0.5,1.1s0.8,0.5,1.5,0.5c0.8,0,1.5-0.2,2-0.6s0.8-0.8,0.8-1.3c0-0.6-0.3-0.9-0.8-1.1\r\n\t\ts-1.3-0.2-2.1-0.2H16.8z M18.1,49.8c-0.6,0-1.1,0.2-1.4,0.5c-0.3,0.3-0.5,0.7-0.5,1.1s0.2,0.8,0.5,1.1s0.8,0.5,1.4,0.5\r\n\t\tc0.6,0,1.1-0.2,1.4-0.5s0.4-0.7,0.4-1.1s-0.2-0.8-0.5-1.1C19.1,50,18.7,49.8,18.1,49.8z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M24.7,46.5v3.3c0.7-0.4,1.4-0.8,2.2-0.8c0.5,0,1.1,0.2,1.6,0.5c0.4,0.4,0.7,0.9,0.7,1.7v5h-0.8v-4.7\r\n\t\tc0-0.6-0.2-1.1-0.5-1.4c-0.3-0.3-0.7-0.4-1.1-0.4c-0.4,0-0.7,0.1-1.1,0.2c-0.4,0.2-0.7,0.4-1,0.6v5.7h-0.8v-9.6L24.7,46.5\r\n\t\tL24.7,46.5z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M36.7,55.4V56c-0.6,0.2-1.1,0.3-1.7,0.3c-0.9,0-1.7-0.3-2.3-0.9s-1-1.5-1-2.9c0-1.3,0.4-2.2,1-2.8\r\n\t\ts1.4-0.8,2.3-0.8c0.6,0,1.1,0.1,1.7,0.3V50L36.7,50c-0.5-0.2-1-0.3-1.5-0.3c-0.7,0-1.4,0.2-1.8,0.6s-0.8,1.2-0.8,2.2\r\n\t\ts0.3,1.8,0.8,2.3s1.1,0.7,1.8,0.7C35.7,55.6,36.2,55.5,36.7,55.4L36.7,55.4z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M40.2,46.5v3.3c0.7-0.4,1.4-0.8,2.2-0.8c0.5,0,1.1,0.2,1.6,0.5c0.4,0.4,0.7,0.9,0.7,1.7v5h-0.8v-4.7\r\n\t\tc0-0.6-0.2-1.1-0.5-1.4c-0.3-0.3-0.7-0.4-1.1-0.4c-0.4,0-0.7,0.1-1.1,0.2c-0.4,0.2-0.7,0.4-1,0.6v5.7h-0.8v-9.6L40.2,46.5\r\n\t\tL40.2,46.5z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M52.3,53.9c0,0.4,0.1,0.8,0.3,1.1s0.5,0.6,0.8,0.6l-0.4,0.7c-0.5-0.2-0.9-0.6-1.1-1.1\r\n\t\tc-0.2,0.3-0.5,0.6-0.8,0.8s-0.8,0.3-1.3,0.3c-0.5,0-1-0.1-1.5-0.4c-0.5-0.3-0.8-0.9-0.8-1.8c0-0.7,0.2-1.2,0.6-1.5s1.1-0.5,2.1-0.5\r\n\t\tc0.4,0,0.8,0,1.4,0.1v-1c0-0.5-0.2-0.9-0.5-1.2s-0.7-0.3-1.1-0.3c-0.5,0-1.3,0.2-1.9,0.5l-0.2-0.7c0.7-0.3,1.4-0.5,2.2-0.5\r\n\t\tc0.6,0,1.2,0.1,1.6,0.5c0.4,0.4,0.7,1,0.7,1.8V53.9z M51.5,52.9c-0.5-0.1-0.8-0.1-1.1-0.1c-0.4,0-1,0-1.4,0.2\r\n\t\tc-0.5,0.2-0.8,0.5-0.8,1.1c0,0.4,0.1,0.8,0.4,1c0.3,0.3,0.6,0.4,1.1,0.4c0.8,0,1.4-0.4,1.8-1.2V52.9z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M56.1,49.1l0.2,0.7c0.5-0.6,1.1-0.9,1.8-0.9c0.3,0,0.6,0.1,1,0.2l-0.3,0.7c-0.3-0.1-0.5-0.2-0.8-0.2\r\n\t\tc-0.7,0-1.2,0.3-1.7,1v5.5h-0.8v-7.1H56.1z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M64.9,56.1c-0.5,0.2-0.9,0.3-1.3,0.3c-0.4,0-0.9-0.1-1.3-0.4s-0.8-0.9-0.8-2v-4.1h-0.8v-0.8h0.8v-1.3\r\n\t\tl0.7-0.1h0.1v1.4H64v0.8h-1.7v3.7c0,0.7,0.1,1.3,0.4,1.6c0.2,0.3,0.6,0.5,1,0.5c0.3,0,0.7-0.1,1.1-0.2L64.9,56.1z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M66.6,55.4c0.2,0.1,0.4,0.1,0.7,0.2c0.3,0,0.5,0.1,0.8,0.1c0.4,0,0.9-0.1,1.3-0.3c0.4-0.2,0.7-0.5,0.7-1\r\n\t\tc0-0.5-0.4-0.8-0.9-1.1c-0.3-0.1-0.5-0.3-0.8-0.4c-0.6-0.2-1.1-0.6-1.5-1.1c-0.2-0.2-0.3-0.6-0.3-0.9c0-0.6,0.3-1.1,0.7-1.4\r\n\t\tc0.4-0.3,1-0.5,1.7-0.5c0.5,0,0.9,0.1,1.3,0.2v0.7l0,0c-0.3-0.1-0.8-0.2-1.3-0.2c-0.4,0-0.8,0.1-1,0.2c-0.3,0.2-0.4,0.4-0.4,0.8\r\n\t\tc0,0.4,0.2,0.7,0.5,0.9c0.3,0.2,0.8,0.4,1.2,0.6c0.4,0.2,0.9,0.4,1.2,0.7c0.3,0.3,0.5,0.7,0.5,1.3c0,0.7-0.3,1.3-0.9,1.6\r\n\t\tc-0.5,0.4-1.2,0.6-2,0.6c-0.5,0-1-0.1-1.5-0.3L66.6,55.4L66.6,55.4z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M76.2,51.9v0.8h-3.4v-0.8H76.2z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M79.4,49.1l0.2,0.6c0.5-0.5,1.2-0.8,2-0.8c1,0,1.7,0.4,2.2,1.1s0.8,1.6,0.8,2.6c0,1.1-0.4,2-1,2.7\r\n\t\ts-1.5,1-2.5,1c-0.4,0-1-0.1-1.5-0.2v3.2h-0.8V49.1H79.4z M79.6,55.3c0.5,0.2,1,0.3,1.5,0.3c0.7,0,1.4-0.3,1.9-0.8s0.8-1.3,0.8-2.2\r\n\t\tc0-0.8-0.2-1.5-0.6-2s-1-0.9-1.8-0.9c-0.8,0-1.4,0.3-1.8,0.9V55.3z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M86.7,52.7c0-1,0.3-2,0.9-2.6S89,49,89.9,49c1,0,1.8,0.4,2.3,1.1c0.5,0.7,0.9,1.6,0.9,2.6\r\n\t\tc0,1-0.3,1.9-0.9,2.6s-1.4,1.1-2.3,1.1c-1,0-1.8-0.4-2.3-1.1S86.7,53.7,86.7,52.7z M87.5,52.6c0,0.8,0.2,1.6,0.6,2.1\r\n\t\tc0.4,0.5,1,0.9,1.8,0.9c0.8,0,1.4-0.3,1.8-0.8c0.4-0.5,0.6-1.2,0.6-2.1c0-0.8-0.2-1.6-0.6-2.1c-0.4-0.5-1-0.9-1.8-0.9\r\n\t\tc-0.8,0-1.4,0.3-1.8,0.8S87.5,51.8,87.5,52.6z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M101.7,56.2h-0.9l-1.7-5.7l-1.7,5.7h-0.9l-2.2-7.1h0.9l1.8,5.7l1.7-5.7h0.8l1.7,5.7l1.8-5.7h0.9L101.7,56.2\r\n\t\tz\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M110.4,52.9H106c0,0.9,0.3,1.6,0.8,2.1c0.5,0.5,1.1,0.7,1.8,0.7c0.3,0,0.6,0,0.9-0.1\r\n\t\tc0.3-0.1,0.6-0.2,0.9-0.4l0,0v0.7c-0.7,0.4-1.4,0.5-2,0.5c-0.9,0-1.7-0.3-2.3-0.9s-1-1.6-1-2.9c0-1,0.2-1.9,0.7-2.6s1.2-1,2.3-1\r\n\t\tc0.7,0,1.2,0.2,1.5,0.5c0.3,0.3,0.5,0.7,0.6,1.2s0.1,1,0.1,1.4V52.9z M109.6,52.1c0-0.6-0.1-1.2-0.3-1.6c-0.2-0.4-0.6-0.7-1.3-0.7\r\n\t\tc-0.7,0-1.1,0.2-1.5,0.7c-0.3,0.4-0.5,1-0.6,1.7H109.6z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M113.7,49.1l0.2,0.7c0.5-0.6,1.1-0.9,1.8-0.9c0.3,0,0.6,0.1,1,0.2l-0.3,0.7c-0.3-0.1-0.5-0.2-0.8-0.2\r\n\t\tc-0.7,0-1.2,0.3-1.7,1v5.5h-0.8v-7.1H113.7z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M123.9,47.4c0-0.2,0.1-0.3,0.2-0.4c0.1-0.1,0.3-0.2,0.4-0.2s0.3,0.1,0.4,0.2c0.1,0.1,0.2,0.2,0.2,0.4\r\n\t\tc0,0.1-0.1,0.3-0.2,0.4c-0.1,0.1-0.3,0.2-0.4,0.2s-0.3-0.1-0.4-0.2C124,47.7,123.9,47.5,123.9,47.4z M124.1,56.2v-7.1h0.8v7.1\r\n\t\tH124.1z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M128.9,49.1l0.2,0.7c0.7-0.4,1.4-0.8,2.2-0.8c0.5,0,1.1,0.2,1.6,0.5c0.4,0.4,0.7,0.9,0.7,1.7v5h-0.8v-4.7\r\n\t\tc0-0.6-0.2-1.1-0.5-1.4s-0.7-0.4-1.1-0.4c-0.4,0-0.7,0.1-1.1,0.2c-0.4,0.2-0.7,0.4-1,0.6v5.7h-0.8v-7.1H128.9z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M143.6,55l2-5.8h0.9l-3.1,8.9c-0.2,0.5-0.5,0.9-0.8,1.1s-0.7,0.3-1.1,0.3c-0.5,0-1-0.1-1.4-0.4l0.4-0.9\r\n\t\tc0.3,0.2,0.6,0.3,0.9,0.3c0.6,0,1.1-0.3,1.3-1l0.4-1.3l-2.4-7.1h0.9L143.6,55z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M148.1,52.7c0-1,0.3-2,0.9-2.6s1.4-1.1,2.3-1.1c1,0,1.8,0.4,2.3,1.1c0.5,0.7,0.9,1.6,0.9,2.6\r\n\t\tc0,1-0.3,1.9-0.9,2.6s-1.4,1.1-2.3,1.1c-1,0-1.8-0.4-2.3-1.1S148.1,53.7,148.1,52.7z M148.9,52.6c0,0.8,0.2,1.6,0.6,2.1\r\n\t\tc0.4,0.5,1,0.9,1.8,0.9c0.8,0,1.4-0.3,1.8-0.8c0.4-0.5,0.6-1.2,0.6-2.1c0-0.8-0.2-1.6-0.6-2.1c-0.4-0.5-1-0.9-1.8-0.9\r\n\t\tc-0.8,0-1.4,0.3-1.8,0.8S148.9,51.8,148.9,52.6z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M161.9,56.2l-0.2-0.7c-0.3,0.2-0.7,0.4-1.1,0.6s-0.8,0.2-1.2,0.2c-0.5,0-1.1-0.2-1.6-0.5\r\n\t\tc-0.4-0.4-0.7-0.9-0.7-1.7v-5h0.8v4.7c0,0.6,0.2,1.1,0.5,1.4c0.3,0.3,0.7,0.4,1.1,0.4c0.4,0,0.7-0.1,1.1-0.3c0.3-0.2,0.7-0.4,1-0.6\r\n\t\tv-5.7h0.8v7.1H161.9z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M166.4,49.1l0.2,0.7c0.5-0.6,1.1-0.9,1.8-0.9c0.3,0,0.6,0.1,1,0.2l-0.3,0.7c-0.3-0.1-0.5-0.2-0.8-0.2\r\n\t\tc-0.7,0-1.2,0.3-1.7,1v5.5h-0.8v-7.1H166.4z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M177.6,46.5v3.3c0.7-0.4,1.4-0.8,2.2-0.8c0.5,0,1.1,0.2,1.6,0.5c0.4,0.4,0.7,0.9,0.7,1.7v5h-0.8v-4.7\r\n\t\tc0-0.6-0.2-1.1-0.5-1.4c-0.3-0.3-0.7-0.4-1.1-0.4c-0.4,0-0.7,0.1-1.1,0.2c-0.4,0.2-0.7,0.4-1,0.6v5.7h-0.8v-9.6L177.6,46.5\r\n\t\tL177.6,46.5z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M189.7,53.9c0,0.4,0.1,0.8,0.3,1.1s0.5,0.6,0.8,0.6l-0.4,0.7c-0.5-0.2-0.9-0.6-1.1-1.1\r\n\t\tc-0.2,0.3-0.5,0.6-0.8,0.8s-0.8,0.3-1.3,0.3c-0.5,0-1-0.1-1.5-0.4c-0.5-0.3-0.8-0.9-0.8-1.8c0-0.7,0.2-1.2,0.6-1.5s1.1-0.5,2.1-0.5\r\n\t\tc0.4,0,0.8,0,1.4,0.1v-1c0-0.5-0.2-0.9-0.5-1.2s-0.7-0.3-1.1-0.3c-0.5,0-1.3,0.2-1.9,0.5l-0.2-0.7c0.7-0.3,1.4-0.5,2.2-0.5\r\n\t\tc0.6,0,1.2,0.1,1.6,0.5c0.4,0.4,0.7,1,0.7,1.8V53.9z M188.9,52.9c-0.5-0.1-0.8-0.1-1.1-0.1c-0.4,0-1,0-1.4,0.2\r\n\t\tc-0.5,0.2-0.8,0.5-0.8,1.1c0,0.4,0.1,0.8,0.4,1c0.3,0.3,0.6,0.4,1.1,0.4c0.8,0,1.4-0.4,1.8-1.2V52.9z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M193.8,49.1l0.2,0.7c0.7-0.4,1.4-0.8,2.2-0.8c0.5,0,1.1,0.2,1.6,0.5c0.4,0.4,0.7,0.9,0.7,1.7v5h-0.8v-4.7\r\n\t\tc0-0.6-0.2-1.1-0.5-1.4s-0.7-0.4-1.1-0.4c-0.4,0-0.7,0.1-1.1,0.2c-0.4,0.2-0.7,0.4-1,0.6v5.7h-0.8v-7.1H193.8z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M206.9,56.2h-0.6l-0.2-0.6c-0.5,0.5-1.2,0.8-2,0.8c-0.9,0-1.7-0.4-2.2-1.1c-0.5-0.7-0.8-1.6-0.8-2.7\r\n\t\tc0-1,0.3-1.9,0.8-2.5s1.4-1,2.7-1c0.5,0,1,0.1,1.5,0.2v-2.6l0.7-0.1h0.1V56.2z M206.2,50.1c-0.5-0.2-1-0.4-1.5-0.4\r\n\t\tc-0.8,0-1.4,0.2-1.9,0.7s-0.8,1.2-0.8,2.2c0,0.8,0.2,1.5,0.6,2c0.4,0.5,1,0.9,1.8,0.9c0.8,0,1.4-0.3,1.9-0.9V50.1z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M209.7,55.4c0.2,0.1,0.4,0.1,0.7,0.2s0.5,0.1,0.8,0.1c0.4,0,0.9-0.1,1.3-0.3c0.4-0.2,0.7-0.5,0.7-1\r\n\t\tc0-0.5-0.4-0.8-0.9-1.1c-0.3-0.1-0.5-0.3-0.8-0.4c-0.6-0.2-1.1-0.6-1.5-1.1c-0.2-0.2-0.3-0.6-0.3-0.9c0-0.6,0.3-1.1,0.7-1.4\r\n\t\ts1-0.5,1.7-0.5c0.5,0,0.9,0.1,1.3,0.2v0.7l0,0c-0.3-0.1-0.8-0.2-1.3-0.2c-0.4,0-0.8,0.1-1,0.2c-0.3,0.2-0.4,0.4-0.4,0.8\r\n\t\tc0,0.4,0.2,0.7,0.5,0.9c0.3,0.2,0.8,0.4,1.2,0.6c0.4,0.2,0.9,0.4,1.2,0.7c0.3,0.3,0.5,0.7,0.5,1.3c0,0.7-0.3,1.3-0.9,1.6\r\n\t\tc-0.5,0.4-1.2,0.6-2,0.6c-0.5,0-1-0.1-1.5-0.3L209.7,55.4L209.7,55.4z\"/>\r\n</g>\r\n<circle fill=\"#97CCC2\" cx=\"231.8\" cy=\"31.1\" r=\"5.8\"/>\r\n</svg>\r\n";
self["pie"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-461 322 100 100\" style=\"enable-background:new -461 322 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-411,420.5c-26.7,0-48.5-21.8-48.5-48.5s21.8-48.5,48.5-48.5c26.7,0,48.5,21.8,48.5,48.5\r\n\t\t\tC-362.5,398.7-384.3,420.5-411,420.5z M-411,326.5c-25.1,0-45.5,20.4-45.5,45.5s20.4,45.5,45.5,45.5s45.5-20.4,45.5-45.5\r\n\t\t\tS-385.9,326.5-411,326.5z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-378.2,406.8c-0.3,0-0.5-0.1-0.7-0.3l-33.8-33.8c-0.2-0.2-0.3-0.4-0.3-0.7v-47c0-0.6,0.4-1,1-1s1,0.4,1,1v46.6l33.5,33.5\r\n\t\t\tc0.4,0.4,0.4,1,0,1.4C-377.7,406.7-378,406.8-378.2,406.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-364,373h-48c-0.6,0-1-0.4-1-1s0.4-1,1-1h48c0.6,0,1,0.4,1,1S-363.4,373-364,373z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["readme"] = "\nIMPORTANT NOTICE:\n-----------------\n\nAll icons by Agus Purwanto from the Noun Project. Thanks a lot!\nhttps://thenounproject.com/Brexebrex/collection/chart-icons/";
self["spider"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-461 322 100 100\" style=\"enable-background:new -461 322 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-375,417.5c-0.4,0-0.9-0.2-1.2-0.5l-34.8-42.6l-34.8,42.6c-0.5,0.6-1.5,0.7-2.1,0.2c-0.6-0.5-0.7-1.5-0.2-2.1l36-44\r\n\t\t\tc0.6-0.7,1.8-0.7,2.3,0l36,44c0.5,0.6,0.4,1.6-0.2,2.1C-374.3,417.4-374.7,417.5-375,417.5z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-411.4,374c-0.2,0-0.5-0.1-0.7-0.2l-45.6-23.5c-0.7-0.4-1-1.3-0.6-2c0.4-0.7,1.3-1,2-0.6l44.9,23.2l44.7-23.2\r\n\t\t\tc0.7-0.4,1.6-0.1,2,0.6s0.1,1.6-0.6,2l-45.4,23.5C-411,374-411.2,374-411.4,374z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-411.5,374.5c-0.8,0-1.5-0.7-1.5-1.5v-49c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v49C-410,373.8-410.7,374.5-411.5,374.5z\r\n\t\t\t\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-412,339.1l32,17.8l-6.8,45.1H-436l-6.4-45.1L-412,339.1 M-412,337.1c-0.3,0-0.7,0.1-1,0.3l-30.5,17.5\r\n\t\t\tc-0.7,0.4-1.1,1.2-1,2l6.4,45.1c0.1,1,1,2,2,2h49.2c1,0,1.8-1,2-1.9l6.8-44.9c0.1-0.8-0.3-1.7-1-2.1l-32-17.6\r\n\t\t\tC-411.3,337.2-411.7,337.1-412,337.1L-412,337.1z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-411.8,349.1l21.7,12.2l-4.6,30.7h-33.4l-4.4-30.7L-411.8,349.1 M-411.8,347.1c-0.3,0-0.7,0.1-1,0.3l-20.7,11.9\r\n\t\t\tc-0.7,0.4-1.1,1.2-1,2l4.4,30.7c0.1,1,1,2,2,2h33.4c1,0,1.8-1,2-1.9l4.6-30.6c0.1-0.8-0.3-1.7-1-2.1l-21.7-12\r\n\t\t\tC-411.1,347.2-411.4,347.1-411.8,347.1L-411.8,347.1z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-411.5,358.1l12.5,7.1l-2.7,17.8h-19.2l-2.5-17.8L-411.5,358.1 M-411.5,356.1c-0.3,0-0.7,0.1-1,0.3l-11.9,6.8\r\n\t\t\tc-0.7,0.4-1.1,1.2-1,2l2.5,17.8c0.1,1,1,2,2,2h19.2c1,0,1.8-1,2-1.9l2.7-17.6c0.1-0.8-0.3-1.7-1-2.1l-12.5-6.9\r\n\t\t\tC-410.9,356.2-411.2,356.1-411.5,356.1L-411.5,356.1z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["spline_basic"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st4{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st5{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<path class=\"st2\" d=\"M1.8,64.2c0,0,8.5-27.2,13.2-27.2s9.5,6.8,14,6.8S38.8,23,43,23s10.8,28,14,28s14-21.8,14-21.8\"/>\r\n<path class=\"st2\" d=\"M1.8,77.2c0,0,8.5-17.2,13.2-17.2s9.5-3.2,14-3.2S38.8,71,43,71s10.8-15,14-15s14,9.2,14,9.2\"/>\r\n</svg>";
self["spline_labels"] = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<!-- Generator: Adobe Illustrator 19.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\r\n<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{font-family:'FlandersArtSans-Light';}\r\n\t.st4{font-size:12px;}\r\n\t.st5{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st6{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st7{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<path class=\"st2\" d=\"M1.8,64.2c0,0,8.5-27.2,13.2-27.2s9.5,6.8,14,6.8S38.8,23,43,23s10.8,28,14,28s14-21.8,14-21.8\"/>\r\n<text transform=\"matrix(1 0 0 1 9.083 32.75)\" class=\"st3 st4\">30</text>\r\n<text transform=\"matrix(1 0 0 1 36.668 20)\" class=\"st3 st4\">40</text>\r\n</svg>\r\n";
return self})();
    var virtualize = require('vdom-virtualize');
    var _ = {
        isUndefined: require('lodash.isundefined')
    };
    var that = {};
    that.get = function(id){
        if(!_.isUndefined(icons[id])){
            var logo = document.createElement('div');
            logo.innerHTML = icons[id];
            return virtualize(logo.firstChild);

        } else {
            console.log('Icon not found');
        }
    };

    module.exports = that;
})();

},{"fs":6,"lodash.isundefined":54,"vdom-virtualize":77}],126:[function(require,module,exports){
(function () {
    var that = {};
    var _ = {
        isUndefined: require('lodash.isundefined'),
        find: require('lodash.find'),
        map: require('lodash.map'),
        cloneDeep: require('lodash.clonedeep'),
        remove: require('lodash.remove'),
        forEach: require('lodash.foreach'),
        first: require('lodash.first'),
        union: require('lodash.union'),
        slice: require('lodash.slice'),
        drop: require('lodash.drop'),
        size: require('lodash.size'),
        isArray: require('lodash.isarray'),
        isEmpty: require('lodash.isempty'),
        merge: require('lodash.merge')
    };

    that.get = function (data, config, labels, categories, series) {
        var object = generateDataSeries(config, data);
        if (labels.categories) {
            object = setCategories(object, categories);
        }
        if (labels.series) {
            object = setSeries(object, series);
        }
        return object;
    };


    function setCategories(series, categorieLabels) {
        _.forEach(series, function (item, index) {
            _.forEach(item.data, function (row, dataIndex) {
                // depending on the notation we add it to the array or set its as property
                if(series[index]['data'][dataIndex].isArray){
                    series[index]['data'][dataIndex] = _.union([categorieLabels[dataIndex]], row);
                } else {
                    series[index]['data'][dataIndex].name = categorieLabels[dataIndex];
                }
            });
        });
        return series;
    }

    function setSeries(series, seriesLabels) {
        seriesLabels = _.remove(seriesLabels, function (n) {
            return !_.isEmpty(n);
        });

        _.forEach(series, function (item, index) {
            if (_.isUndefined(series[index].name)) {
                series[index].name = seriesLabels[index];
            }
        });

        return series;
    }

    function generateEmptySeries(series, defaultType, size, animation) {
        var array = [];
        var index = 0;
        while (size > 0) {
            var object = {};
            // look for settings for the series;
            if (series && series[index]) {
                object = _.merge(object, series[index]);
            } else {
                object.type = defaultType;
            }
            object.animation = animation ? animation : false;
            object.connectNulls = true;
            object.data = [];
            size = size - getValuesPerPoint(object.type).points;
            array.push(object);
            index++;
        }

        return array;
    }

    function generateDataSeries(config, data) {
        // check for series config for the data and apply this
        var configClone = _.cloneDeep(config);
        var emptySeries = generateEmptySeries(configClone.series, configClone.chart.type, _.size(_.first(data)), configClone.chart.animation);
        return _.map(emptySeries, function (item, index) {
            var vpp = getValuesPerPoint(_.isUndefined(item.type) || item.type === null ? config.chart.type : item.type);
            _.forEach(data, function (row, rowIndex) {
                var cell = {};
                var points = parseDataFloat(_.slice(row, 0, vpp.points));
                // check for turboThreshold
                if(data.length >= 1000){
                    cell = points;
                } else {

                    _.forEach(vpp.definition, function(label, pointIndex){
                        if( points[pointIndex] !== 'null'){
                            cell[label] = points[pointIndex];
                        } else {
                            cell[label] = null;
                        }
                    });
                    if (!_.isUndefined(configClone.series) && !_.isUndefined(configClone.series[index]) && !_.isUndefined(configClone.series[index].data)) {
                        cell = _.merge(configClone.series[index].data, cell);
                    }
                }
                item.data.push(cell);
                data[rowIndex] = _.drop(data[rowIndex], vpp.points);
            });
            return item;
        });
    }


    function getValuesPerPoint(type) {
        var vpp;
        switch (type) {
            case 'scatter':
                vpp = {
                    points: 2,
                    definition: ['x', 'y']
                };
                break;
            case 'bubble':
                vpp = {
                    points: 3,
                    definition: ['x', 'y', 'z']
                };
                break;
            case 'heatmap':
                vpp = {
                    points: 2,
                    definition: ['y', 'value']
                };
                break;
            case 'boxplot':
                vpp = {
                    points: 5,
                    definition: ['low', 'q1', 'median', 'q3', 'high']
                };
                break;
            case 'errorbar':
            case 'areasplinerange':
            case 'arearange':
            case 'columnrange':
                vpp = {
                    points: 2,
                    definition: ['low', 'high']
                };
                break;
            case 'line':
            case 'spline':
            case 'treemap':
            case 'solidgauge':
            case 'polygon':
            case 'pyramid':
            case 'pie':
            case 'funnel':
            case 'gauge':
            case 'areaspline':
            case 'waterfall':
            case 'column':
            case 'bar':
                vpp = {
                    points: 1,
                    definition: ['y']
                };
                break;
            default:
                vpp = {
                    points: 1,
                    definition: ['y']
                };
                break;
        }
        return vpp;
    }

    function parseDataFloat(data) {
        var newData = [];
        _.forEach(data, function (value, index) {
            if (_.isArray(value)) {
                newData[index] = parseDataFloat(value);
            }
            else {
                newData[index] = value === '' || value === 'null' || isNaN(value) || value === null ? null : parseFloat(value);
            }
        });
        return newData;
    }

    module.exports = that;
})();

},{"lodash.clonedeep":42,"lodash.drop":43,"lodash.find":44,"lodash.first":45,"lodash.foreach":46,"lodash.isarray":48,"lodash.isempty":49,"lodash.isundefined":54,"lodash.map":58,"lodash.merge":59,"lodash.remove":60,"lodash.size":62,"lodash.slice":64,"lodash.union":67}],127:[function(require,module,exports){

(function () {
    function constructor(services){
        // data
        function setData (data){
            services.data.set(data);
        }
        function getData (){
            return services.data.get();
        }
        // data csv
        function setDataCSV(csv){
            services.data.setCSV(csv);
        }
        // data url
        function setDataUrl(url){
            services.data.setUrl(url);
        }
        function getDataUrl(){
            return services.data.getUrl();
        }
        // options
        function setOptions(options){
            services.options.set(options);
        }
        function getOptions(){
            return services.options.get();
        }
        function setOptionsUrl(url){
            services.options.setUrl(url);
        }
        function getOptionsUrl(){
            return services.options.getUrl();
        }
        // templates
        function setTemplates(templates){
            services.templates.set(templates);
        }
        function getTemplates(){
            return services.templates.get();
        }
        // config
        function setConfig(config){
            services.config.set(config);
        }
        function getConfig(config){
            return services.config.getRaw(config);
        }

        // preset
        function setPreset(preset){
            services.config.setPreset(preset);
        }
        function getPreset(preset){
            services.config.getPreset(preset);
        }
        // events
        function on(event, callback){
            services.mediator.on(event, function (data) {
                callback(data);
            });
        }

        return {
            setData:setData,
            getData:getData,
            setDataUrl:setDataUrl,
            getDataUrl:getDataUrl,
            setDataCSV: setDataCSV,
            setOptions:setOptions,
            getOptions: getOptions,
            setTemplates:setTemplates,
            getTemplates:getTemplates,
            setConfig:setConfig,
            getConfig:getConfig,
            setOptionsUrl:setOptionsUrl,
            getOptionsUrl:getOptionsUrl,
            setPreset:setPreset,
            getPreset:getPreset,
            on:on
        }
    }

    module.exports = constructor;
})();

},{}],128:[function(require,module,exports){
(function () {
    function constructor(mediator, data) {
        var _ = {
            isUndefined: require('lodash.isundefined'),
            find: require('lodash.find'),
            cloneDeep: require('lodash.clonedeep'),
            forEach: require('lodash.foreach'),
            merge: require('lodash.merge'),
            isEmpty: require('lodash.isempty')
        };
        var series = require('../factories/series.js');
        var templates = require('../config/templates');
        var that = {};
        var preset = {
            chart:{

            },
            xAxis:[{
            }],
            yAxis:[{
            }]
        };


        var config = _.cloneDeep(preset);
        var configCache;
        that.get = function () {
            var labels = hasLabels(data.get());
            var object = _.merge(_.cloneDeep(config), _.cloneDeep(preset));
            object.series = series.get(data.getData(labels.series, labels.categories), object, labels, data.getCategories(), data.getSeries());
            configCache = _.cloneDeep(object);
            return configCache;
        };

        that.getRaw = function () {
            return _.cloneDeep(config);
        };

        that.set = function (_config_) {
            delete _config_.series;
            config = _.cloneDeep(_config_);
        };

        that.setValue = function (path, value) {
            var ids = path.split('.');
            var step;
            var object = config;
            while (step = ids.shift()) {
                if (ids.length > 0) {
                    if (!_.isUndefined(object[step])) {
                        object = object[step];
                    } else {
                        object[step] = {};
                        object = object[step];
                    }
                } else {
                    object[step] = value;
                }
            }
            configUpdate();
        };

        that.setValues = function (array) {
            _.forEach(array, function (row) {
                that.setValue(row[0], row[1]);
            });
            configUpdate();
        };

        that.getValue = function (path) {
            var object = that.get();
            path = path.split('.');
            var step;
            while (step = path.shift()) {
                if (!_.isUndefined(object[step])) {
                    object = object[step];
                } else {
                    object = undefined;
                    break;
                }
            }
            return object;
        };

        that.isEditable = function (path) {
            var object = _.cloneDeep(preset);
            path = path.split('.');
            var step;
            while (step = path.shift()) {
                if (!_.isUndefined(object[step])) {
                    object = object[step];
                } else {
                    object = undefined;
                    break;
                }
            }
            return _.isUndefined(object);
        };

        that.removeValue = function (path) {
            var temp = config;
            path = path.split('.');
            while (step = path.shift()) {
                if (!_.isUndefined(temp[step])) {
                    if (path.length > 0) {
                        temp = temp[step];
                    } else {
                        if(Object.prototype.toString.call( temp ) === '[object Array]'){
                            temp.splice(step, 1);
                        } else {
                            delete temp[step];
                        }
                    }
                }
            }
            configUpdate();
        };

        that.loadTemplate = function (template) {
            config = _.merge(template, _.cloneDeep(preset));
            configUpdate();
        };

        that.setPreset = function (_preset_) {
            preset = _preset_;
            configUpdate();
        };

        that.getPreset = function () {
            return _.cloneDeep(preset);
        };

        function hasLabels(data) {
            var labels = {
                categories: false,
                series: true
            };
            if (data[0]) {
                // if the first cell is empty, make the assumption that the first column are labels.
                if (_.isEmpty(data[0][0]) || data[0][0] == 'cat' || data[0][0] == 'categories') {
                    labels.categories = true;
                } else {
                    labels.categories = false;
                }
            }
            return labels;
        }

        function configUpdate(){
            mediator.trigger('configUpdate', that.get());
        }

        mediator.on('dataUpdate', function(data){
            configUpdate();
        });

        return that;

    }

    module.exports = constructor;
})();
},{"../config/templates":124,"../factories/series.js":126,"lodash.clonedeep":42,"lodash.find":44,"lodash.foreach":46,"lodash.isempty":49,"lodash.isundefined":54,"lodash.merge":59}],129:[function(require,module,exports){
(function () {
    function constructor (_mediator_){
        var mediator = _mediator_;
        var xhr = require("xhr");
        var _ = {
            isUndefined: require('lodash.isundefined'),
            find: require('lodash.find'),
            map: require('lodash.map'),
            cloneDeep: require('lodash.clonedeep'),
            slice: require('lodash.slice'),
            forEach: require('lodash.foreach'),
            first: require('lodash.first'),
            isEqual: require('lodash.isequal'),
            isNaN: require('lodash.isnan')
        };
        var papa = require('papaparse');
        var that = {};
        var dataSet = [];
        var dataUrl;

        that.getSeries = function () {
            return _.cloneDeep(_.first(dataSet));
        };

        that.getCategories = function () {
            return _.cloneDeep(_.map(_.slice(dataSet, 1), function (row) {
                return _.first(row);
            }));
        };

        that.get = function () {
            return _.cloneDeep(dataSet);
        };

        that.getData = function (series, categories) {
            var data = _.cloneDeep(dataSet);

            if (series) {
                data = _.slice(data, 1);
            }

            if (categories) {
                data = _.map(data, function (row) {
                    row.shift();
                    return row;
                });
            }

            return _.cloneDeep(data);
        };

        that.set = function (newDataSet, init) {
            if (!_.isEqual(dataSet, newDataSet)) {
                if(!init){
                    mediator.trigger('backup', _.cloneDeep(dataSet));
                }
                dataSet = _.cloneDeep(newDataSet);
                var data = that.get();
                mediator.trigger('dataUpdate', data);
                dataUrl = undefined;
            }
        };

        that.revert = function(oldDataSet){
            if (!_.isEqual(dataSet, oldDataSet)) {
                dataSet = oldDataSet;
                mediator.trigger('dataUpdate', _.cloneDeep(dataSet));
            }
        };

        mediator.on('backup.revert', that.revert);

        that.setValue = function(row, cell, value){
            if(!_.isUndefined(dataSet[row]) && !_.isUndefined(dataSet[row][cell])){
                mediator.trigger('backup',_.cloneDeep(dataSet));
                dataSet[row][cell] = _.isNaN(value) ? null : value;
            }
            mediator.trigger('dataUpdate', _.cloneDeep(dataSet));
            dataUrl = undefined;
        };

        that.setCSV = function(csv, init){
            if(!init){
                mediator.trigger('backup', _.cloneDeep(dataSet));
            }
            dataSet = papa.parse(csv).data;
            mediator.trigger('dataUpdate', dataSet);
            dataUrl = undefined;
        };


        that.getUrl = function (){
            return _.cloneDeep(dataUrl);
        };

        that.setUrl = function(url, init){
            if(url !== ''){
                xhr.get(url, function(err, resp){

                    if (resp.statusCode == "200") {
                        if(!init){
                            mediator.trigger('backup', _.cloneDeep(dataSet));
                        }
                        dataSet = papa.parse(resp.body).data;
                        dataUrl = url;

                        mediator.trigger('dataUpdate', _.cloneDeep(dataSet));
                    }
                    else {
                        dataUrl = undefined;
                    }
                })
            } else {
                dataUrl = undefined;
            }
        };

        return that;
    }
    module.exports = constructor;
})
();


},{"lodash.clonedeep":42,"lodash.find":44,"lodash.first":45,"lodash.foreach":46,"lodash.isequal":50,"lodash.isnan":52,"lodash.isundefined":54,"lodash.map":58,"lodash.slice":64,"papaparse":70,"xhr":108}],130:[function(require,module,exports){
var _ = {
    forEach: require('lodash.foreach')
};

function constructor(opts, services) {

    if(typeof opts.data !== 'undefined'){
        services.data.set(opts.data, true);
    }
    if(typeof opts.dataCSV !== 'undefined'){
        services.data.setCSV(opts.dataCSV, true);
    }
    if(typeof opts.dataUrl !== 'undefined'){
        services.data.setUrl(opts.dataUrl, true);
    }
    if(typeof opts.options !== 'undefined'){
        services.options.set(opts.options);
    }
    if(typeof opts.optionsUrl !== 'undefined'){
        services.options.setUrl(opts.optionsUrl);
    }
    if(typeof opts.templates !== 'undefined'){
        services.templates.set(opts.templates);
    }
    if(typeof opts.config !== 'undefined'){
        services.config.set(opts.config);
    }
    if(typeof opts.preset !== 'undefined'){
        services.config.setPreset(opts.preset);
    }
    if(typeof opts.events !== 'undefined'){
        _.forEach(opts.events, function(callback, event){
            services.mediator.on(event, function (data) {
                callback(data);
            });
        });
    }
}

module.exports = constructor;

},{"lodash.foreach":46}],131:[function(require,module,exports){
(function () {
    var constructor = function (mediator){
        var options = require('../config/options.json');
        var configUrl;
        var that = {};

        var xhr = require("xhr");
        var _ = {
            cloneDeep: require('lodash.clonedeep')
        };
        that.get = function(){
            return _.cloneDeep(options);
        };

        that.set = function(_options_){
            options = _.cloneDeep(_options_);
        };

        that.setUrl = function(url){
            if(url !== ''){
                xhr.get(url, function(err, resp){
                    if (resp.statusCode === 200) {
                        options = JSON.parse(resp.body);
                        configUrl = url;
                        mediator.trigger('configUpdate', that.get());
                    }
                });
            } else {
                configUrl = undefined;
            }
        };


        that.getUrl = function(){
            return _.cloneDeep(configUrl);
        };

        return that;
    };
    module.exports = constructor;
})();

},{"../config/options.json":123,"lodash.clonedeep":42,"xhr":108}],132:[function(require,module,exports){
(function () {
    var h = require('virtual-dom/h');
    var diff = require('virtual-dom/diff');
    var patch = require('virtual-dom/patch');
    var createElement = require('virtual-dom/create-element');
    var logo = require('./../templates/logo');

    var mainLoop = require("main-loop");
    var _ = {
        keys: require('lodash.keys')
    };

    function constructor(element, states, services) {
        var initState = {
            links: _.keys(states)
        };

        var loop = mainLoop(initState, render, {
            create: require("virtual-dom/create-element"),
            diff: require("virtual-dom/diff"),
            patch: require("virtual-dom/patch")
        });
        var revisionElement = require('./../components/revision')(services.mediator, services.revision.getList());

        element.appendChild(loop.target);

        function goToState(state) {
            var newState = loop.state;
            if (loop.state.destroy && newState.dependencies) {
                loop.state.destroy(newState.dependencies);
            }
            newState.dependencies = states[state].dependencies();
            newState.template = states[state].template;
            newState.title = states[state].title;
            newState.destroy = states[state].destroy;
            loop.update(newState);
        }

        function render(state) {
            if (state.dependencies && state.template) {
                return h('div', [
                    h('div.header', [
                        h('div.navigation.accordion-tabs-minimal',[
                            h('ul.tab-list', state.links.map(function (id) {
                                var className = state.title === states[id].title ? 'is-active' : '';
                                return h('li.tab-link', {
                                    'className': className
                                }, h('a', {
                                    'href': '#' + id,
                                    'ev-click': function (e) {
                                        e.preventDefault();
                                        goToState(id);
                                    }
                                }, states[id].title))
                            }))
                        ]),
                        logo
                    ]),
                    h('div.left', state.template(state.dependencies))
                ])
            } else {
                return h('div', logo)
            }
        }

        services.mediator.on('treeUpdate', function () {
            loop.update(loop.state);
        });

        // chart stuff
        var chartElement;
        var chart = require('./../components/chart.js');

        chartElement = createElement(h('div.right', {id: 'chartContainer'}));
        element.appendChild(chartElement);
        chart.load(chartElement, services);
        element.appendChild(revisionElement.template());
        return {
            goToState: goToState
        };
    }

    module.exports = constructor;
})();
},{"./../components/chart.js":113,"./../components/revision":120,"./../templates/logo":135,"lodash.keys":55,"main-loop":68,"virtual-dom/create-element":79,"virtual-dom/diff":80,"virtual-dom/h":81,"virtual-dom/patch":82}],133:[function(require,module,exports){
(function () {
    function constructor(){
        var templates = require('../config/templates');
        var that = {};
        var _ = {
            cloneDeep: require('lodash.clonedeep')
        };
        that.get = function(){
            return _.cloneDeep(templates);
        };

        that.set = function(_templates_){
            templates = _templates_;
        };
        return that;
    }

    module.exports = constructor;
})();

},{"../config/templates":124,"lodash.clonedeep":42}],134:[function(require,module,exports){
(function () {
    var css = require('../css/style.css');
    var Delegator = require("dom-delegator");
    Delegator();
    function constructor(opts){
        var router = require('./services/router.js');
        var dataService = require('./services/data');
        var confService = require('./services/config');
        var optionsService = require('./services/options');
        var initializer = require('./services/initializer');
        var templateService = require('./services/templates');
        var mediator = require('mediatorjs');
        var h = require('virtual-dom/h');
        var Api = require('./services/api');
        var mInstance = new mediator.Mediator();
        var data = new dataService(mInstance);
        var config = new confService(mInstance, data);
        var services = {
            data: data,
            config: new confService(mInstance, data),
            mediator: mInstance,
            options: new optionsService(mInstance),
            templates: new templateService()
        };
        var states = {
            'import': {
                title: 'Import',
                dependencies: function(){
                    var that = {};
                    that.import = require('./components/import.js')(services);
                    return that;
                },
                template: function (dependencies) {
                    return h('div', [dependencies.import.template()]);
                },
                destroy: function(dependencies){
                    dependencies.import.destroy()
                }
            },
            'templates': {
                title: 'Templates',
                dependencies: function(){
                    var that = {};
                    that.templateSelection = require('./components/templateSelection.js')(services);
                    return that;
                },
                template: function (dependencies) {
                    return h('div', [dependencies.templateSelection.template()]);
                }
            }
        };
        // initialise the application with given options
        initializer(opts, services);
        if(typeof opts.element !== 'undefined'){
            opts.element.className += ' ec';
            var mainRouter = new router(opts.element, states , services);
            mainRouter.goToState('import');
        }

        return new Api(services);
    }

    window.ec = constructor;
})();


},{"../css/style.css":112,"./components/import.js":115,"./components/templateSelection.js":122,"./services/api":127,"./services/config":128,"./services/data":129,"./services/initializer":130,"./services/options":131,"./services/router.js":132,"./services/templates":133,"dom-delegator":12,"mediatorjs":69,"virtual-dom/h":81}],135:[function(require,module,exports){
(function () {
    var h = require('virtual-dom/h');
    var iconLoader = require('../factories/iconLoader');
    var logo = iconLoader.get('logo');
    logo.properties.height = '50px';
    module.exports = h('div.logo',[logo]);
})();

},{"../factories/iconLoader":125,"virtual-dom/h":81}]},{},[134]);
