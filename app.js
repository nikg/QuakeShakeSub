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
  	//console.log("sending message: data=" + data);
    message = JSON.parse(data);
  	console.log("from=" + message.sta + ":" + message.chan + ":" + message.net + ":" + message.loc + " length=" + message.data.length + " start=" + StrToTime(message.starttime) + " end=" + StrToTime(message.endtime));
  
    /* broadcast as per: https://github.com/Automattic/socket.io/wiki/How-do-I-send-a-response-to-all-clients-except-sender%3F
    this doesn't seem to work: http://socket.io/docs/#broadcasting-messages */
    io.sockets.send(data);  
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
  console.log('Connected SocketIO Clients:  ' + this.Object.size(allSocks));
  console.log('Total SocketIO Clients (lifetime): ' + connectionIDCounter);
}

function printClientStatus(socket, status) {
	console.log(new Date() + ' Socket.IO client ' + status + ' id: ' + socket.id + ' IP: '+ socket.IP);
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

function StrToTime(unix_timestamp) {
  var date = new Date(unix_timestamp);
  var hours = date.getHours();// hours part from the timestamp
  var minutes = "0" + date.getMinutes(); // minutes part from the timestamp
  var seconds = "0" + date.getSeconds(); // seconds part from the timestamp
  var ms = "0" + date.getMilliseconds(); // milliseconds part from the timestamp
  // will display time in 10:30:23.354 format
  var formattedTime = hours + ':' + minutes.substr(minutes.length-2) + ':' + seconds.substr(seconds.length-2) + '.' + ms.substr(ms.length-3);
  return formattedTime
}