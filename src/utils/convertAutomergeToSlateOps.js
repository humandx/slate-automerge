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

const automergeOpRemove = (op, objIdMap, slateOps, pathMap, value, prevPathMap) => {
    let pathString, slatePath, slateOp
    pathString = pathMap[op.obj]
    if (pathString) {
      pathString = pathString.match(/\d+/g)
    } else {
      return slateOps;
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
    const removeNode = value.document.getNodeAtPath(slatePath)
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
        slateOp = {
          type: 'remove_node',
          path: slatePath,
          node: removeNode
        }
        break;
      default:
        console.error('`remove`, unsupported node type: ', removeNode.object)
    }
    slateOps.push(slateOp)
    return slateOps;
}

const automergeOpSet = (op, objIdMap, pathMap, prevPathMap) => {
    if (op.hasOwnProperty('link')) {
      // What's the point of the `link` field? All my experiments
      // have `link` = true
      if (op.link) {
        // Check if linking to a newly created object or one that
        // already exists in our Automerge document
        if (objIdMap.hasOwnProperty(op.value)) {
          objIdMap[op.obj][op.key] = objIdMap[op.value]
        }
        else if (pathMap.hasOwnProperty(op.value)) {
          objIdMap[op.obj][op.key] = pathMap[op.value]
        }
        else {
          // TODO: Does this ever happen?
          console.error('`set`, unable to find objectId: ', op.value)
        }
      }
    } else {
      objIdMap[op.obj][op.key] = op.value
    }
    return objIdMap;
}

const automergeOpInsert = (op, objIdMap, pathMap, deferredOps, prevPathMap) => {
    if (op.link) {
      // Check if inserting into a newly created object or one that
      // already exists in our Automerge document
      if (objIdMap.hasOwnProperty(op.obj)) {
        objIdMap[op.obj][op.index] = objIdMap[op.value]
      }
      else if (pathMap.hasOwnProperty(op.obj)) {
        deferredOps.push(op)
      }
      else {
        // TODO: Does this ever happen?
        console.error('`insert`, unable to find objectId: ', op.obj)
      }
    }
    else {
      // TODO: Does this ever happen?
      console.log('op.action is `insert`, but link is false')
    }
    return {objIdMap, deferredOps};
}

const automergeOpInsertText = (deferredOps, objIdMap, pathMap, slateOps, prevPathMap, value) => {
  // We know all ops in this list have the following conditions true:
  //  - op.action === `insert`
  //  - pathMap.hasOwnProperty(op.obj)
  //  - typeof pathMap[op.obj] === 'string' ||
  //    pathMap[op.obj] instanceof String
  deferredOps.map(op => {
    const insertInto = pathMap[op.obj]

    let pathString, slatePath
    let slateOp

    let oldPathValue = prevPathMap[op.value]
    let newPathValue = pathMap[op.value]

    // If the `pathString` is available, then we are likely inserting text
    // FIXME: Verify this
    let newValue = value;
    pathString = insertInto.match(/\d+/g)
    if (pathString) {
      slatePath = pathString.map(x => {
        return parseInt(x, 10);
      });

      if (objIdMap[op.value]) {
        slateOp = {
          type: 'insert_text',
          path: slatePath,
          offset: op.index,
          text: objIdMap[op.value].text,
          marks: objIdMap[op.value].marks
        }
      } else {
        let prevPath = prevPathMap[op.value];
        const rightEnd = prevPath.indexOf("characters")
        prevPath = prevPath.slice(0,rightEnd)
        pathString = prevPath.match(/\d+/g)
        let oldSlatePath = pathString.map(x => {
          return parseInt(x, 10);
        });

        let prevIndex = prevPathMap[op.value].slice(rightEnd)
        let pathIndex = prevIndex.match(/\d+/g)
        let oldSlateIndex = pathIndex.map(x => {
          return parseInt(x, 10);
        })[0];
        let character = value.document.getNodeAtPath(oldSlatePath).characters.get(oldSlateIndex)

        slateOp = {
          type: 'insert_text',
          path: slatePath,
          offset: op.index,
          text: character.text,
          marks: character.marks
        }
      }
    }
    else {
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

      slateOp = {
        type: 'insert_node',
        path: slatePath,
        node: insertNode
      }
      slateOps.push(slateOp)

      // TODO: Convert the `Text` object properly into separate `insert_text`
      // operations with proper marks
      const nodeTextString = insertTextNodes.map(textNode => {
        return textNode.characters.map(character => {
          return character.text
        }).join('')
      })
      slateOp = {
        type: 'insert_text',
        // Insert the text in the first node of the newly created node
        path: [slatePath[0], 0],
        offset: 0,
        text: nodeTextString.join(''),
        marks: []
      }
    }

    slateOps.push(slateOp)
  })
}

export const convertAutomergeToSlateOps = (automergeOps, pathMap, prevPathMap, value) => {
  // To build objects from Automerge operations
  let slateOps = []
  let objIdMap = {}
  let deferredOps = []

  automergeOps.map(op => {
    switch (op.action) {
      case "create":
        objIdMap = automergeOpCreate(op, objIdMap);
        break;
      case "remove":
        slateOps = automergeOpRemove(op, objIdMap, slateOps, pathMap, value, prevPathMap);
        break;
      case "set":
        objIdMap = automergeOpSet(op, objIdMap, pathMap, prevPathMap);
        break;
      case "insert":
        let temp = automergeOpInsert(op, objIdMap, pathMap, deferredOps, prevPathMap);
        objIdMap = temp.objIdMap;
        deferredOps = temp.deferredOps;
        break;
    }
  })

  if (deferredOps) {
    automergeOpInsertText(deferredOps, objIdMap, pathMap, slateOps, prevPathMap, value);
  }
  return slateOps;
}
