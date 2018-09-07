import { Client } from "./client"
import React from "react"
import "./App.css";

const maxClients = 6;
const docId = 0;


class App extends React.Component {

    constructor(props) {
        super(props)

        this.clients = [];

        this.state = {
            numClients: 1,
            debuggingMode: false,
        }
    }

    /**************************************
     * Add/remove clients  *
     **************************************/
    /**
     * @function updateNumClientsOnChangeHandler
     * @desc Update the number of clients
     * @param {Event} event - A Javascript Event
     */
    updateNumClientsOnChangeHandler = (event) => {
        this.updateNumClients(event.target.value)
    }

    /**
     * @function updateNumClients
     * @desc Update the number of clients
     * @param {number} numClients - The number of clients
     */
    updateNumClients = (numClients) => {
        const updateNewClients = () => {
            this.clients = this.clients.slice(0, numClients);
        }

        if (numClients < 0 || numClients > maxClients) {
            return;
        } else {
            this.setState({ numClients: numClients }, updateNewClients);
        }
    }

    /**************************************
     * Handle online/offline connections  *
     **************************************/
    /**
     * @function toggleConnection
     * @desc Turn all clients on/off
     */
    toggleConnection = (isOnline) => {
        this.setState({ online: isOnline });
        this.clients.forEach((client, idx) => {
            client.toggleConnection(isOnline);
        })
    }

    /**
     * @function toggleDebugging
     * @desc Toggle debugging tools
     */
    toggleDebugging = () => {
        this.setState({ debuggingMode: !this.state.debuggingMode })
    }

    /********************
     * Render functions *
     ********************/
    render = () => {
        let clientComponents = [];

        for (let i = 0; i < this.state.numClients; i++) {
            clientComponents.push(
                <div className="client" key={`client-div-${i}`}>
                    <Client
                        clientId={i}
                        debuggingMode={this.state.debuggingMode}
                        initialDocId={docId}
                        key={`client-${i}`}
                        ref={(client) => { this.clients[i] = client }}
                    />
                </div>
            );
        }

        return (
            <div>
                <hr></hr>
                <div>SOCKET</div>
                <div>Currently, only clients with odd ids can view documents with odd ids</div>
                <div>and only clients with even ids can view documents with even ids.</div>
                <div className="options">
                    <div className="options-text">Options:</div>
                    <div className="options-online">
                        <button
                            className="online-button"
                            onClick={() => { this.toggleConnection(true) }}
                        >
                            All online
                        </button>
                        <button
                            className="online-button"
                            onClick={() => { this.toggleConnection(false) }}
                        >
                            All offline
                        </button>
                    </div>
                    <div>
                        <span>Number of clients: </span>
                        <input
                            type="number"
                            className="numclient-input"
                            onChange={this.updateNumClientsOnChangeHandler}
                            value={this.state.numClients}
                            min={1}
                            max={maxClients}
                        />
                        <button
                            className="online-button"
                            onClick={() => { this.updateNumClients(this.state.numClients + 1) }}
                        >
                            Add client
                        </button>
                        <button
                            className="online-button"
                            onClick={() => { this.updateNumClients(this.state.numClients - 1) }}
                        >
                            Remove client
                        </button>
                    </div>
                    <div>
                        <button className="online-button" onClick={this.toggleDebugging}>Toggle debugging</button>
                    </div>
                </div>
                <hr></hr>
                {clientComponents}
            </div>
        )
    }

}

export default App
