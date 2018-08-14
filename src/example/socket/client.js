/**
 * The Slate client.
 */

import { applyAutomergeOperations, applySlateOperations, automergeJsonToSlate, slateCustomToJson} from "../../libs/slateAutomergeBridge"
import { Editor } from "slate-react"
import { Value } from "slate"
import Automerge from "automerge"
import EditList from "slate-edit-list"
import Immutable from "immutable";
import io from 'socket.io-client';
import React from "react"
import uuid from 'uuid'
import "./client.css";

const initialValue = require("../../utils/initialSlateValue").initialValue
const plugin = EditList();
const plugins = [plugin];

function renderNode(props) {
    const { node, attributes, children, editor } = props;
    const isCurrentItem = plugin.utils
        .getItemsAtRange(editor.value)
        .contains(node);

    switch (node.type) {
        case "ul_list":
            return <ul {...attributes}>{children}</ul>;
        case "ol_list":
            return <ol {...attributes}>{children}</ol>;

        case "list_item":
            return (
                <li
                    className={isCurrentItem ? "current-item" : ""}
                    title={isCurrentItem ? "Current Item" : ""}
                    {...props.attributes}
                >
                    {props.children}
                </li>
            );

        case "paragraph":
            return <div {...attributes}>{children}</div>;
        case "heading":
            return <h1 {...attributes}>{children}</h1>;
        default:
            return <div {...attributes}>{children}</div>;
    }
}


export class Client extends React.Component {

    constructor(props) {
        super(props)

        this.clientId = `client:${this.props.clientId}-${uuid()}`
        this.docSet = new Automerge.DocSet()
        this.onChange = this.onChange.bind(this)
        this.socket = null

        this.connection = new Automerge.Connection(
            this.docSet,
            (msg) => {
                this.sendMessage(msg)
            }
        )

        this.state = {
            value: null,
            online: true,
            docId: this.props.initialDocId,
        }
    }

    componentDidMount = () => {
        this.connect()
        this.joinDocument(this.state.docId)
        this.getAndSetDoc(this.state.docId)
    }

    componentWillUnmount = () => {
        this.disconnect()
    }

    createNewDocument = (docId) => {
        let doc = Automerge.init(this.clientId)
        const initialSlateValue = Value.fromJSON(initialValue)
        doc = Automerge.change(doc, "Initialize Slate state", doc => {
          doc.note = slateCustomToJson(initialSlateValue.document)
        })
        this.docSet.setDoc(docId, doc)
        const newValue = automergeJsonToSlate({"document": {...doc.note}})
        const value = Value.fromJSON(newValue)
        return {doc, value}
    }

    getAndSetDoc = (docId) => {
        if (!docId) { docId = this.state.docId }
        const doc = this.docSet.getDoc(docId)

        if (!doc) {
            this.sendMessage({
                clock: null,
                docId: docId,
            }, docId)
            this.setState({
                docId: docId,
            })
        } else {

            const clock = doc._state.getIn(["opSet", "clock"]);

            this.sendMessage({
                clock: clock,
                docId: docId,
            }, docId)

            if (docId !== this.state.docId) {
                const newValue = automergeJsonToSlate({"document": {...doc.note}})
                const value = Value.fromJSON(newValue)
                this.setState({
                    value: value,
                    docId: docId,
                })
            }
        }
    }

    /**************************************
     * UPDATE CLIENT FROM LOCAL OPERATION *
     **************************************/
    onChange = ({ operations, value }) => {
        this.setState({ value: value })
        applySlateOperations(this.docSet, this.state.docId, operations, this.clientId)
    }

    /**************************************
     * SOCKET OPERATIONS                  *
     **************************************/
    connect = () => {
        if (!this.socket) {
            this.clientId = `client:${this.props.clientId}-${uuid()}`
            this.socket = io("http://localhost:5000", {query: {clientId: this.clientId}})
        }

        if (!this.socket.hasListeners("send_operation")) {
            this.socket.on("send_operation", this.updateWithRemoteChanges.bind(this))            
        }
        
        this.connection.open()
        this.socket.emit("connect", {clientId: this.clientId})
    }

    reconnect = () => {
        if (!this.socket) {
            this.clientId = `client:${this.props.clientId}-${uuid()}`
            this.socket = io("http://localhost:5000", {query: {clientId: this.clientId}})
        }

        if (!this.socket.hasListeners("send_operation")) {
            this.socket.on("send_operation", this.updateWithRemoteChanges.bind(this))            
        }
        
        this.joinDocument(this.state.docId)
        this.connection.open()
        this.socket.emit("connect", {clientId: this.clientId})
        this.getAndSetDoc(this.state.docId)
    }

    joinDocument = (docId) => {
        if (!docId) { docId = this.state.docId }
        if (this.socket) {
            const data = { clientId: this.clientId, docId: docId }
            this.socket.emit("join_document", data)
        }
    }

    leaveDocument = (docId) => {
        if (!docId) { docId = this.state.docId }
        if (this.socket) {
            const data = { clientId: this.clientId, docId: docId }
            this.socket.emit("leave_document", data)
        }
    }

    disconnect = () => {
        if (this.socket) {
            this.connection.close()
            this.leaveDocument()
            this.socket.emit("will_disconnect", {clientId: this.clientId})
            this.socket.removeListener("send_operation")
            // this.socket.close()
            // this.socket = null
        }
    }

    sendMessage = (msg, docId) => {
        if (!docId) { docId = this.state.docId }
        const data = { clientId: this.clientId, docId: docId, msg }
        if (this.socket) {
            this.socket.emit("send_operation", data)
        }
    }

    /***************************************
     * UPDATE CLIENT FROM REMOTE OPERATION *
     ***************************************/
    /**
     * @function updateWithRemoteChanges
     * @desc Update the Automerge document with changes from another client
     * @param {Object} msg - A message created by Automerge.Connection
     */
    updateWithRemoteChanges = (msg) => {
        console.debug(`Client ${this.clientId} received message:`)
        console.debug(msg)
        const currentDoc = this.docSet.getDoc(msg.docId)
        const docNew = this.connection.receiveMsg(msg)

        if (msg.docId !== this.state.docId) return
        if (!currentDoc && docNew) {
            const newValue = automergeJsonToSlate({"document": {...docNew.note}})
            const value = Value.fromJSON(newValue)
            this.setState({ value: value })
            return
        }
        if (!currentDoc && !docNew) return

        const opSetDiff = Automerge.diff(currentDoc, docNew)
        if (opSetDiff.length !== 0) {
            let change = this.state.value.change()
            change = applyAutomergeOperations(opSetDiff, change, () => { this.updateSlateFromAutomerge() });
            if (change) {
                this.setState({ value: change.value })
            }
        }
    }

    /**********************************************
     * Fail-safe for Automerge->Slate conversion  *
     **********************************************/
    /**
     * @function updateSlateFromAutomerge
     * @desc Directly update the Slate Value from Automerge, ignoring Slate
     *     operations. This is not preferred when syncing documents since it
     *     causes a re-render and loss of cursor position (and on mobile,
     *     a re-render drops the keyboard).
     */
    updateSlateFromAutomerge = () => {
        const doc = this.docSet.getDoc(this.state.docId)
        const newJson = automergeJsonToSlate({
            "document": { ...doc.note }
        })
        this.setState({ value: Value.fromJSON(newJson) })
    }

    /**********************************************
     * Reload document from server.               *
     **********************************************/
    /**
     * @function refreshDocumentFromAutomerge
     * @desc
     */
    refreshDocumentFromAutomerge = (event) => {
        if (this.state.online) {
            this.toggleConnection(false)            
        }
        setTimeout(() => {this.toggleConnection(true)}, 200)
    }

    /**************************************
     * Change document                    *
     **************************************/
    changeDocId = (event) => {
        const newDocId = Number(event.target.value)
        if (newDocId) {
            this.joinDocument(newDocId)
            this.leaveDocument(this.state.docId)
            this.getAndSetDoc(newDocId)
        }
    }

    /**************************************
     * Handle online/offline connections  *
     **************************************/
    /**
     * @function toggleConnection
     * @desc Turn the client online or offline
     * @param {Event} event - A Javascript Event
     */
    toggleConnectionButton = (event) => {
        this.toggleConnection(!this.state.online);
    }

    /**
     * @function toggleConnection
     * @desc When client goes online/offline, alert the server and open/close
     *     the connection
     * @param {boolean} isOnline - If the client should be online.
     */
    toggleConnection = (isOnline) => {
        // TODO: If online, open the socket connection
        // If offline, close socket connection

        if (isOnline) {
            this.reconnect()
        } else {
            this.disconnect()
        }
        this.setState({ online: isOnline })
    }

    /********************
     * Render functions *
     ********************/
    /**
     * @function renderHeader
     * @desc Render the header for the client.
     */
    renderHeader = () => {
        const onlineText = this.state.online ? "CURRENTLY LIVE SYNCING" : "CURRENTLY OFFLINE";
        const onlineTextClass = this.state.online ? "client-online-text green" : "client-online-text red";
        const toggleButtonText = this.state.online ? "GO OFFLINE" : "GO ONLINE";

        const currentDoc = this.docSet.getDoc(this.state.docId)
        let actorId;
        try {
            actorId = currentDoc._actorId.substr(0, actorId.indexOf("-"))
        } catch (e) {
            // pass
        }

        return (
            <div>
                <table className={"client-header"}>
                    <tbody>
                        <tr><td colSpan="2" className={onlineTextClass}>{onlineText}</td></tr>
                        <tr>
                            <td>Client: {this.clientId}</td>
                            <td><button className="client-online-button" onClick={this.toggleConnectionButton}>{toggleButtonText}</button></td>
                        </tr>
                        <tr>
                            <td>{this.props.debuggingMode && <span>Actor Id: {actorId}</span>}</td>
                            <td><button className="client-online-button" onClick={this.refreshDocumentFromAutomerge}>Reload from server</button></td>
                        </tr>
                        <tr>
                            <td>
                                <span>Doc Id: {actorId}</span>
                                <input
                                    type="number"
                                    className="numclient-input"
                                    onChange={this.changeDocId}
                                    value={this.state.docId}
                                    min={1}
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
                <hr></hr>
            </div>
        )
    }

    /**
     * @function renderInternalClock
     * @desc Render the internal clock of Automerge.DocSet for debugging purposes.
     */
    renderInternalClock = () => {
        try {
            let clockList = this.docSet.getDoc(this.state.docId)._state.getIn(["opSet", "clock"]);
            let clockComponents = [];
            clockList.forEach((value, actorId) => {
                actorId = actorId.substr(0, actorId.indexOf("-"))
                clockComponents.push(
                    <tr key={`internal-clock-${actorId}`}>
                        <td className="table-cell-left">{actorId}</td>
                        <td className="table-cell-right">{value}</td>
                    </tr>
                )
            })
            return (
                <div>
                    <div>Internal clock:</div>
                    <table>
                        <thead>
                            <tr>
                                <td className="table-cell-left table-cell-header">Actor Id</td>
                                <td className="table-cell-right table-cell-header">Clock</td>
                            </tr>
                        </thead>
                        <tbody>
                            {clockComponents}
                        </tbody>
                    </table>
                </div>
            )
        } catch (err) {
            return null;
        }
    }

    render = () => {
        if (this.state.value === null) {
            return "Loading..."
        }
        return (
            <div>
                {this.renderHeader()}
                <table className="client-table"><tbody><tr>
                    <td className="client-editor">
                        <Editor
                            key={this.clientId}
                            ref={(e) => { this.editor = e }}
                            renderNode={renderNode}
                            onChange={this.onChange}
                            plugins={plugins}
                            value={this.state.value}
                        />
                    </td>
                    {this.props.debuggingMode && <td className="client-internal">
                        {this.renderInternalClock()}
                    </td>}
                </tr></tbody></table>
            </div>
        )
    }
}
