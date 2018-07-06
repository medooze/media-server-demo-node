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
	audio : {
		codecs		: ["opus"],
		extensions	: [ "urn:ietf:params:rtp-hdrext:ssrc-audio-level", "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01"]
	},
	video : {
		codecs		: ["vp9","h264;packetization-mode=1"],
		rtx		: true,
		rtcpfbs		: [
			{ "id": "transport-cc"},
			{ "id": "ccm", "params": ["fir"]},
			{ "id": "nack"},
			{ "id": "nack", "params": ["pli"]}
		],
		extensions	: [ "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01"]
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

			//Create recoreder
			const recorder = MediaServer.createRecorder ("recordings/"+ Date.now() +".mp4",{
				refresh : 15000
			});

			//Create an DTLS ICE transport in that enpoint
			const transport = endpoint.createTransport(offer);
			
			transport.dump("recordings/rec-"+ Date.now()+".pcap",{
				incoming : true,
				rtcp	 : true
			});

			//Set RTP remote properties
			transport.setRemoteProperties(offer);

			//Create local SDP info
			const answer = offer.answer({
				dtls		: transport.getLocalDTLSInfo(),
				ice		: transport.getLocalICEInfo(),
				candidates	: endpoint.getLocalCandidates(),
				capabilities	: Capabilities
			});

			//Set RTP local  properties
			transport.setLocalProperties(answer);

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
};
