import {is, Record} from 'immutable'

/**
 * Returns a two-dimensional array (an array of arrays) with dimensions n by m.
 * All the elements of this new matrix are initially equal to x
 * @param n number of rows
 * @param m number of columns
 * @param x initial element for every item in matrix
 */
function makeMatrix(n, m, x) {
  var matrix = [];
  for (var i = 0; i < n; i++) {
    matrix[i] = new Array(m);
    for (var j = 0; j < m; j++) {
      matrix[i][j] = x;
    }
  }

  return matrix;
};

/**
 * Computes Longest Common Subsequence between two Immutable.JS Indexed Iterables
 * Based on Dynamic Programming http://rosettacode.org/wiki/Longest_common_subsequence#Java
 * @param xs ImmutableJS Indexed Sequence 1
 * @param ys ImmutableJS Indexed Sequence 2
 */
export function lcs(xs, ys) {
  var matrix = computeLcsMatrix(xs, ys);

  return backtrackLcs(xs, ys, matrix);
};

var DiffResult = Record({op: '=', val: null});
var ReplaceResult = Record({op: '!=', val: null, newVal: null});

/**
 * Returns the resulting diff operations of LCS between two sequences
 * @param xs Indexed Sequence 1
 * @param ys Indexed Sequence 2
 * @returns Array of DiffResult {op:'=' | '+' | '-', val:any}
 */
export function diff(xs, ys) {
  var matrix = computeLcsMatrix(xs, ys);

  return printDiff(matrix, xs, ys, xs.size || 0, ys.size || 0);
};

function printDiff(matrix, xs, ys, i, j) {
  if (i === 0 && j === 0) {
    return [];
  }
  if (i > 0 && j > 0 && is(xs.get(i - 1), ys.get(j - 1))) {
    return printDiff(matrix, xs, ys, i - 1, j - 1).concat(new DiffResult({
      op: '=',
      val: xs.get(i - 1)
    }));
  }
  else if (i > 0 && j > 0 && i === j && !is(xs.get(i - 1), ys.get(j - 1))) {
    return printDiff(matrix, xs, ys, i - 1, j - 1).concat(new ReplaceResult({
      val: xs.get(i - 1),
      newVal: ys.get(i - 1)
    }));
  }
  else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
    return printDiff(matrix, xs, ys, i, j - 1).concat(new DiffResult({
      op: '+',
      val: ys.get(j - 1)
    }));
  }
  else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
    return printDiff(matrix, xs, ys, i - 1, j).concat(new DiffResult({
      op: '-',
      val: xs.get(i - 1)
    }));
  }
};

/**
 * Computes the Longest Common Subsequence table
 * @param xs Indexed Sequence 1
 * @param ys Indexed Sequence 2
 */
function computeLcsMatrix(xs, ys) {
  var n = xs.size || 0;
  var m = ys.size || 0;
  var a = makeMatrix(n + 1, m + 1, 0);

  for (var i = 0; i < n; i++) {
    for (var j = 0; j < m; j++) {
      if (is(xs.get(i), ys.get(j))) {
        a[i + 1][j + 1] = a[i][j] + 1;
      }
      else {
        a[i + 1][j + 1] = Math.max(a[i + 1][j], a[i][j + 1]);
      }
    }
  }

  return a;
}

/**
 * Extracts a LCS from matrix M
 * @param xs Indexed Sequence 1
 * @param ys Indexed Sequence 2
 * @param matrix LCS Matrix
 * @returns {Array.<T>} Longest Common Subsequence
 */
export function backtrackLcs(xs, ys, matrix) {
  var lcs = [];
  for (var i = xs.size, j = ys.size; i !== 0 && j !== 0;) {
    if (matrix[i][j] === matrix[i - 1][j]) {
      i--;
    } else if (matrix[i][j] === matrix[i][j - 1]) {
      j--;
    } else if (is(xs.get(i - 1), ys.get(j - 1))) {
      lcs.push(xs.get(i - 1));
      i--;
      j--;
    }
  }
  return lcs.reverse();
};

