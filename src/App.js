import React from 'react'
import Immutable from "immutable";
import { Value } from 'slate'
import slateCustomToJson from "./utils/slateCustomToJson"
import Automerge from 'automerge'
import { Client } from "./client"
import { initialValue } from "./utils/initialAutomergeDoc"


const docId = 1;
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
        numClients: 1,
      }
    }

    // Broadcast a change from one client to all others.
    broadcast = (clientNumber, message) => {
      this.client.forEach((client, idx) => {
        if (clientNumber !== idx) {
          setTimeout(() => {
            console.log(`Broadcasting from ${clientNumber} to ${idx}`)
            client.updateWithRemoteChanges(message);
          })
        }
      })
    }

    // Toggle if we should sync the clients online or offline.
    toggleOnline = () => {
      this.setState({online: !this.state.online});
    }

    // Change the number of clients
    updateNumClients = (event) => {
      const numClients = event.target.value;

      const numCurrentClients = this.state.numClients;
      const hasNewClients = numClients > this.state.numClients;
      const updateNewClients = () => {
        if (hasNewClients) {
          // pass
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
        let onlineText = this.state.online ? "CURRENTLY LIVE SYNCING" : "CURRENTLY OFFLINE";
        let onlineTextClass = this.state.online ? "online-text green" : "online-text red";
        let toggleButtonText = this.state.online ? "GO OFFLINE" : "GO ONLINE";
        let clientComponents = [];

        for (let i = 0; i < this.state.numClients; i++) {
          clientComponents.push(
            <div className="client" key={`client-div-${i}`}>
              <Client
                  key={`client-${i}`}
                  clientNumber={i}
                  docId={docId}
                  ref={(client) => {this.client[i] = client}}
                  savedAutomergeDoc={i == 0 ? savedAutomergeDoc : null}
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
              {/*<button className="online-button" onClick={this.toggleOnline}>{toggleButtonText}</button>*/}
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
