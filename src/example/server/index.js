'use strict';

const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http)
const Automerge = require("automerge")
const initialValue = require("../../utils/initialSlateValue").initialValue
const Slate = require("slate")
const SlateAutomergeBridge = require("../../../dist/slateAutomergeBridge")

const { slateCustomToJson } = SlateAutomergeBridge
const Value = Slate.Value

const createNewDocument = function(docId) {
  let doc = Automerge.init(`server-1234`);
  const initialSlateValue = Value.fromJSON(initialValue);
  doc = Automerge.change(doc, "Initialize Slate state", doc => {
      doc.note = slateCustomToJson(initialSlateValue.document);
  })
  docSet.setDoc(docId, doc);
}

let connections = {};
let docSet = new Automerge.DocSet();
createNewDocument(1)

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});


/**
 * @function hasPermission
 * @desc Check to see if the client has permission to view a document.
 *    Current check just makes sure clients with odd ids can only read
 *    documents with odd ids.
 * @param {number} clientId - The ID of the client requesting permission.
 * @param {number} docId - The ID of the document to join.
 */
const hasPermission = (clientId, docId) => {
    const clientNum = Number(clientId.substr(7, clientId.indexOf("-")-7))
    docId  = Number(docId)
    if (clientNum % 2 == docId % 2) {
      return true
    }
    return false
}

io.on('connection', function(socket) {

  socket.on('chat message', function(msg) {
    console.log('message: ' + msg);
    io.emit('chat message', msg);
  });

  socket.on('connect', function(data) {
    console.log('user connects socket');
  });

  /**
   * @desc Have the client given by clientId join the document given by docId.
   */
  socket.on('join_document', function({clientId, docId}, callback) {
    // Permissions check
    if (!hasPermission(clientId, docId)) { return }

    docId  = Number(docId)
    if (!docSet.getDoc(docId)) {
      createNewDocument(docId)
    }

    if (!connections[clientId]) {
      connections[clientId] = new Automerge.Connection(
          docSet,
          (message) => {
              if (!hasPermission(clientId, message.docId)) { return }
              socket.emit("send_operation", message)
          }
      )
      connections[clientId].open()
    }

    socket.join(docId)
    callback(true)
  });

  /**
   * @desc Process the Automerge operation from a client.
   */
  socket.on("send_operation", function(data) {
    let {clientId, docId, msg} = data
    docId = Number(docId)
    connections[clientId].receiveMsg(msg)
  })

  /**
   * @desc Client leaves a document.
   */
  socket.on('leave_document', function({clientId, docId}) {
    docId = Number(docId)
    socket.leave(docId)
  });

  /**
   * @desc Client disconnects from the server.
   */
  socket.on('will_disconnect', function({clientId}) {
    connections[clientId].close()
    delete connections[clientId]
  });

  socket.on('disconnect', function() {
    socket.disconnect(true)
  });

});


http.listen(5000, function() {
  console.log('listening on *:5000');
});
