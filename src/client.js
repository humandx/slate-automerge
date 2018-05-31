import React from 'react'
import Immutable from "immutable";
import { Editor } from 'slate-react'
import { Value, Block } from 'slate'
import diff from './intelie_diff/diff'
import customToJSON from "./utils/customToJson"
import { applyImmutableDiffOperations } from "./utils/immutableDiffToAutomerge"
import { applySlateOperations } from "./utils/slateOpsToAutomerge"
import { convertAutomergeToSlateOps } from "./utils/convertAutomergeToSlateOps"
import { deepTraverse } from "./utils/deepTraverse"
import slateDiff from 'slate-diff'
import Automerge from 'automerge'


export class Client extends React.Component {

    constructor(props) {
      super(props)

      // this.reflectDiff = this.reflectDiff.bind(this)
      // this.reflectDiff2 = this.reflectDiff2.bind(this)

      this.onChange = this.onChange.bind(this)
      this.doc = Automerge.load(this.props.savedAutomergeDoc)
      this.buildObjectIdMap = this.buildObjectIdMap.bind(this)

      // const initialValue = automergeJsontoSlate({
      //   "document": {...this.doc.note}
      // })
      // const initialSlateValue = Value.fromJSON(initialValue);

      // Should build the Slate value from this.doc

      this.state = {
        value: this.props.initialSlateValue,
        // value: initialSlateValue,
        pathMap: {},
        online: true,
        docOfflineHistory: Immutable.List(),
      }
    }

    componentDidMount = () => {

      this.buildObjectIdMap()
    }

    getStoredLocalChanges = () => {
      // How can I use this?
      console.log(`Sending: ${this.state.docOfflineHistory}`)
      setTimeout(() => {
        this.setState({docOfflineHistory: Immutable.List()})
      })
      return this.state.docOfflineHistory;
    }

    getAutomergeDoc = () => {
      return this.doc;
    }

    updateWithBatchedRemoteChanges = ( changesList ) => {
      // Update the Automerge document
      let docNew = this.doc;
      changesList.forEach((changes) => {
        docNew = Automerge.applyChanges(docNew, changes)
      })
      const opSetDiff = Automerge.diff(this.doc, docNew)
      this.doc = docNew;

      this.updateWithAutomergeOperations(opSetDiff);
    }

    updateWithNewAutomergeDoc = ( automergeDoc ) => {
      const changes = Automerge.getChanges(this.doc, automergeDoc)
      this.updateWithRemoteChanges(changes)
    }

    updateWithRemoteChanges = ( changes ) => {
      // Update the Automerge document
      const docNew = Automerge.applyChanges(this.doc, changes)
      const opSetDiff = Automerge.diff(this.doc, docNew)
      this.doc = docNew;
      this.updateWithAutomergeOperations(opSetDiff);
    }

    updateWithAutomergeOperations = (opSetDiff) => {
      // Convert the changes from the Automerge document to Slate operations
      const slateOps = convertAutomergeToSlateOps(opSetDiff, this.state.pathMap, this.state.value)
      console.log('slateOps: ', slateOps)
      const change = this.state.value.change()
      change.applyOperations(slateOps)
      this.setState({ value: change.value })

      // Paths may have changed after applying operations - update objectId map
      // TODO: only change those values that changed
      this.buildObjectIdMap()
    }

    onChange = ({ operations, value }) => {

      var differences = diff(this.state.value.document, value.document);

      this.setState({ value: value })

      if (differences.size > 0) {

        // Using the difference obtained from the Immutable diff library,
        // apply the operations to the Automerge document.
        const docNew = Automerge.change(this.doc, `Client ${this.props.clientNumber}`, doc => {
          applyImmutableDiffOperations(doc, differences)
          // applySlateOperations(doc, operations)
        })

        // Get Automerge changes
        const changes = Automerge.getChanges(this.doc, docNew)

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

    buildObjectIdMap = () => {
      const history = Automerge.getHistory(this.doc)
      const snapshot = history[history.length - 1].snapshot.note

      this.setState({pathMap: deepTraverse(snapshot, null, {}) })
    }

    render = () => {
        return (
            <Editor
                key={this.props.clientNumber}
                ref={(e) => {this.editor = e}}
                value={this.state.value}
                onChange={this.onChange}
            />
        )
    }
}
