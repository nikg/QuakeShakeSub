// Setup express 4 server
var config = require('./config');
var os = require('os');
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 8080;
var buffMax = 1000;
var buffer =[];


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
  //start new connections with a full buffer
  for(var i=0; i < buffer.length; i++){
    io.send(buffer[i]);
   }
  
 
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
    printClientStatus(socket, 'Disconnected');
    delete allSocks[socket.id];
    delete socket.namespace.sockets[socket.id];  // possible fix for deleted sockets "hanging" in memory: https://github.com/Automattic/socket.io/issues/407
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
    message.hname = " [ " + os.hostname() + " ]";
    /* broadcast as per: https://github.com/Automattic/socket.io/wiki/How-do-I-send-a-response-to-all-clients-except-sender%3F
    this doesn't seem to work: http://socket.io/docs/#broadcasting-messages */
    
    data = JSON.stringify(message);
    io.sockets.send(data);
    //add to buffer
    updateBuffer(data);
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

//simple buffer treated as queue.
//this queue shift is really O(n) but
//since this is such a small array it shouldn't matter
function updateBuffer(msg){
  var packetFound=false;
  //check for dupes. Only need to look at the tail end of buffer
  for(var i=buffer.length -6; i< buffer.length; i++){
    if(msg == buffer[i]){
      packetFound=true;
      break;
    }
  }
  if(!packetFound){
    buffer.push(msg);
  }
  while(buffer.length > buffMax ){
    buffer.shift();
  }
  
  // console.log(buffer);
}

function StrToTime(unix_timestamp) {
  var date = new Date(unix_timestamp);
  var hours = date.getHours();// hours part from the timestamp
  var minutes = "0" + date.getMinutes(); // minutes part from the timestamp
  var seconds = "0" + date.getSeconds(); // seconds part from the timestamp
  var ms = "0" + date.getMilliseconds(); // milliseconds part from the timestamp
  // will display time in 10:30:23.354 format
  var formattedTime = hours + ':' + minutes.substr(minutes.length-2) + ':' + seconds.substr(seconds.length-2) + '.' + ms.substr(ms.length-3);
  return formattedTime;
}