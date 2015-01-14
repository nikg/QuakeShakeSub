// Setup express 4 server
var config = require('./config');
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 9999;


var util = require('util');
var WebSocket = require('ws');

var allSocks = {};  // associative array to store connections ; tried [] array but 'splice' doesn't seem to work.
connectionIDCounter = 0;

// Start Express/Socket.IO
server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
});

// Handle incoming Socket.IO
io.on('connection', function (socket) {
/*
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
*/

  socket.id = connectionIDCounter;  // set ID to counter
  socket.IP = socket.handshake.address;
  allSocks[connectionIDCounter] = socket;
  connectionIDCounter++; // increment counter
  
  printClientStatus(socket, 'Connected');
  printClientCount();

  socket.on('disconnect', function () {
    // Remove disconnected client from the array.
    delete allSocks[socket.id];
    printClientStatus(socket, 'Disconnected');
	printClientCount();
  });

  socket.on('error', function(error) { 
	 console.log("Socket.IO ERROR: " + error); 
  });

});

function wsStart(){  // put the source websocket logic in a function for easy reconnect

  var wsSrc = new WebSocket(config.sourceSocket);

  wsSrc.on('open', function() {
    printSourceStatus('Connected to Source WS');
  });

  wsSrc.on('message', function(data, flags) {
  	//console.log("got message " + JSON.Stringify(data));
  	//console.log("sending message: data=" + data + " flags=" + flags);
    io.sockets.emit(data);// broadcast as per: http://socket.io/docs/#broadcasting-messages
  });

  wsSrc.on('close', function(ws) {
	printSourceStatus('Disconnected from Source WS');
    // try to reconnect
    setTimeout(wsStart(), 5000);
  });

  wsSrc.on('error', function(error) { 
  	console.log(error); 
  	setTimeout(wsStart(), 5000); 
  });

}

wsStart();

process.on('uncaughtException', function(err) {
  // try to reconnect
  if(err.code == 'ECONNREFUSED'){
    setTimeout(wsStart(), 5000);
  }
});

function printClientCount() {
  console.log('Total Connected Clients:  ' + this.Object.size(allSocks));
  console.log('Total Clients (lifetime): ' + connectionIDCounter);
}

function printClientStatus(socket, status) {
	console.log(new Date() + ' Client ' + status + ' id: ' + socket.id + ' IP: '+ socket.IP);
}

function printSourceStatus(status) {
	console.log(new Date() + ' ' + status + ' ' + config.sourceSocket);
}

// prototype to return size of associative array
Object.size = function(obj) {
  var size = 0, key;
  for (key in obj) {
      if (obj.hasOwnProperty(key)) size++;
  }
  return size;
};