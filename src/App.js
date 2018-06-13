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
      this.clients = [];
      this.docSet = new Automerge.DocSet();
      this.docSet.setDoc(docId, doc);
      this.connections = [];

      this.state = {
        online: true,
        numClients: 1,
      }
    }

    // Broadcast a change from one client to all others.
    broadcast = (clientNumber, message) => {
      if (this.connections.length <= clientNumber) {
        let connection = new Automerge.Connection(
          this.docSet,
          (message) => {
            // TODO: This is a quick hack since the line right below doesn't work.
            // this.clients[clientNumber].updateWithRemoteChanges(message);
            this.clients.forEach((client, idx) => {
              if (clientNumber == idx) {
                client.updateWithRemoteChanges(message);
              }
            })
          }
        )
        connection.open()
        this.connections.push(connection)
      }

      // Need the setTimeout to give time for each client to update it's own
      // Slate Value via setState
      setTimeout(() => {
        console.log(`Server received message from Client ${clientNumber}`)
        this.connections[clientNumber].receiveMsg(message)
      })
    }

    // Toggle if we should sync the clients online or offline.
    toggleOnline = () => {
      this.setState({online: !this.state.online});
      this.clients.forEach((client, idx) => {
        client.toggleOnlineHelper(!this.state.online);
      })
    }

    // Change the number of clients
    updateNumClients = (event) => {
      this.updateNumClientsHelper(event.target.value)
    }

    addClient = (event) => {
      this.updateNumClientsHelper(this.state.numClients + 1)
    }

    removeClient = (event) => {
      this.updateNumClientsHelper(this.state.numClients - 1)
    }

    updateNumClientsHelper = (numClients) => {
      const numCurrentClients = this.state.numClients;
      const hasNewClients = numClients > this.state.numClients;

      const updateNewClients = () => {
        this.clients = this.clients.slice(0, numClients);
        this.connections = this.connections.slice(0, numClients);
      }

      if (numClients < 0 || numClients > maxClients) {
        return;
      } else {
        this.setState({numClients: numClients}, updateNewClients);
      }

    }

    // Alert server when client goes online/offline
    connectionHandler = (clientId, isOnline) => {
      if (isOnline) {
        this.connections[clientId].open();
      } else {
        this.connections[clientId].close();
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
                  ref={(client) => {this.clients[i] = client}}
                  broadcast={this.broadcast}
                  online={this.state.online}
                  connectionHandler={this.connectionHandler}
              />
            </div>
          );
        }

        return (
          <div>
            <hr></hr>
            {clientComponents}
            <hr></hr>
            <div className="options">
              <div className="options-text">Options:</div>
              {<button className="online-button" onClick={this.toggleOnline}>{toggleButtonText}</button>}
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
                <button className="online-button" onClick={this.addClient}>Add client</button>
                <button className="online-button" onClick={this.removeClient}>Remove client</button>
              </div>
            </div>
          </div>
        )
    }

}

export default App
