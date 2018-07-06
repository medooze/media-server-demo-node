const https = require ('https');
const url = require ('url');
const fs = require ('fs');
const path = require ('path');
const WebSocketServer = require ('websocket').server;

//Get the Medooze Media Server interface
const MediaServer = require("medooze-media-server");

//Check 
if (process.argv.length!=3)
	 throw new Error("Missing IP address\nUsage: node index.js <ip>");
//Get ip
const ip = process.argv[2];

//Create UDP server endpoint
const endpoint = MediaServer.createEndpoint(ip);

const base = 'www';

const options = {
	key: fs.readFileSync ('server.key'),
	cert: fs.readFileSync ('server.cert')
};

//Enable debug
MediaServer.enableDebug(false);
MediaServer.enableUltraDebug(false);

//Restrict port range
MediaServer.setPortRange(10000,20000);

// maps file extention to MIME typere
const map = {
	'.ico': 'image/x-icon',
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.json': 'application/json',
	'.css': 'text/css',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.wav': 'audio/wav',
	'.mp3': 'audio/mpeg',
	'.svg': 'image/svg+xml',
	'.pdf': 'application/pdf',
	'.doc': 'application/msword'
};

//Create HTTP server
const server = https.createServer (options, (req, res) => {
	// parse URL
	const parsedUrl = url.parse (req.url);
	// extract URL path
	let pathname = base + parsedUrl.pathname;
	// based on the URL path, extract the file extention. e.g. .js, .doc, ...
	const ext = path.parse (pathname).ext;

	//DO static file handling
	fs.exists (pathname, (exist) => {
		if (!exist)
		{
			// if the file is not found, return 404
			res.statusCode = 404;
			res.end (`File ${pathname} not found!`);
			return;
		}

		// if is a directory search for index file matching the extention
		if (fs.statSync (pathname).isDirectory ())
			pathname += '/index.html';

		// read file from file system
		fs.readFile (pathname, (err, data) => {
			if (err)
			{
				//Error
				res.statusCode = 500;
				res.end (`Error getting the file: ${err}.`);
			} else {
				// if the file is found, set Content-type and send data
				res.setHeader ('Content-type', map[ext] || 'text/html');
				res.end (data);
			}
		});
	});
}).listen (8000);

const wsServer = new WebSocketServer ({
	httpServer: server,
	autoAcceptConnections: false
});

// Load the demo handlers
const handlers = {
	"svc"		: require("./lib/svc.js"),
	"rec"		: require("./lib/recording.js"),
	"broadcast"	: require("./lib/broadcast.js"),
	"simulcast"	: require("./lib/simulcast.js"),
	"playback"	: require("./lib/playback.js"),
};

wsServer.on ('request', (request) => {
	//Get protocol for demo
	var protocol = request.requestedProtocols[0];
	
	console.log("-Got request for: " + protocol);
	//If nor found
	if (!handlers.hasOwnProperty (protocol))
		//Reject connection
		return request.reject();

	//Process it
	handlers[protocol](request,protocol,endpoint);
});
