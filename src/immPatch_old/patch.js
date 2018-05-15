'use strict';

var Immutable = require('immutable');
var path = require('./path');

var tryParseInt = function(n) {
  var int = parseInt(n);
  return isNaN(int) ? n : int;
};

var primitivePatch = function (op, value) {
  console.log('primitivePatch')
  if (op === 'add' || op === 'replace') {
    return value;
  } else if (op === 'remove') {
    return null;
  }
};

var mapPatch = function(map, firstPath, restPath, op, value) {
  if (op === 'add') {
    if (restPath.length > 0 && map.get(firstPath) === undefined) {
      var baseValue = (restPath[0].match(/^\d+$/)) ? Immutable.List() : Immutable.Map();
      return map.set(firstPath, anyPatch(baseValue, restPath, op, value));
    } else {
      return map.set(firstPath, anyPatch(map.get(firstPath), restPath, op, value));
    }
  } else if (op === 'replace') {
    if (restPath.length > 0) {
      console.log('mapPatch', { map},{firstPath},{restPath},{op},{value})
      return map.set(firstPath, anyPatch(map.get(firstPath), restPath, op, value));
    } else {
      return map.set(firstPath, value);
    }
  } else if (op === 'remove') {
    if (restPath.length > 0) {
      return map.set(firstPath, anyPatch(map.get(firstPath), restPath, op, value));
    } else {
      return map.remove(firstPath);
    }
  } else {
    throw new Error('map patch Error, unknown op: ' + op);
  }
};

var sequencePatch = function(sequence, firstPath, restPath, op, value) {
  console.log('sequencePatch')
  firstPath = tryParseInt(firstPath);
  if (op === 'add') {
    if (sequence.get(firstPath) === undefined) {
      if (restPath.length > 0) {
        var baseValue = (restPath[0].match(/^\d+$/)) ? Immutable.List() : Immutable.Map();
        return sequence.set(firstPath, anyPatch(baseValue, restPath, op, value));
      } else {
        // special case, add to the end
        if (firstPath === '-') {
          return sequence.splice(sequence.size, 0, value);
        }
        // special case, return the value
        return sequence.splice(firstPath, 0, value);
      }
    } else {
      if (restPath.length > 0) {
        return sequence.set(firstPath, anyPatch(sequence.get(firstPath), restPath, op, value));
      } else {
        // special case, return the value
        return sequence.splice(firstPath, 0, value);
      }
    }
  } else if (op === 'replace') {
    if (restPath.length > 0) {
      return sequence.set(firstPath, anyPatch(sequence.get(firstPath), restPath, op, value));
    } else {
      return sequence.set(firstPath, value);
    }
  } else if (op === 'remove') {
    if (restPath.length > 0) {
      return sequence.set(firstPath, anyPatch(sequence.get(firstPath), restPath, op, value));
    } else {
      return sequence.remove(firstPath);
    }
  } else {
    throw new Error('sequence patch Error, unknown op: ' + op);
  }
};

var anyPatch = function(any, pathArray, op, value) {
  var firstPath, restPath;

  if (Immutable.Iterable.isKeyed(any)) {
    if (pathArray.length === 0) { return any; }
    firstPath = pathArray[0];
    restPath = pathArray.slice(1);
    return mapPatch(any, firstPath, restPath, op, value);
  } else if (Immutable.Iterable.isIndexed(any)) {
    if (pathArray.length === 0) { return any; }
    firstPath = pathArray[0];
    restPath = pathArray.slice(1);
    return sequencePatch(any, firstPath, restPath, op, value);
  } else {
    if (pathArray.length === 0) { return value; }
    return primitivePatch(op, value);
  }
};

var eachPatchInternal = function(value, patches) {
  while (patches.size) {
    console.log('eachPatchInternal, value: ', { value })
    var firstPatch = patches.get(0);
    var patches = patches.slice(1);
    var pathArray = firstPatch.get('path').split('/').slice(1).map(path.unescape);
    if (!pathArray.includes('key')) {
        console.log('eachPatchInternal, path: ' + pathArray)
        value = anyPatch(value, pathArray, firstPatch.get('op'), firstPatch.get('value'));
    }
  }
  return value;
};

var eachPatch = function(value, patches) {
  if (patches.size === 1) {
    var onlyPatch = patches.get(0);
    if (onlyPatch.get('op') === 'replace' && onlyPatch.get('path') === '/') {
      return onlyPatch.get('value');
    }
  }
  return eachPatchInternal(value, patches);
};

eachPatch.default = eachPatch;
module.exports = eachPatch;