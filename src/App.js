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
      }
    ]
  }
})

// const initialValue2 = Value.fromJSON({
//   document: {
//     nodes: [
//       {
//         object: 'block',
//         type: 'paragraph',
//         nodes: [
//           {
//             object: 'text',
//             leaves: [
//               {
//                 text: 'A line of test in a aragraph..'
//               }
//             ]
//           }
//         ]
//       }
//     ]
//   }
// })
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
      // {
      //   object: 'block',
      //   type: 'paragraph',
      //   nodes: [
      //     {
      //       object: 'text',
      //       leaves: [
      //         {
      //           text: 'a'
      //         }
      //       ]
      //     }
      //   ]
      // }
    ]
  }
})

const SUPPORTED_SLATE_OPS = [
  'insert_text',
  'remove_text',
  'insert_node',
  'remove_node'
]

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
let string = 'this is string'
let testVal = []

// doc1 = Automerge.change(doc1, 'Initialize Slate state', doc => {
//   doc.value = { x : string, y : testVal }
// })
// doc2 = Automerge.merge(doc2, doc1)

// doc1 = Automerge.change(doc1, 'Initialize Slate state', doc => {
//   doc.ops = []
// })
// doc2 = Automerge.merge(doc2, doc1)

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
      this.removeNode = this.removeNode.bind(this)

      this.doc1inc = this.doc1inc.bind(this)
      this.doc1dec = this.doc1dec.bind(this)
      this.doc2inc = this.doc2inc.bind(this)
      this.doc2dec = this.doc2dec.bind(this)
      this.historyCheck = this.historyCheck.bind(this)

      this.useChangeOps = this.useChangeOps.bind(this)
      this.buildObjectIdMap = this.buildObjectIdMap.bind(this)
      this.mockAutomergeDelete = this.mockAutomergeDelete.bind(this)
    }

    componentDidMount = () => {
      console.log(customToJSON(this.state.value.document))
      doc1 = Automerge.change(doc1, 'Initialize Slate state', doc => {
        doc.note = customToJSON(this.state.value.document);
      })
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
        const {path, offset, text, marks, node, position, properties} = op;
        const index = path[path.length - 1];
        const rest = path.slice(0, -1)
        let currentNode = doc.note;
        switch (op.type) {
          case "insert_text":
            path.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            const characterNode = {
              object: "character",
              marks: [],
              text: text,
            }
            currentNode.characters.splice(offset, 0, characterNode);
            break;
          case "remove_text":
            path.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            currentNode.characters.splice(offset, text.length);
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
            currentNode.nodes.splice(index + 1, 0, childTwo);
            // Currently ignore properties
            break;
          case "merge_node":
            rest.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            let one = currentNode.nodes[index - 1];
            let two = currentNode.nodes[index];
            if (one.object == "text") {
              two.characters.forEach(char => {
                one.characters.push(char);
              })
            } else {
              two.nodes.forEach(char => {
                one.nodes.push(char);
              })
            }
            currentNode.nodes.splice(index, 0);
            break;
          case "insert_node":
            rest.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            currentNode.splice(index, 0, customToJSON(node));
            break;
          case "remove_node":
            rest.forEach(el => {
              currentNode = currentNode.nodes[el];
            })
            currentNode.splice(index, 1);
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
            console.error("NOT IMPLEMENTED YET")
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
          // this.applyImmutableDiffOperations(doc, differences)
          this.applySlateOperations(doc, operations)
        })

        // Update doc2 changes
        // const changes = Automerge.getChanges(doc1, doc1b)
        // console.log(changes)
        // doc2 = Automerge.applyChanges(doc2, changes)

        // Update doc1
        doc1 = doc1b
      }
    }

    onChange2 = ({ operations, value }) => {
      this.setState({ value2: value })

      if (operations.size > 1) {
        const doc2b = Automerge.change(doc2, 'Editor2 change', doc => {
          doc.note = customToJSON(value)
          // doc.note = value
        })

        // Update doc1 changes
        // const changes = Automerge.getChanges(doc2, doc2b)
        // doc2 = Automerge.applyChanges(doc2, changes)
        // console.log("After: ", doc2)
        // doc1 = Automerge.applyChanges(doc1, changes)

        // const merged = Automerge.merge(doc1, doc2)
        // console.log("doc1 merged: ", merged)

        // Update doc2
        doc2 = doc2b
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
      // const docVal = this.lastHistoryValue()

      // const ops = slateDiff(this.state.value2, docVal)
      // // console.log(ops)
      // const change = this.state.value2.change()
      // change.applyOperations(ops)
      // this.setState({ value2: change.value })
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

      })
      // TODO: Merge like operations for `remove_text` and `insert_text`

      const change = this.state.value2.change()
      change.applyOperations(slateOps)
      this.setState({ value2: change.value })
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

    /////////////////////////////
    doc1inc() {
      string = string + '!'
      testVal.push('doc1')
      doc1 = Automerge.change(doc1, 'doc1inc', doc => {
        doc.value = { x : string, y : testVal }
      })
    }
    doc1dec() {
      string = string.substring(0, string.length - 1)
      if (testVal.length > 1) { testVal.pop() }
      doc1 = Automerge.change(doc1, 'doc1dec', doc => {
        doc.value = { x : string, y : testVal }
      })
    }
    doc2inc() {
      string = string + '?'
      doc2 = Automerge.change(doc2, 'doc2inc', doc => {
        doc.value = { x : string, y : testVal }
      })
    }
    doc2dec() {
      string = string.substring(1, string.length)
      doc2 = Automerge.change(doc2, 'doc2dec', doc => {
        doc.value = { x : string, y : testVal }
      })
    }
    historyCheck() {
      let history = Automerge.getHistory(doc1)
      console.log(Automerge.diff(history[history.length - 2].snapshot, doc1))
    }
    /////////////////////////////

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
      const snapshot = Automerge.getHistory(doc1)[0].snapshot.note

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

    mockAutomergeDelete() {
      const history = Automerge.getHistory(doc1)
      const op = history[history.length - 1].change.ops[0]

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

        const change = this.state.value2.change()
        change.applyOperation(slateOp)
        this.setState({ value2: change.value })
      }
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
            <hr></hr>
            <button onClick={this.doc1inc}>Doc1 x+1</button>
            <button onClick={this.doc1dec}>Doc1 x-1</button>
            <button onClick={this.doc2inc}>Doc2 x+1</button>
            <button onClick={this.doc2dec}>Doc2 x-1</button>
            <button onClick={this.historyCheck}>History Check</button>
            <hr></hr>
            <button onClick={this.useChangeOps}>Use Change Ops</button>
            <button onClick={this.buildObjectIdMap}>Deep Traverse</button>
            <button onClick={() => {console.log(this.state.pathMap)}}>Log Path Map</button>
            <button onClick={this.mockAutomergeDelete}>Mock Automerege Delete</button>
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
