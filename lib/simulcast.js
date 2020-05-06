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
const CodecInfo		= SemanticSDP.CodecInfo;


const Capabilities = {
	video : {
		codecs		: ["h264;packetization-mode=1"],
		rtx		: true,
		rtcpfbs		: [
			{ "id": "goog-remb"},
			{ "id": "transport-cc"},
			{ "id": "ccm", "params": ["fir"]},
			{ "id": "nack"},
			{ "id": "nack", "params": ["pli"]}
		],
		extensions	: [ 
			"urn:3gpp:video-orientation",
			"http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01",
			"urn:ietf:params:rtp-hdrext:sdes:mid",
			"urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id",
			"urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id",
			"http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time"
		],
		simulcast	: true
	}
};

module.exports = function(request,protocol,endpoint)
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
			const transport = endpoint.createTransport(offer);
			
			//Set RTP remote properties
			transport.setRemoteProperties(offer);
			
			//Enable bandwidth probing
			transport.setBandwidthProbing(true);
			transport.setMaxProbingBitrate(300*1000);
			
			//Create local SDP info
			const answer = offer.answer({
				dtls		: transport.getLocalDTLSInfo(),
				ice		: transport.getLocalICEInfo(),
				candidates	: endpoint.getLocalCandidates(),
				capabilities	: Capabilities
			});

			//Set RTP local  properties
			transport.setLocalProperties({
				video : answer.getMedia("video")
			});

			//Get timestamp
			const ts = Date.now();
			
			//Dump contents
			transport.dump("recordings/simulcast-"+ts+".pcap");
			
			//Create recoreder
			//const recorder = MediaServer.createRecorder ("recordings/simulcast"+ts +".mp4");

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

				setInterval(()=>{
					//console.dir(incomingStream.getStats(),{depth:null});
					//console.log(outgoingStream.getStats());
				},1000);
				//Record it
				//recorder.record(incomingStream);
			}

			//Send response
			connection.sendUTF(JSON.stringify({
					answer : answer.toString().replace("h264","H264")
				}));

			console.log("OFFER");
			console.log(msg.offer);
			console.log("ANSWER");
			console.log(answer.toString().replace("h264","H264"));
			//Close on disconnect
			connection.on("close",() => {
				//Stop transport an recorded
				transport.stop();
				//recorder.stop();
			});
		} else {
			connection.transporder.selectEncoding(msg.rid);
			//Select layer
			connection.transporder.selectLayer(parseInt(msg.spatialLayerId),parseInt(msg.temporalLayerId));
		}
	});

};
