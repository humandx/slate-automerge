/**
 * This converts differences between two Slate values to operations that act on
 * an Automerge document. This is a precursor to slateOpsToAutomerge.js
 * and could be used in place of it. This is most likely slower since it
 * creates more operations than slateOpsToAutomerge.
 */


import slateCustomToJson from "./slateCustomToJson"

const getPath = (op) => {
    return op.get("path").split("/").slice(1,)
}


/**
 * @function applyImmutableDiffOperations
 * @desc Converts differences between two Slate documents into Automerge operations.
 * @params doc the Automerge document
 * @params differences the differences between the two Slate documents created by the intelie_diff diff function.
 */
export const applyImmutableDiffOperations = (doc, differences) => {
  differences.forEach(op => {
    var currentNode = doc.note;
    var path = getPath(op);;
    var nodesExceptLast = path.slice(0, -1);;
    var lastNode = path.slice(-1);;
    var data;

    // Move pointer of currentNode to last possible reference before
    // we do the insertion, replacement or deletion.
    nodesExceptLast.forEach(el => {
      currentNode = currentNode[el];
    })

    if (op.get("op") == "add") {
      // Operation inserts an element into a list or map.
      data = slateCustomToJson(op.get("value"));
      lastNode = !isNaN(lastNode) ? parseInt(lastNode) : lastNode;
      currentNode.insertAt(lastNode, data);
    }
    if (op.get("op") == "replace") {
      // Operation replaces an element in a list or map.
      data = op.get("value");
      currentNode[lastNode] = data;
    }
    if (op.get("op") == "remove") {
      // Operation removes an element from a list or map.
      currentNode.deleteAt(parseInt(lastNode));
    }
  })
}
