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
 * @param {Value} value - the Slate Value
 * @return {List} The corresponding Slate Operations for this operation
 */
const automergeOpRemove = (op, objIdMap, value) => {
    let pathString, slatePath, slateOp
    pathString = op.path.slice(1).join("/")
    if (pathString) {
      pathString = pathString.match(/\d+/g)
    } else {
      return null;
    }
    if (pathString) {
      slatePath = pathString.map(x => {
        return parseInt(x, 10);
      });
    }
    else {
      // FIXME: Is `op.index` always the right path? What happens in a
      // sub-node (in other words, will `slatePath` ever need to have
      // length > 1?
      slatePath = [op.index]
    }

    // Validate the operation using the node type at path given by `op.obj`
    // FIXME: Is the Slate's Value reliable enough to get the node type?
    // Use the document to be changed
    let removeNode = value.document.getNodeAtPath(slatePath)
    switch (removeNode.object) {
      case 'text':
        slateOp = {
          type: 'remove_text',
          path: slatePath,
          offset: op.index,
          text: '*',
          marks: []
        }
        break;
      case 'block':
        if (removeNode.type !== "paragraph") {
          removeNode = removeNode.nodes.get(op.index);
          slatePath = [...slatePath, op.index];
        }
        slateOp = {
          type: 'remove_node',
          path: slatePath,
          node: removeNode
        }
        break;
      default:
        console.error('`remove`, unsupported node type: ', removeNode.object)
    }
    return slateOp;
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
 * @param {Value} value - the Slate Value
 * @return {Array} List of list of Slate operations
 */
const automergeOpInsertText = (deferredOps, objIdMap, slateOps, value) => {
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

    // If the `pathString` is available, then we are likely inserting text
    // FIXME: Verify this
    pathString = insertInto.match(/\d+/g)
    if (pathString) {
      slatePath = pathString.map(x => {
        return parseInt(x, 10);
      });

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

    } else {
      // FIXME: Is `op.index` always the right path? What happens in a
      // sub-node?
      slatePath = [op.index]

      // 5/27/18: `insert_node` can't seem to insert a node with pre-existing
      // text, so we need to insert a node, then `insert_text` into that node

      // Extract text from node to insert, then insert a "clean node", and
      // re-insert text with `insert_text`
      const insertNode = objIdMap[op.value]
      const insertTextNodes = insertNode.nodes

      insertNode.nodes = [{
        object: 'text',
        characters: []
      }]

      slateOp.push({
        type: 'insert_node',
        path: slatePath,
        node: insertNode
      })

      // TODO: Convert the `Text` object properly into separate `insert_text`
      // operations with proper marks
      const nodeTextString = insertTextNodes.map(textNode => {
        return textNode.characters.map(character => {
          return character.text
        }).join('')
      })
      slateOp.push({
        type: 'insert_text',
        // Insert the text in the first node of the newly created node
        path: [slatePath[0], 0],
        offset: 0,
        text: nodeTextString.join(''),
        marks: []
      })
    }
    slateOps[idx] = slateOp
  })
  return slateOps
}

/**
 * @function convertAutomergeToSlateOps
 * @desc Converts Automerge operations to Slate operations.
 * @param {Array} automergeOps - a list of Automerge operations created from Automerge.diff
 * @param {Value} value - the Slate Value
 * @return {Array} List of Slate operations
 */
export const convertAutomergeToSlateOps = (automergeOps, value) => {
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
        slateOps[idx] = [automergeOpRemove(op, objIdMap, value)];
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
    automergeOpInsertText(deferredOps, objIdMap, slateOps, value);
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
