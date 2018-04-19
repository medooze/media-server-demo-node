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
		codecs		: ["vp9"],
		rtx		: true,
		rtcpfbs		: [
			{ "id": "transport-cc"},
			{ "id": "ccm", "params": ["fir"]},
			{ "id": "nack"},
			{ "id": "nack", "params": ["pli"]}
		],
		extensions	: [ "urn:3gpp:video-orientation", "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01"]
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
			const streams = {};

			//Process the sdp
			var offer = SDPInfo.process(msg.offer);

			//Create an DTLS ICE transport in that enpoint
			const transport = endpoint.createTransport({
				dtls : offer.getDTLS(),
				ice  : offer.getICE() 
			});

			transport.on("targetbitrate",(bitrate)=> {
				console.log("Sender side target bitrate estimation: "+(bitrate/1000)+"bps");
				for (let streamId in streams)
					console.log(JSON.stringify(streams[streamId].getStats(),null,2));
			});

			transport.dump("/tmp/svc.pcap");

			//Set RTP remote properties
			 transport.setRemoteProperties({
				audio : offer.getMedia("audio"),
				video : offer.getMedia("video")
			});

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

				//Add to streams
				streams[incomingStream.getId()] = incomingStream;
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
};