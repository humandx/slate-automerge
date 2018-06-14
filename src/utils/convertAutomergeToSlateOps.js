/**
 * This converts Automerge operations to Slate operations.
 */

import automergeJsonToSlate from "./automergeJsonToSlate"

/**
 * @function automergeOpCreate
 * @desc Handles the `create` Automerge operation
 * @param {Object} op - Automerge operation
 * @param {Object} objIdMap - Map from the objectId to created object
 * @return {Object} Map from Object Id to Object
 */
const automergeOpCreate = (op, objIdMap) => {
  switch (op.type) {
    case 'map':
      objIdMap[op.obj] = {}
      break;
    case 'list':
      objIdMap[op.obj] = []
      break;
    default:
      console.error('`create`, unsupported type: ', op.type)
  }
  return objIdMap;
}

/**
 * @function automergeOpRemove
 * @desc Handles the `remove` Automerge operation
 * @param {Object} op - Automerge operation
 * @param {Object} objIdMap - Map from the objectId to created object
 * @param {Object} previousDoc - The previous Automerge document
 * @return {List} The corresponding Slate Operations for this operation
 */
const automergeOpRemove = (op, objIdMap, previousDoc) => {
    let slatePath, slateOp
    let pathString = op.path.slice(1).join("/")
    const lastObjectPath = op.path[op.path.length-1];
    pathString = pathString.match(/\d+/g)

    switch (lastObjectPath) {
      case 'characters':
        // Remove a character
        if (pathString) {
          slatePath = pathString.map(x => { return parseInt(x, 10); });
        } else {
          slatePath = [op.index]
        }

        slateOp = {
          type: 'remove_text',
          path: slatePath,
          offset: op.index,
          text: '*',
          marks: []
        }
        break;
      case 'nodes':
        // Remove a node
        if (pathString) {
          slatePath = pathString.map(x => { return parseInt(x, 10); });
          slatePath = [...slatePath, op.index];
        } else {
          slatePath = [op.index]
        }

        slateOp = {
          type: 'remove_node',
          path: slatePath,
        }
        break;
      default:
        console.error('`remove`, unsupported node type:', lastObjectPath)
    }
    return [slateOp];
}

/**
 * @function automergeOpSet
 * @desc Handles the `set` Automerge operation
 * @param {Object} op - Automerge operation
 * @param {Object} objIdMap - Map from the objectId to created object
 * @return {Object} Map from Object Id to Object
 */
const automergeOpSet = (op, objIdMap) => {
    if (op.hasOwnProperty('link')) {
      // What's the point of the `link` field? All my experiments
      // have `link` = true
      if (op.link) {
        // Check if linking to a newly created object or one that
        // already exists in our Automerge document
        if (objIdMap.hasOwnProperty(op.value)) {
          objIdMap[op.obj][op.key] = objIdMap[op.value]
        } else {
          // TODO: Does this ever happen?
          console.error('`set`, unable to find objectId: ', op.value)
        }
      }
    } else {
      objIdMap[op.obj][op.key] = op.value
    }
    return objIdMap;
}

/**
 * @function automergeOpInsert
 * @desc Handles the `insert` Automerge operation
 * @param {Object} op - Automerge operation
 * @param {Object} objIdMap - Map from the objectId to created object
 * @return {Object} Containing the map from Object Id to Object and deferred operation
 */
const automergeOpInsert = (op, objIdMap) => {
    if (op.link) {
      // Check if inserting into a newly created object or one that
      // already exists in our Automerge document
      if (objIdMap.hasOwnProperty(op.obj)) {
        objIdMap[op.obj].splice(op.index, 0, objIdMap[op.value])
      } else {
        return {objIdMap: objIdMap, deferredOps: op}
      }
    }
    else {
      // TODO: Does this ever happen?
      console.log('op.action is `insert`, but link is false')
    }
    return {objIdMap: objIdMap, deferredOps: null};
}

/**
 * @function automergeOpInsertText
 * @desc Handles deferred operations
 * @param {Array} deferredOps - a list of deferred operations to process
 * @param {Object} objIdMap - Map from the objectId to created object
 * @param {Array} slateOps - List of created Slate operations
 * @return {Array} List of list of Slate operations
 */
const automergeOpInsertText = (deferredOps, objIdMap, slateOps) => {
  // We know all ops in this list have the following conditions true:
  //  - op.action === `insert`
  //  - pathMap.hasOwnProperty(op.obj)
  //  - typeof pathMap[op.obj] === 'string' ||
  //    pathMap[op.obj] instanceof String
  deferredOps.forEach((op, idx) => {
    if (op === undefined || op === null) return;

    const insertInto = op.path.slice(1).join("/")
    let pathString, slatePath
    let slateOp = []

    if (insertInto === "nodes") {
      // If inserting into the "root" of the tree, the slatePath is []
      slatePath = []
    } else {
      pathString = insertInto.match(/\d+/g)
      slatePath = pathString.map(x => {
        return parseInt(x, 10);
      });
    }

    const nodeToAdd = objIdMap[op.value];

    switch (nodeToAdd.object) {
      case "character":
        slateOp.push({
          type: 'insert_text',
          path: slatePath,
          offset: op.index,
          text: objIdMap[op.value].text,
          marks: objIdMap[op.value].marks
        })
        break;
      case "block":
        const newNode = automergeJsonToSlate(nodeToAdd);
        slatePath.push(op.index)
        slateOp.push({
          type: "insert_node",
          path: slatePath,
          node: newNode,
        })
        break;
      default:
        break;
    }

    slateOps[idx] = slateOp
  })
  return slateOps
}

/**
 * @function convertAutomergeToSlateOps
 * @desc Converts Automerge operations to Slate operations.
 * @param {Array} automergeOps - a list of Automerge operations created from Automerge.diff
 * @param {Object} previousDoc - The previous Automerge document
 * @return {Array} List of Slate operations
 */
export const convertAutomergeToSlateOps = (automergeOps, previousDoc) => {
  // To build objects from Automerge operations
  let slateOps = []
  let objIdMap = {}
  let deferredOps = []
  let containsDeferredOps = false;

  automergeOps.forEach((op, idx) => {
    switch (op.action) {
      case "create":
        objIdMap = automergeOpCreate(op, objIdMap);
        break;
      case "remove":
        slateOps[idx] = automergeOpRemove(op, objIdMap, previousDoc);
        break;
      case "set":
        objIdMap = automergeOpSet(op, objIdMap);
        break;
      case "insert":
        let temp = automergeOpInsert(op, objIdMap);
        objIdMap = temp.objIdMap;
        deferredOps[idx] = temp.deferredOps;
        if (temp.deferredOps && !containsDeferredOps) {
          containsDeferredOps = true;
        }
        break;
      default:
        break;
    }
  })

  if (containsDeferredOps) {
    automergeOpInsertText(deferredOps, objIdMap, slateOps);
  }
  return flattenArray(slateOps);
}

/**
 * @function flattenArray
 * @desc Flattens an array of lists
 * @param {Array} array_of_lists - an array of list of Slate operations
 * @return {Array} Array of Slate operations
 */
const flattenArray = (array_of_lists) => {
  let newList = []
  array_of_lists.forEach((items) => {
    if (items !== null) {
      items.forEach((item) => {newList.push(item)})
    }
  });
  return newList;
}
