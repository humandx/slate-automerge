import React from 'react'
import Immutable from "immutable";
import { Value } from 'slate'
import slateCustomToJson from "./utils/slateCustomToJson"
import Automerge from 'automerge'
import { Client } from "./client"
import { initialValue } from "./utils/initialAutomergeDoc"


let doc = Automerge.init();
const initialSlateValue = Value.fromJSON(initialValue);
doc = Automerge.change(doc, 'Initialize Slate state', doc => {
  doc.note = slateCustomToJson(initialSlateValue.document);
})
const savedAutomergeDoc = Automerge.save(doc);
const maxClients = 6;

class App extends React.Component {

    constructor(props) {
      super(props)

      this.broadcast = this.broadcast.bind(this);
      this.client = [];

      this.state = {
        online: true,
        numClients: 2,
      }
    }

    /**
     * NOT USED
     */
    offlineSyncUsingMerge = () => {
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

    // Sync all clients.
    offlineSync = () => {
      // Get all stored changes from all clients.
      let changesList = [];
      this.client.forEach((client, idx) => {
        changesList[idx] = client.getStoredLocalChanges();
      });

      // Send all relevant changes to all clients.
      this.client.forEach((client, clientIdx) => {
        let allChanges = Immutable.List();
        changesList.forEach((changes, changeIdx) => {
          if (clientIdx !== changeIdx) {
            allChanges = allChanges.concat(changes);
          }
        });
        client.updateWithBatchedRemoteChanges(allChanges);
      });
    }

    // Broadcast a change from one client to all others.
    broadcast = (clientNumber, changes) => {
      this.client.forEach((client, idx) => {
        if (clientNumber !== idx) {
          setTimeout(() => {
            client.updateWithRemoteChanges(changes);
          })
        }
      })
    }

    // Toggle if we should sync the clients online or offline.
    toggleOnline = () => {
      // If going online from offline, make sure all clients are synced.
      if (!this.state.online) {
        this.offlineSync();
      }
      this.setState({online: !this.state.online});
    }

    // Change the number of clients
    updateNumClients = (event) => {
      const numClients = event.target.value;

      const numCurrentClients = this.state.numClients;
      const hasNewClients = numClients > this.state.numClients;
      const updateNewClients = () => {
        if (hasNewClients) {
          const doc = this.client[0].getAutomergeDoc();
          for (let i = numCurrentClients; i < numClients; i++) {
            this.client[i].updateWithNewAutomergeDoc(doc);
          }
        } else {
          this.client = this.client.slice(0, numClients);
        }
      }

      if (numClients <= 0 || numClients > maxClients) {
        return;
      } else {
        this.setState({numClients: numClients}, updateNewClients);
      }
    }

    render = () => {
        let onlineText;
        let onlineTextClass;
        let toggleButtonText;
        if (this.state.online) {
          onlineText = "CURRENTLY LIVE SYNCING"
          onlineTextClass = "online-text green"
          toggleButtonText = "GO OFFLINE"
        } else {
          onlineText = "CURRENTLY OFFLINE"
          onlineTextClass = "online-text red"
          toggleButtonText = "GO ONLINE"
        }

        let clientComponents = [];
        for (let i = 0; i < this.state.numClients; i++) {
          clientComponents.push(
            <div className="client" key={`client-div-${i}`}>
              <Client
                  key={`client-${i}`}
                  clientNumber={i}
                  ref={(client) => {this.client[i] = client}}
                  savedAutomergeDoc={savedAutomergeDoc}
                  broadcast={this.broadcast}
                  online={this.state.online}
              />
            </div>
          );
        }

        return (
          <div>
            <div className={onlineTextClass}>{onlineText}</div>
            <hr></hr>
            {clientComponents}
            <hr></hr>
            <div className="options">
              <div className="options-text">Options:</div>
              <button className="online-button" onClick={this.toggleOnline}>{toggleButtonText}</button>
              {!this.state.online &&
                  <button className="online-button" onClick={this.offlineSync}>Sync</button>
              }
              <div>
                <span>Number of clients: </span>
                <input
                  type="number"
                  className="numclient-input"
                  onChange={this.updateNumClients}
                  value={this.state.numClients}
                  min={1}
                  max={maxClients}
                />
              </div>
            </div>
          </div>
        )
    }

}

export default App
