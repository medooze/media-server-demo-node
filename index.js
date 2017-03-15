const https = require ('https');
const url = require ('url');
const fs = require ('fs');
const path = require ('path');
const WebSocketServer = require ('websocket').server;

//Get the Medooze Media Server interface
const MediaServer = require("medooze-media-server");

//Get Semantic SDP objects
const SemanticSDP	= require("semantic-sdp");
const SDPInfo		= SemanticSDP.SDPInfo;
const MediaInfo		= SemanticSDP.MediaInfo;
const CandidateInfo	= SemanticSDP.CandidateInfo;
const DTLSInfo		= SemanticSDP.DTLSInfo;
const ICEInfo		= SemanticSDP.ICEInfo;
const StreamInfo	= SemanticSDP.StreamInfo;
const TrackInfo		= SemanticSDP.TrackInfo;
const Direction		= SemanticSDP.Direction;

//Check 
if (process.argv.length!=3)
	 throw new Error("Missing IP address\nUsage: node index.js <ip>"+process.argv.length);
//Get ip
const ip = process.argv[2];

//Create UDP server endpoint
const endpoint = MediaServer.createEndpoint(ip);

const base = 'www';

const options = {
	key: fs.readFileSync ('server.key'),
	cert: fs.readFileSync ('server.cert')
};

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


wsServer.on ('request', (request) => {
	//Get protocol for demo
	var protocol = request.requestedProtocols[0];
	
	switch(protocol)
	{
		case "svc":
		{
			const connection = request.accept(protocol);
			
			connection.on('message', (frame) =>
			{
				//Get cmd
				var msg = JSON.parse(frame.utf8Data);
				
				
				//Get cmd
				if (msg.cmd==="OFFER")
				{
			
					//Process the sdp
					var offer = SDPInfo.process(msg.offer);
					
					//Create an DTLS ICE transport in that enpoint
					const transport = endpoint.createTransport({
						dtls : offer.getDTLS(),
						ice  : offer.getICE() 
					});

					//Set RTP remote properties
					 transport.setRemoteProperties({
						audio : offer.getMedia("audio"),
						video : offer.getMedia("video")
					});

					//Get local DTLS and ICE info
					const dtls = transport.getLocalDTLSInfo();
					const ice  = transport.getLocalICEInfo();

					//Get local candidates
					const candidates = endpoint.getLocalCandidates();

					//Create local SDP info
					let answer = new SDPInfo();
					
					//Add ice and dtls info
					answer.setDTLS(dtls);
					answer.setICE(ice);
					//For each local candidate
					for (let i=0;i<candidates.length;++i)
						//Add candidate to media info
						answer.addCandidate(candidates[i]);

					//Get remote video m-line info 
					let videoOffer = offer.getMedia("video");

					//If offer had video
					if (videoOffer)
					{
						//Create video media
						let  video = new MediaInfo(videoOffer.getId(), "video");
						
						//Get codec types
						let vp9 = videoOffer.getCodec("vp9");
						let fec = videoOffer.getCodec("flexfec-03");
						//Add video codecs
						video.addCodec(vp9);
						if (fec!=null)
							video.addCodec(fec);
						//Limit incoming bitrate
						video.setBitrate(1024);

						//Add video extensions
						for (let [id, uri] of videoOffer.getExtensions().entries())
							//Add it
							video.addExtension(id, uri);

						//Add it to answer
						answer.addMedia(video);
					}

					//Set RTP local  properties
					transport.setLocalProperties({
						video : answer.getMedia("video")
					});


					//For each stream offered
					for (let offered of offer.getStreams().values())
					{
						//Create the remote stream into the transport
						const incomingStream = transport.createIncomingStream(offered);

						//Create new local stream
						const outgoingStream  = transport.createOutgoingStream({
							audio: false,
							video: true
						});

						//Get local stream info
						const info = outgoingStream.getStreamInfo();

						//Copy incoming data from the remote stream to the local one
						connection.transporder = outgoingStream.attachTo(incomingStream)[0];

						//Add local stream info it to the answer
						answer.addStream(info);
					}
					
					//Send response
					connection.sendUTF(JSON.stringify({
							answer : answer.toString()
						}));
						
					//Close on disconnect
					connection.on("close",() => {
						//Stop

						transport.stop();
					});
				} else {
					//Select layer
					connection.transporder.selectLayer(parseInt(msg.spatialLayerId),parseInt(msg.temporalLayerId));
				}
			});
			break;
		}
		case "rec":
		{
			const connection = request.accept(protocol);
			
			connection.on('message', (frame) =>
			{
				//Get cmd
				var msg = JSON.parse(frame.utf8Data);
				
				
				//Get cmd
				if (msg.cmd==="OFFER")
				{
			
					//Process the sdp
					var offer = SDPInfo.process(msg.offer);
					
					//Create recoreder
					const recorder = MediaServer.createRecorder ("/tmp/"+(new Date()) +".mp4");
					
					//Create an DTLS ICE transport in that enpoint
					const transport = endpoint.createTransport({
						dtls : offer.getDTLS(),
						ice  : offer.getICE() 
					});

					//Set RTP remote properties
					transport.setRemoteProperties({
						audio : offer.getMedia("audio"),
						video : offer.getMedia("video")
					});

					//Get local DTLS and ICE info
					const dtls = transport.getLocalDTLSInfo();
					const ice  = transport.getLocalICEInfo();

					//Get local candidates
					const candidates = endpoint.getLocalCandidates();

					//Create local SDP info
					let answer = new SDPInfo();
					
					//Add ice and dtls info
					answer.setDTLS(dtls);
					answer.setICE(ice);
					//For each local candidate
					for (let i=0;i<candidates.length;++i)
						//Add candidate to media info
						answer.addCandidate(candidates[i]);
					
					//Get remote video m-line info 
					let audioOffer = offer.getMedia("audio");

					//If offer had video
					if (audioOffer)
					{
						//Create video media
						let  audio = new MediaInfo(audioOffer.getId(), "audio");
						
						//Get codec types
						let opus = audioOffer.getCodec("opus");
						//Add video codecs
						audio.addCodec(opus);
						//Set recv only
						audio.setDirection(Direction.RECVONLY);
						//Add it to answer
						answer.addMedia(audio);
					}

					//Get remote video m-line info 
					let videoOffer = offer.getMedia("video");

					//If offer had video
					if (videoOffer)
					{
						//Create video media
						let  video = new MediaInfo(videoOffer.getId(), "video");
						
						//Get codec types
						let vp8 = videoOffer.getCodec("vp8");
						//Add video codecs
						video.addCodec(vp8);
						//Limit incoming bitrate
						video.setBitrate(1024);

						//Add video extensions
						for (let [id, uri] of videoOffer.getExtensions().entries())
							//Add it
							video.addExtension(id, uri);

						//Add it to answer
						answer.addMedia(video);
					}

					//Set RTP local  properties
					transport.setLocalProperties({
						audio : answer.getMedia("audio"),
						video : answer.getMedia("video")
					});


					//For each stream offered
					for (let offered of offer.getStreams().values())
					{
						//Create the remote stream into the transport
						const incomingStream = transport.createIncomingStream(offered);

						//Create new local stream with only audio
						const outgoingStream  = transport.createOutgoingStream({
							audio: false,
							video: true
						});

						//Get local stream info
						const info = outgoingStream.getStreamInfo();

						//Copy incoming data from the remote stream to the local one
						outgoingStream.attachTo(incomingStream);

						//Add local stream info it to the answer
						answer.addStream(info);
						
						//Record it
						recorder.record(incomingStream);
					}
					
					//Send response
					connection.sendUTF(JSON.stringify({
						answer : answer.toString()
					}));
					
					//Close on disconnect
					connection.on("close",() => {
						//Stop
						recorder.stop();
						transport.stop();
					});
				}	
			});
			break;
		}
		case "sfu":
		{
			var connection = request.accept(protocol);
			break;
		}
		default:
			request.reject();
	}
	
});