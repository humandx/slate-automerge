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

const initialValue = {
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
                text: '111111'
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
                text: '222222'
              }
            ]
          }
        ]
      },
    ]
  }
};

let doc = Automerge.init();
const initialSlateValue = Value.fromJSON(initialValue);
const initialSlateValue2 = Value.fromJSON(initialValue);
console.log(customToJSON(initialSlateValue.document))
doc = Automerge.change(doc, 'Initialize Slate state', doc => {
  doc.note = customToJSON(initialSlateValue.document);
})
const savedAutomergeDoc = Automerge.save(doc);

class App extends React.Component {

    constructor(props) {
      super(props)

      this.broadcast = this.broadcast.bind(this);
      this.client = [];

      this.state = {
        online: false,
      }
    }

    offlineSync = () => {
      let docs = [];
      this.client.forEach((client, idx) => {
        docs[idx] = client.getAutomergeDoc();
      });

      let mergedDoc = docs[0];
      docs.forEach((nextDoc, idx) => {
        if (idx === 0) return;
        mergedDoc = Automerge.merge(mergedDoc, nextDoc);
      });

      this.client.forEach((client, idx) => {
        client.updateWithNewAutomergeDoc(mergedDoc);
      });
    }

    offlineSync2 = () => {
      let changesList = [];
      this.client.forEach((client, idx) => {
        changesList[idx] = client.getStoredLocalChanges();
      });

      this.client.forEach((client, clientIdx) => {
        changesList.forEach((changes, changeIdx) => {
          if (clientIdx !== changeIdx) {
            client.updateWithBatchedRemoteChanges(changes);
          }
        });
      });
    }

    broadcast = (clientNumber, changes) => {
      this.client.forEach((client, idx) => {
        if (clientNumber !== idx) {
          client.updateWithRemoteChanges(changes);
        }
      })
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
                key={0}
                clientNumber={0}
                ref={(client) => {this.client[0] = client}}
                savedAutomergeDoc={savedAutomergeDoc}
                initialSlateValue={initialSlateValue}
                broadcast={this.broadcast}
                online={this.state.online}
            />
            <hr></hr>
            <Client
                key={1}
                clientNumber={1}
                ref={(client) => {this.client[1] = client}}
                savedAutomergeDoc={savedAutomergeDoc}
                initialSlateValue={initialSlateValue2}
                broadcast={this.broadcast}
                online={this.state.online}
            />
            <hr></hr>
            <button onClick={this.toggleOnline}>{toggleButtonText}</button>
            {!this.state.online &&
              <div>
                <button onClick={this.offlineSync}>Sync off-line mode v1</button>
                <button onClick={this.offlineSync2}>Sync off-line mode v2</button>
              </div>
            }
          </div>
        )
    }

}

export default App
