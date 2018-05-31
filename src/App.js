import React from 'react'
import Immutable from "immutable";
import { Editor } from 'slate-react'
import { Value, Block } from 'slate'
import diff from './intelie_diff/diff'
import customToJSON from "./utils/customToJson"
import { applyImmutableDiffOperations } from "./utils/immutableDiffToAutomerge"
import { applySlateOperations } from "./utils/slateOpsToAutomerge"
import { convertAutomergeToSlateOps } from "./utils/convertAutomergeToSlateOps"
import slateDiff from 'slate-diff'
import Automerge from 'automerge'
import { Client } from "./client"

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

let doc = Automerge.init();
const initialSlateValue = Value.fromJSON(initialValue);
console.log(customToJSON(initialSlateValue.document))
doc = Automerge.change(doc, 'Initialize Slate state', doc => {
  doc.note = customToJSON(initialSlateValue.document);
})
const savedAutomergeDoc = Automerge.save(doc);

class App extends React.Component {

    constructor(props) {
      super(props)

      this.broadcast = this.broadcast.bind(this);

      this.state = {
        online: true,
      }

      // this.reflectDiff = this.reflectDiff.bind(this)
      // this.reflectDiff2 = this.reflectDiff2.bind(this)
    }

    // FIXME: Unexpected behavior for the following scenarios:
    //   Merge nodes and immediately insert text
    //     Expected: Proper merge and text insert
    //     Actual: Inserted text overwrites some chars in merged node
    //     Probably because merge node is equal to delete entire nodes
    //     and re-insert with new text

    // reflectDiff = () => {
    //   let changesTotal1 = [];
    //   this.state.doc1OfflineHistory.forEach((changes) => {
    //     changesTotal1 = changesTotal1.concat(changes)
    //   })

    //   this.applyDiffToDoc2(changesTotal1);

    //   let changesTotal2 = [];
    //   this.state.doc2OfflineHistory.forEach((changes) => {
    //     changesTotal2 = changesTotal2.concat(changes)
    //   })

    //   this.applyDiffToDoc1(changesTotal2);

    //   this.setState({
    //     doc1OfflineHistory: Immutable.List(),
    //     doc2OfflineHistory: Immutable.List(),
    //   })
    // }

    // reflectDiff2 = () => {
    //   const doc1new = Automerge.merge(doc1, doc2)
    //   const doc2new = Automerge.merge(doc2, doc1new)

    //   const changes1 = Automerge.getChanges(doc1, doc1new)
    //   const changes2 = Automerge.getChanges(doc2, doc2new)

    //   this.applyDiffToDoc1(changes1)
    //   this.applyDiffToDoc2(changes2)
    // }

    /////////////////////////////
    offlineSync = () => {
        const doc1 = this.client1.getAutomergeDoc();
        const doc2 = this.client2.getAutomergeDoc();

        const doc1new = Automerge.merge(doc1, doc2)
        const docNew = Automerge.merge(doc2, doc1new)

        this.client1.updateWithNewAutomergeDoc(docNew);
        this.client2.updateWithNewAutomergeDoc(docNew);
    }

    broadcast = (clientNumber, changes) => {
      if (clientNumber == 1) {
        this.client2.updateWithRemoteChanges(changes);
      } else if (clientNumber == 2) {
        this.client1.updateWithRemoteChanges(changes);
      }
    }

    toggleOnline = () => {
      this.setState({online: !this.state.online});
    }

    render = () => {
        let onlineText;
        let toggleButtonText;
        if (this.state.online) {
          onlineText = "CURRENTLY LIVE SYNCING"
          toggleButtonText = "Toggle offline mode"
        } else {
          onlineText = "CURRENTLY OFFLINE"
          toggleButtonText = "Toggle online mode"
        }

        return (
          <div>
            <div>{onlineText}</div>
            <hr></hr>
            <Client
                clientNumber={1}
                ref={(client) => {this.client1 = client}}
                savedAutomergeDoc={savedAutomergeDoc}
                initialSlateValue={initialSlateValue}
                broadcast={this.broadcast}
                online={this.state.online}
            />
            <hr></hr>
            <Client
                clientNumber={2}
                ref={(client) => {this.client2 = client}}
                savedAutomergeDoc={savedAutomergeDoc}
                initialSlateValue={initialSlateValue}
                broadcast={this.broadcast}
                online={this.state.online}
            />
            <hr></hr>
            <button onClick={this.toggleOnline}>{toggleButtonText}</button>
            {!this.state.online &&
              <button onClick={this.offlineSync}>Sync off-line mode</button>
            }
          </div>
        )
    }

}

export default App
