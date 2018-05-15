import React from 'react'
import { Editor } from 'slate-react'
import { Value, Block } from 'slate'
import diff from './intelie_diff/diff'
import slateDiff from 'slate-diff'
import Automerge from 'automerge'

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

doc1 = Automerge.change(doc1, 'Initialize Slate state', doc => {
  doc.ops = []
})
doc2 = Automerge.merge(doc2, doc1)

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
    }

    state = {
      value: initialValue,
      value2: initialValue2,
    }

    onChange1 = ({ operations, value }) => {
      this.setState({ value: value })

      // Ignore selection changes
      if (operations.size > 1) {
        // console.log(operations)
        // console.log(operations.toJS())
        const doc1b = Automerge.change(doc1, 'Editor1 change', doc => {
          operations.forEach(op => {
            if (SUPPORTED_SLATE_OPS.includes(op.type)) {
              console.log(op.toJS())
              doc.ops.push(op.toJS())
            }
          })
          // doc.note = value
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
          doc.note = value.toJSON()
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
            const valJSON = val.toJSON()
            console.log('blockJSON: ', valJSON)
            console.log('blockSlate: ', Block.fromJSON(valJSON))
          }
        }
      })
    }

    reflect() {
      const ops = slateDiff(this.state.value, this.state.value2)
      console.log(ops)
      const change = this.state.value.change()
      change.applyOperations(ops)
      this.setState({ value: change.value })
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
            <button onClick={() => {console.log(this.state.value2.toJSON())}}>Editor2 JSON</button>
            <button onClick={this.findChanges}>Get Changes</button>
            <hr></hr>
            <button onClick={() => {console.log(this.state.value)}}>Value1 Slate</button>
            <button onClick={() => {console.log(this.state.value2)}}>Value2 Slate</button>
            <button onClick={() => {console.log(this.state.value.toJSON())}}>Val1 JSON</button>
            <button onClick={() => {console.log(this.state.value2.toJSON())}}>Val2 JSON</button>
            <button onClick={this.removeNode}>Remove Node</button>
            <button onClick={this.immutablePatch}>Traverse Diff</button>
            <button onClick={this.reflect}>Reflect Test</button>
            <hr></hr>
            <button onClick={this.doc1inc}>Doc1 x+1</button>
            <button onClick={this.doc1dec}>Doc1 x-1</button>
            <button onClick={this.doc2inc}>Doc2 x+1</button>
            <button onClick={this.doc2dec}>Doc2 x-1</button>
            <button onClick={this.historyCheck}>History Check</button>
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