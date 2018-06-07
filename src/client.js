/**
 * The Slate client.
 */

import React from 'react'
import Immutable from "immutable";
import { Editor } from 'slate-react'
import { Value } from 'slate'
import diff from './intelie_diff/diff'
import { applyImmutableDiffOperations } from "./utils/immutableDiffToAutomerge"
import { applySlateOperations } from "./utils/slateOpsToAutomerge"
import { convertAutomergeToSlateOps } from "./utils/convertAutomergeToSlateOps"
import { mapObjectIdToPath } from "./utils/mapObjectId"
import Automerge from 'automerge'


export class Client extends React.Component {

    constructor(props) {
      super(props)

      this.onChange = this.onChange.bind(this)
      this.doc = Automerge.load(this.props.savedAutomergeDoc)
      this.buildObjectIdMap = this.buildObjectIdMap.bind(this)
      this.pathMap = null;

      // const initialValue = automergeJsontoSlate({
      //   "document": {...this.doc.note}
      // })
      // const initialSlateValue = Value.fromJSON(initialValue);

      // Should build the Slate value from this.doc

      this.state = {
        value: this.props.initialSlateValue,
        // value: initialSlateValue,
        online: true,
        docOfflineHistory: Immutable.List(),
      }
    }

    componentDidMount = () => {
      this.buildObjectIdMap()
    }

    // Return the list of stored local changes, then clear the changes
    getStoredLocalChanges = () => {
      setTimeout(() => {
        this.setState({docOfflineHistory: Immutable.List()})
      })
      return this.state.docOfflineHistory;
    }

    // Return the Automerge document
    getAutomergeDoc = () => {
      return this.doc;
    }

    // Update the client with a list of changes
    updateWithBatchedRemoteChanges = ( changesList ) => {
      // Update the Automerge document
      let docNew = this.doc;
      let newValue = this.state.value;
      changesList.forEach((changes) => {
        const docNew = Automerge.applyChanges(this.doc, changes)
        const opSetDiff = Automerge.diff(this.doc, docNew)
        this.doc = docNew;
        newValue = this.updateWithAutomergeOperations(newValue, opSetDiff);
      })
      this.setState({ value: newValue })
    }

    // Update the client with an Automerge document
    // * NOT USED *
    updateWithNewAutomergeDoc = ( automergeDoc ) => {
      const changes = Automerge.getChanges(this.doc, automergeDoc)
      this.updateWithRemoteChanges(changes)
    }

    // Update the Automerge document with changes from another client
    updateWithRemoteChanges = ( changes ) => {
      // Update the Automerge document
      const docNew = Automerge.applyChanges(this.doc, changes)
      const opSetDiff = Automerge.diff(this.doc, docNew)
      this.doc = docNew;
      const newValue = this.updateWithAutomergeOperations(this.state.value, opSetDiff);
      this.setState({ value: newValue })
    }

    // Update the client with a list of Automerge operations
    updateWithAutomergeOperations = (currentValue, opSetDiff) => {
      // Get the map between objectId and paths
      let prevPathMap = this.pathMap;
      this.buildObjectIdMap();

      // Convert the changes from the Automerge document to Slate operations
      const slateOps = convertAutomergeToSlateOps(opSetDiff, this.pathMap, prevPathMap, currentValue)
      console.log(`${this.props.clientNumber} slateOps`)
      console.log(slateOps)
      const change = currentValue.change()

      // Apply the operation
      change.applyOperations(slateOps)
      return change.value
    }

    onChange = ({ operations, value }) => {

      var differences = diff(this.state.value.document, value.document);

      this.setState({ value: value })

      if (differences.size > 0) {
        console.log("Automerge Doc: ", this.doc)
        // Using the difference obtained from the Immutable diff library,
        // apply the operations to the Automerge document.
        const docNew = Automerge.change(this.doc, `Client ${this.props.clientNumber}`, doc => {
          // applyImmutableDiffOperations(doc, differences)
          applySlateOperations(doc, operations)
        })

        console.log("Slate ops: ", operations)
        // Get Automerge changes
        const changes = Automerge.getChanges(this.doc, docNew)
        console.log("Automerge DocNew: ", docNew)

        // Update doc
        this.doc = docNew
        if (this.props.online) {
          this.props.broadcast(this.props.clientNumber, changes);
        } else {
          this.setState({
            docOfflineHistory: this.state.docOfflineHistory.push(changes)
          })
        }
      }
    }

    // Build the map of Automerge objectId to paths
    buildObjectIdMap = () => {
      const history = Automerge.getHistory(this.doc)
      const snapshot = history[history.length - 1].snapshot.note
      this.pathMap = mapObjectIdToPath(snapshot, null, {})
      return this.pathMap;
    }

    render = () => {
        return (
            <div>
              <span><u>Client: {this.props.clientNumber}</u></span>
              <Editor
                  key={this.props.clientNumber}
                  ref={(e) => {this.editor = e}}
                  value={this.state.value}
                  onChange={this.onChange}
              />
            </div>
        )
    }
}
