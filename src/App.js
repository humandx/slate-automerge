import React from 'react'
import { Editor } from 'slate-react'
import { Value, Block } from 'slate'
import diff from './intelie_diff/diff'
import customToJSON from "./utils/customToJson"
import { applyImmutableDiffOperations } from "./utils/immutableDiffToAutomerge"
import { applySlateOperations } from "./utils/slateOpsToAutomerge"
import { convertAutomergeToSlateOps } from "./utils/convertAutomergeToSlateOps"
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

class App extends React.Component {

    constructor(props) {
      super(props)

      this.lastHistoryValue = this.lastHistoryValue.bind(this)
      this.findChanges = this.findChanges.bind(this)
      this.immutablePatch = this.immutablePatch.bind(this)
      this.reflect = this.reflect.bind(this)
      this.reflectDiff = this.reflectDiff.bind(this)
      this.removeNode = this.removeNode.bind(this)

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

    onChange1 = ({ operations, value }) => {

      var differences = diff(this.state.value.document, value.document);

      this.setState({ value: value })

      if (differences.size > 0) {

        // Using the difference obtained from the Immutable diff library,
        // apply the operations to the Automerge document.
        const doc1b = Automerge.change(doc1, 'Editor1 change', doc => {
          applyImmutableDiffOperations(doc, differences)
          // applySlateOperations(doc, operations)
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
          applyImmutableDiffOperations(doc, differences)
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
      const opSetDiff = Automerge.diff(doc2, doc1)

      const slateOps = convertAutomergeToSlateOps(opSetDiff, this.state.pathMap, this.state.value2)

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

      const slateOps = convertAutomergeToSlateOps(opSetDiff, this.state.pathMap, this.state.value2)

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

      const slateOps = convertAutomergeToSlateOps(opSetDiff, this.state.pathMap, this.state.value2)

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
