import {Map as IMap, Iterable, is, fromJS} from 'immutable'
import {diff as lcsdiff} from './lcs'

const {isMap} = IMap
const {isIndexed} = Iterable

function op(operation, path, value) {
  if (operation === 'remove') { return { op: operation, path: path } }
  return { op: operation, path: path, value: value }
}

function mapDiff(a, b, path = []) {
  var ops = []

  if (is(a, b)) {
    return ops;
  }

  var areIndexed = isIndexed(a) && isIndexed(b)
  var lastKey = null
  var removeKey = null

  if (a.forEach) {
    a.forEach((aValue, aKey) => {
      if (b.has(aKey)) {
        if (isMap(aValue) && isMap(b.get(aKey))) {
          ops = ops.concat(mapDiff(aValue, b.get(aKey), path.concat(aKey)))
        } else if (isIndexed(b.get(aKey)) && isIndexed(aValue)) {
          ops = ops.concat(sequenceDiff(aValue, b.get(aKey), path.concat(aKey)))
        } else {
          var bValue = b.get ? b.get(aKey) : b
          var areDifferentValues = (aValue !== bValue)
          if (areDifferentValues) {
            ops.push(op('replace', path.concat(aKey), bValue))
          }
        }
      } else if (areIndexed) {
        removeKey = (lastKey != null && (lastKey + 1) === aKey) ? removeKey : aKey
        ops.push(op('remove', path.concat(removeKey)))
        lastKey = aKey
      } else {
        ops.push(op('remove', path.concat(aKey)))
      }
    })
  }

  b.forEach((bValue, bKey) => {
    if (a.has && !a.has(bKey)) {
      ops.push(op('add', path.concat(bKey), bValue))
    }
  })

  return ops
}

function sequenceDiff(a, b, path = []) {
  var ops = []
  if (is(a, b)) {
    return ops
  }
  if (b.count() > 100) {
    return mapDiff(a, b, path)
  }

  var lcsDiff = lcsdiff(a, b)

  var pathIndex = 0

  lcsDiff.forEach((diff) => {
    if (diff.op === '=') {
      pathIndex++
    } else if (diff.op === '!=') {
      if (isMap(diff.val) && isMap(diff.newVal)) {
        var mapDiffs = mapDiff(diff.val, diff.newVal, path.concat(pathIndex))
        ops = ops.concat(mapDiffs)
      }
      else {
        ops.push(op('replace', path.concat(pathIndex), diff.newVal))
      }
      pathIndex++
    }
    else if (diff.op === '+') {
      ops.push(op('add', path.concat(pathIndex), diff.val))
      pathIndex++
    }
    else if (diff.op === '-') { ops.push(op('remove', path.concat(pathIndex))) }
  })

  return ops
}

function primitiveTypeDiff(a, b, path = []) {
  if (a === b) {
    return []
  }
  else {
    return [ op('replace', path, b) ]
  }
}

export default function diff(a, b, path) {
  if (isIndexed(a) && isIndexed(b)) {
    return fromJS(sequenceDiff(a, b))
  }
  if (isMap(a) && isMap(b)) {
    return fromJS(mapDiff(a, b))
  }
  return fromJS(primitiveTypeDiff(a, b, path))
}
