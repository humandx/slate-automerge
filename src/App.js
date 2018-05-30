import React from 'react'
import { Editor } from 'slate-react'
import { Value, Block } from 'slate'
import diff from './intelie_diff/diff'
import customToJSON from "./customToJson"
import slateDiff from 'slate-diff'
import Automerge from 'automerge'

var path = require('./intelie_diff/path');
var concatPath = path.concat,
                  escape = path.escape;

const initialValue = Value.fromJSON({
  document: {
    nodes: [
      {
        object: 'block',
        type: 'paragraph',
        nodes: [
          {
            object: 'text',
            leaves: [
              {
                text: 'A line of text in a paragraph.'
              }
            ]
          }
        ]
      },
      {
        object: 'block',
        type: 'paragraph',
        nodes: [
          {
            object: 'text',
            leaves: [
              {
                text: 'Another line of text'
              }
            ]
          }
        ]
      },
      {
        object: 'block',
        type: 'paragraph',
        nodes: [
          {
            object: 'text',
            leaves: [
              {
                text: 'Yet another line of text'
              }
            ]
          }
        ]
      }
    ]
  }
})

const initialValue2 = Value.fromJSON({
  document: {
    nodes: [
      {
        object: 'block',
        type: 'paragraph',
        nodes: [
          {
            object: 'text',
            leaves: [
              {
                text: 'A line of text in a paragraph.'
              }
            ]
          }
        ]
      },
      {
        object: 'block',
        type: 'paragraph',
        nodes: [
          {
            object: 'text',
            leaves: [
              {
                text: 'Another line of text'
              }
            ]
          }
        ]
      },
      {
        object: 'block',
        type: 'paragraph',
        nodes: [
          {
            object: 'text',
            leaves: [
              {
                text: 'Yet another line of text'
              }
            ]
          }
        ]
      }
    ]
  }
})

const SUPPORTED_SLATE_SET_OBJECTS = [
  'document',
  'block',
  'text',
  'character'
]

const SUPPORTED_SLATE_PATH_OBJECTS = [
  'nodes',
  'characters'
]

// let doc1 = Automerge.initImmutable();
// let doc2 = Automerge.initImmutable();
let doc1 = Automerge.init();
let doc2 = Automerge.init();

const allowedOperations = [
  "insert_text", "remove_text", "insert_node", "split_node",
  "remove_node", "merge_node", "set_node", "move_node"
];

class App extends React.Component {

    constructor(props) {
      super(props)

      this.lastHistoryValue = this.lastHistoryValue.bind(this)
      this.findChanges = this.findChanges.bind(this)
      this.immutablePatch = this.immutablePatch.bind(this)
      this.reflect = this.reflect.bind(this)
      this.reflectDiff = this.reflectDiff.bind(this)
      this.removeNode = this.removeNode.bind(this)

      this.convertAutomergeToSlateOps = this.convertAutomergeToSlateOps.bind(this)
      this.useChangeOps = this.useChangeOps.bind(this)
      this.buildObjectIdMap = this.buildObjectIdMap.bind(this)
      this.mockAutomerge = this.mockAutomerge.bind(this)
    }

    componentDidMount = () => {
      console.log(customToJSON(this.state.value.document))
      doc1 = Automerge.change(doc1, 'Initialize Slate state', doc => {
        doc.note = customToJSON(this.state.value.document);
      })
      ///
      doc2 = Automerge.merge(doc2, doc1)
      ///
      this.buildObjectIdMap()
    }

    state = {
      value: initialValue,
      value2: initialValue2,
      pathMap: {}
    }

    getPath = (op) => {
      // if (op.get("path").indexOf("characters") > -1) {
      //   return op.get("path").replace("characters", "leaves/0/text").split("/").slice(1,)
      // } else {
        return op.get("path").split("/").slice(1,)
      // }
    }

    applyImmutableDiffOperations = (doc, differences) => {
      differences.forEach(op => {
        var currentNode = doc.note;
        var path = this.getPath(op);;
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
          data = customToJSON(op.get("value"));
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

    applySlateOperations = (doc, operations) => {
      operations.forEach(op => {
        if (allowedOperations.indexOf(op.type) == -1) {
          return;
        }
        const {
          path, offset, text, length, mark,
          node, position, properties, newPath
        } = op;
        const index = path[path.length - 1];
        const rest = path.slice(0, -1)
        let currentNode = doc.note;
        let characters;
        switch (op.type) {
          case "add_mark":
            // Untested
            path.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            currentNode.characters.forEach((char, i) => {
              if (i < offset) return;
              if (i >= offset + length) return;
              const hasMark = char.marks.find((charMark) => {
                return charMark.type == mark.type
              })
              if (!hasMark) {
                char.marks.push(mark)
              }
            })
            break;
          case "remove_mark":
            // Untested
            path.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            currentNode.characters.forEach((char, i) => {
              if (i < offset) return;
              if (i >= offset + length) return;
              const markIndex = char.marks.findIndex((charMark) => {
                return charMark.type == mark.type
              })
              if (markIndex) {
                char.marks.deleteAt(markIndex, 1);
              }
            })
            break;
          case "set_mark":
            // Untested
            path.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            currentNode.characters.forEach((char, i) => {
              if (i < offset) return;
              if (i >= offset + length) return;
              const markIndex = char.marks.findIndex((charMark) => {
                return charMark.type == mark.type
              })
              if (markIndex) {
                char.marks[markIndex] = mark;
              }
            })
            break;
          case "insert_text":
            path.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            const characterNode = {
              object: "character",
              marks: [],
              text: text,
            }
            currentNode.characters.insertAt(offset, characterNode);
            break;
          case "remove_text":
            path.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            currentNode.characters.deleteAt(offset, text.length);
            break;
          case "split_node":
            rest.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            let childOne = currentNode.nodes[index];
            let childTwo = JSON.parse(JSON.stringify(currentNode.nodes[index]));
            if (childOne.object == "text") {
              childOne.characters.splice(position)
              childTwo.characters.splice(0, position)
            } else {
              childOne.nodes.splice(position)
              childTwo.nodes.splice(0, position)
            }
            currentNode.nodes.insertAt(index + 1, childTwo);
            if (properties) {
              if (currentNode.nodes[index + 1].object !== "text") {
                let propertiesJSON = customToJSON(properties);
                Object.keys(propertiesJSON).forEach(key => {
                  if (propertiesJSON.key) {
                    currentNode.nodes[index + 1][key] = propertiesJSON.key;
                  }
                })
              }
            }
            break;
          case "merge_node":
            rest.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            let one = currentNode.nodes[index - 1];
            let two = currentNode.nodes[index];
            if (one.object == "text") {
              one.characters.push(...two.characters)
            } else {
              one.nodes.push(...two.nodes)
            }
            currentNode.nodes.deleteAt(index, 1);
            break;
          case "insert_node":
            rest.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            currentNode.insertAt(index, customToJSON(node));
            break;
          case "remove_node":
            rest.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            currentNode.deleteAt(index, 1);
            break;
          case "set_node":
            path.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            for (let attrname in properties) {
              currentNode[attrname] = properties[attrname];
            }
            break;
          case "move_node":
            const newIndex = newPath[newPath.length - 1]
            const newParentPath = newPath.slice(0, -1)
            const oldParentPath = path.slice(0, -1)
            const oldIndex = path[path.length - 1]

            // Remove the old node from it's current parent.
            oldParentPath.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            let nodeToMove = currentNode.deleteAt(oldIndex, 1);

            // Find the new target...
            if (
              oldParentPath.every((x, i) => x === newParentPath[i]) &&
              oldParentPath.length === newParentPath.length
            ) {
              // Do nothing
            } else if (
              oldParentPath.every((x, i) => x === newParentPath[i]) &&
              oldIndex < newParentPath[oldParentPath.length]
            ) {
              // Otherwise, if the old path removal resulted in the new path being no longer
              // correct, we need to decrement the new path at the old path's last index.
              currentNode = doc.note;
              newParentPath[oldParentPath.length]--
              newParentPath.forEach(el => {
                currentNode = currentNode.nodes[el];
              })
            } else {
              // Otherwise, we can just grab the target normally...
              currentNode = doc.note;
              newParentPath.forEach(el => {
                currentNode = currentNode.nodes[el];
              })
            }

            // Insert the new node to its new parent.
            currentNode.insertAt(newIndex, nodeToMove);
            break;
        }
      })
    }

    onChange1 = ({ operations, value }) => {

      var differences = diff(this.state.value.document, value.document);

      this.setState({ value: value })

      if (differences.size > 0) {

        // Using the difference obtained from the Immutable diff library,
        // apply the operations to the Automerge document.
        const doc1b = Automerge.change(doc1, 'Editor1 change', doc => {
          this.applyImmutableDiffOperations(doc, differences)
          // this.applySlateOperations(doc, operations)
        })

        // Update doc2 changes
        const opSetDiff = Automerge.diff(doc1, doc1b)
        const changes = Automerge.getChanges(doc1, doc1b)
        console.log(changes)
        // doc2 = Automerge.applyChanges(doc2, changes)

        // Update doc1
        doc1 = doc1b
        this.reflectDiffFromOneToTwo(opSetDiff, changes);
      }
    }

    onChange2 = ({ operations, value }) => {

      var differences = diff(this.state.value2.document, value.document);

      this.setState({ value2: value })

      if (differences.size > 0) {
        const doc2b = Automerge.change(doc2, 'Editor2 change', doc => {
          this.applyImmutableDiffOperations(doc, differences)
          // doc.note = customToJSON(value)
          // doc.note = value
        })

        // Update doc1 changes
        const opSetDiff = Automerge.diff(doc1, doc2b)
        const changes = Automerge.getChanges(doc1, doc2b)
        console.log(changes)
        // doc1 = Automerge.applyChanges(doc1, changes)

        // Update doc2
        doc2 = doc2b
        this.reflectDiffFromTwoToOne(opSetDiff, changes);
      }
    }

    lastHistoryValue() {
      const history = Automerge.getHistory(doc2)
      const lastObj = history[history.length - 1]
      const lastObjJSON = JSON.stringify(lastObj.snapshot.note)
      const docVal = Value.fromJSON(JSON.parse(lastObjJSON))
      console.log(docVal)

      return docVal
    }

    findChanges() {
      console.log(Automerge.diff(doc2, doc1))
    }

    immutablePatch() {
      var differences = diff(this.state.value.document, this.state.value2.document)

      differences.forEach((key) => {
        if (key.get('path').indexOf('key') > -1) { return }
        console.log("Key: ", key)
        console.log("op: ", key.get('op'))
        console.log("path: ", key.get('path'))
        const val = key.get('value')
        console.log("value: ", val)
        if (val) {
          console.log("value.object: ", val.object)
          if (val.object === 'block') {
            const valJSON = customToJSON(val)
            console.log('blockJSON: ', valJSON)
            console.log('blockSlate: ', Block.fromJSON(valJSON))
          }
        }
      })
    }

    reflect() {
      const history = Automerge.getHistory(doc1)
      const automergeOps = history[history.length - 1].change.ops
      const slateOps = []

      // To build objects from Automerge operations
      const objIdMap = {}
      let insPos, path, insObjId;

      automergeOps.map(op => {
        if (op.action === "del") {
          let offset = op.key.slice(op.key.indexOf(':') + 1,)
          let slatePath = this.state.pathMap[op.obj].match(/\d+/g).map(x => {
              return parseInt(x, 10);
          });
          offset = parseInt(offset, 10) - 1

          const slateOp = {
            type: 'remove_text',
            path: slatePath,
            offset: offset,
            text: '*',
            marks: []
          }
          slateOps.push(slateOp)
        }

        if (op.action === 'ins') {
          if (op.key === '_head') {
            insPos = 0
          }
          else {
            insPos = op.key.slice(op.key.indexOf(':') + 1,)
          }
        }
        if (op.action === "makeMap") {
          objIdMap[op.obj] = {}
        }
        if (op.action === "makeList") {
          objIdMap[op.obj] = []
        }
        if (op.action === "set") {
          objIdMap[op.obj][op.key] = op.value
        }
        if (op.action === "link") {
          if (op.key.indexOf(':') >= 0) {
            const key = op.key.slice(0, op.key.indexOf(':'))
            // FIXME: Do these first two `if` statements ever execute?
            if (objIdMap.hasOwnProperty(key)) {
              objIdMap[op.obj][key] = objIdMap[op.value]
              console.log('key found in objIdMap, objIdMap: ', objIdMap)
            }
            else if (this.state.pathMap.hasOwnProperty(key)) {
              path = this.state.pathMap[key]
              console.log('key found in pathMap, path: ', path)
            }
            else {
              path = this.state.pathMap[op.obj]
              insObjId = op.value

              // "Operation cycle" is completed when we link the `ins`.obj
              let slatePath = path.match(/\d+/g).map(x => {
                return parseInt(x, 10);
              });
              insPos = parseInt(insPos, 10)

              const slateOp = {
                type: 'insert_text',
                path: slatePath,
                offset: insPos,
                text: objIdMap[insObjId].text,
                marks: objIdMap[insObjId].marks
              }
              slateOps.push(slateOp)
            }
          }
          else {
            objIdMap[op.obj][op.key] = objIdMap[op.value]
          }
        }
      })

      // TODO: Merge like operations for `remove_text` and `insert_text`

      const change = this.state.value2.change()
      change.applyOperations(slateOps)
      this.setState({ value2: change.value })

      // Paths may have changed after applying operations - update objectId map
      // In the future, this should only change those values that changed
      this.buildObjectIdMap()
    }

    // FIXME: Unexpected behavior for the following scenarios:
    //   Merge nodes and immediately insert text
    //     Expected: Proper merge and text insert
    //     Actual: Inserted text overwrites some chars in merged node
    //     Probably because merge node is equal to delete entire nodes
    //     and re-insert with new text
    reflectDiff() {
      const automergeOps = Automerge.diff(doc2, doc1)

      const slateOps = this.convertAutomergeToSlateOps(automergeOps)

      console.log('slateOps: ', slateOps)
      const change = this.state.value2.change()
      change.applyOperations(slateOps)
      this.setState({ value2: change.value })

      // Update the Automerge document as well
      // TODO: only apply `diff` changes
      // doc2 = Automerge.applyChanges(doc2, automergeOps)
      doc2 = Automerge.merge(doc2, doc1)

      // Paths may have changed after applying operations - update objectId map
      // TODO: only change those values that changed
      this.buildObjectIdMap()
    }

    reflectDiffFromOneToTwo(opSetDiff, changes) {

      const slateOps = this.convertAutomergeToSlateOps(opSetDiff)

      console.log('slateOps: ', slateOps)
      const change = this.state.value2.change()
      change.applyOperations(slateOps)
      this.setState({ value2: change.value })

      // Update the Automerge document as well
      doc2 = Automerge.applyChanges(doc2, changes)

      // Paths may have changed after applying operations - update objectId map
      // TODO: only change those values that changed
      this.buildObjectIdMap()
    }

    reflectDiffFromTwoToOne(opSetDiff, changes) {

      const slateOps = this.convertAutomergeToSlateOps(opSetDiff)

      console.log('slateOps: ', slateOps)
      const change = this.state.value.change()
      change.applyOperations(slateOps)
      this.setState({ value: change.value })

      // Update the Automerge document as well
      doc1 = Automerge.applyChanges(doc1, changes)

      // Paths may have changed after applying operations - update objectId map
      // TODO: only change those values that changed
      this.buildObjectIdMap()
    }

    convertAutomergeToSlateOps(automergeOps) {
      // To build objects from Automerge operations
      const slateOps = []
      const objIdMap = {}
      const deferredOps = []

      automergeOps.map(op => {
        if (op.action === 'create') {
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
        }

        if (op.action === 'remove') {
          let pathString, slatePath, slateOp

          pathString = this.state.pathMap[op.obj].match(/\d+/g)
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
          const removeNode = this.state.value2.document.getNodeAtPath(slatePath)
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
        }

        if (op.action === "set") {
          if (op.hasOwnProperty('link')) {
            // What's the point of the `link` field? All my experiments
            // have `link` = true
            if (op.link) {
              // Check if linking to a newly created object or one that
              // already exists in our Automerge document
              if (objIdMap.hasOwnProperty(op.value)) {
                objIdMap[op.obj][op.key] = objIdMap[op.value]
              }
              else if (this.state.pathMap.hasOwnProperty(op.value)) {
                objIdMap[op.obj][op.key] = this.state.pathMap[op.value]
              }
              else {
                // TODO: Does this ever happen?
                console.error('`set`, unable to find objectId: ', op.value)
              }
            }
          }
          else {
            objIdMap[op.obj][op.key] = op.value
          }
        }

        if (op.action === 'insert') {
          if (op.link) {
            // Check if inserting into a newly created object or one that
            // already exists in our Automerge document
            if (objIdMap.hasOwnProperty(op.obj)) {
              objIdMap[op.obj][op.index] = objIdMap[op.value]
            }
            else if (this.state.pathMap.hasOwnProperty(op.obj)) {
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
        }
      })

      // We know all ops in this list have the following conditions true:
      //  - op.action === `insert`
      //  - this.state.pathMap.hasOwnProperty(op.obj)
      //  - typeof this.state.pathMap[op.obj] === 'string' ||
      //    this.state.pathMap[op.obj] instanceof String
      deferredOps.map(op => {
        const insertInto = this.state.pathMap[op.obj]

        let pathString, slatePath
        let slateOp

        // If the `pathString` is available, then we are likely inserting text
        // FIXME: Verify this
        pathString = insertInto.match(/\d+/g)
        if (pathString) {
          slatePath = pathString.map(x => {
            return parseInt(x, 10);
          });

          slateOp = {
            type: 'insert_text',
            path: slatePath,
            offset: op.index,
            text: objIdMap[op.value].text,
            marks: objIdMap[op.value].marks
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
      return slateOps;
    }

    removeNode() {
      const rm = {
        type: 'remove_node',
        path: [1],
        node: this.state.value.document.nodes.get(1)
      }

      const change = this.state.value.change()
      change.applyOperation(rm)
      this.setState({ value: change.value })
    }

    pathConv(pathStr) {
      const result = pathStr.match(/\d+/g).map(v => {
        return parseInt(v, 10)
      })
      let path = result.slice(0, result.length-1)
      const offset = result[result.length-1]

      // Handle single node path
      if (path.length === 0) { path = [ offset ] }

      // console.log('path: ', path)
      // console.log('offset: ', offset)

      return { path, offset }
    }

    useChangeOps() {
      const firstObjOps = Automerge.getHistory(doc1)[0].change.ops

      firstObjOps.map(op => {
        if (op.action === 'set') {
          if (SUPPORTED_SLATE_SET_OBJECTS.includes(op.value)) {
            console.log(op)
          }
        }
        else if (op.action === 'link') {
          if (SUPPORTED_SLATE_PATH_OBJECTS.includes(op.key)) {
            console.log(op)
          }
        }
      })
    }

    buildObjectIdMap() {
      const history = Automerge.getHistory(doc1)
      const snapshot = history[history.length - 1].snapshot.note

      this.setState({pathMap: this.deepTraverse(snapshot, null, {}) })
    }

    deepTraverse(obj, p, pathMap) {
      let path = p || ''
      const isList = obj instanceof Array

      // Iterate object keys instead
      if (!isList) {
        for (var key in obj) {
          if (obj.hasOwnProperty(key)) {
            if (SUPPORTED_SLATE_PATH_OBJECTS.includes(key)) {
              // console.log("key: ", key)
              // console.log("value: ", obj[key])
              // console.log("path: ", concatPath(path, escape(key)))
              const thisPath = concatPath(path, escape(key))
              pathMap[obj[key]._objectId] = thisPath
              this.deepTraverse(obj[key], thisPath, pathMap)
            }
          }
        }
      }
      else {
        // Assumed to be a list
        obj.forEach((value, key) => {
          // console.log("value: ", value)
          // console.log("path: ", concatPath(path, escape(key)))
          const thisPath = concatPath(path, escape(key))
          pathMap[value._objectId] = thisPath
          this.deepTraverse(value, thisPath, pathMap)
        });
      }

      return pathMap
    }

    mockAutomerge() {
      const slateOps = []
      let slateOp = {
        type: 'split_node',
        path: [0, 0],
        position: 30,
        target: null,
        properties: { type: undefined }
      }
      slateOps.push(slateOp)

      slateOp = {
        type: 'split_node',
        path: [0],
        position: 1,
        target: 30,
        properties: { type: 'paragraph' }
      }
      slateOps.push(slateOp)

      const change = this.state.value2.change()
      change.applyOperations(slateOps)
      this.setState({ value2: change.value })
    }

    /////////////////////////////

    render() {
        return (
          <div>
            <Editor
                value={this.state.value}
                onChange={this.onChange1}
            />
            <hr></hr>
            <Editor
                value={this.state.value2}
                onChange={this.onChange2}
            />
            <hr></hr>
            <button onClick={() => {console.log(slateDiff(this.state.value, this.state.value2))}}>Slate-Diff</button>
            <button onClick={() => {console.log(Automerge.getHistory(doc1))}}>Editor1 Automerge History</button>
            <button onClick={() => {console.log(Automerge.getHistory(doc2))}}>Editor2 Automerge History</button>
            <button onClick={this.lastHistoryValue}>Editor2 Last History Value JSON</button>
            <button onClick={() => {console.log(customToJSON(this.state.value2))}}>Editor2 JSON</button>
            <button onClick={this.findChanges}>Get Changes</button>
            <hr></hr>
            <button onClick={() => {console.log(this.state.value)}}>Value1 Slate</button>
            <button onClick={() => {console.log(this.state.value2)}}>Value2 Slate</button>
            <button onClick={() => {console.log(customToJSON(this.state.value))}}>Val1 JSON</button>
            <button onClick={() => {console.log(customToJSON(this.state.value2))}}>Val2 JSON</button>
            <button onClick={this.removeNode}>Remove Node</button>
            <button onClick={this.immutablePatch}>Traverse Diff</button>
            <button onClick={this.reflect}>Reflect Test</button>
            <button onClick={this.reflectDiff}>Reflect Diff</button>
            <hr></hr>
            <button onClick={this.useChangeOps}>Use Change Ops</button>
            <button onClick={this.buildObjectIdMap}>Deep Traverse</button>
            <button onClick={() => {console.log(this.state.pathMap)}}>Log Path Map</button>
            <button onClick={this.mockAutomerge}>Mock Automerge to Slate</button>
            {/* <button onClick={() => {console.log(diff(this.state.value.document, this.state.value2.document))}}>ImmutableDiff</button>
            <button onClick={() => {console.log(diff(this.state.value2.document, this.state.value.document))}}>Diff2to1</button>
            <button onClick={() => {console.log(Value.fromJSON(rtv).toJSON())}}>Doc3 JSON</button>
            <button onClick={() => {console.log(this.state.value.toJSON())}}>Doc JSON</button>
            <button onClick={this.immutablePatch}>Traverse Diff</button>
            <button onClick={this.reflect}>Reflect Test</button> */}
          </div>
        )
    }

}

export default App
