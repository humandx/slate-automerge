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
  // const savedAutomergeDoc = Automerge.save(doc);
  docSet.setDoc(docId, doc);
}

let connections = {};
let docSet = new Automerge.DocSet();
createNewDocument(1)

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket) {

  socket.on('chat message', function(msg) {
    console.log('message: ' + msg);
    io.emit('chat message', msg);
  });

  socket.on('connect', function(data) {
    console.log('user connects socket');
  });

  socket.on('join_document', function({clientId, docId}) {
    docId  = Number(docId)
    if (!docSet.getDoc(docId)) {
      createNewDocument(docId)
    }

    if (!connections[clientId]) {
      connections[clientId] = new Automerge.Connection(
          docSet,
          (message) => {
              socket.emit("send_operation", message)
              // TO FIX: Not sure why .to doesn't work as expected
              // socket.to(docId).emit("send_operation", message)
          }
      )
      connections[clientId].open()
    }

    socket.join(docId)
  });

  socket.on("send_operation", function(data) {
    let {clientId, docId, msg} = data
    docId = Number(docId)
    connections[clientId].receiveMsg(msg)
  })

  socket.on('leave_document', function({clientId, docId}) {
    docId = Number(docId)
    socket.leave(docId)
  });

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
