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
			const streams = {};

			//Process the sdp
			var offer = SDPInfo.process(msg.offer);

			//Create an DTLS ICE transport in that enpoint
			const transport = endpoint.createTransport(offer);
			
			//Enable probing
			transport.setBandwidthProbing(true);
			transport.setMaxProbingBitrate(512000);
			
			//DUMP
			transport.dump("recordings/svc-"+ts+".pcap",{incoming:true,rtcp:true,rtpHeadersOnly:true,bwe:true});

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
			
			//Get offered stream info
			const offered = offer.getFirstStream();
			
			//Create the remote stream into the transports
			const incomingStream = transport.createIncomingStream(offered);

			//Create new local stream
			const outgoingStream  = transport.createOutgoingStream({
				audio: false,
				video: true
			});

			//Get local stream info
			const info = outgoingStream.getStreamInfo();

			//Copy incoming data from the remote stream to the local one
			const transponder = connection.transporder = outgoingStream.attachTo(incomingStream)[0];
			
			//Start on low
			transponder.selectLayer(0,0);
			
			//Listen for bwe events
			transport.on("targetbitrate",	bitrate=>{
				//Get previous layer ids
				const sid = transponder.getSelectedSpatialLayerId();
				const tid = transponder.getSelectedTemporalLayerId();
				//Select stream layer from bitrate
				const rate = transponder.setTargetBitrate(bitrate);
				//Get next layer
				const next = rate.layers[rate.layerIndex-1];
				//Probing
				let probing = false;
				//If the jump is lower
				if (next)
				{
					//Set probing bitrate
					probing = next.bitrate-rate;
					//Set it on transport
					transport.setMaxProbingBitrate(next.bitrate-rate);
					//Enable
					transport.setBandwidthProbing(true);
				} else 
					//Disable
					transport.setBandwidthProbing(false);
					
				//Log
				console.log("targetbitrate :" + bitrate + " probing:" + probing +" sid:" + transponder.getSelectedSpatialLayerId() + " tid:" +transponder.getSelectedTemporalLayerId());
				//If changed
				if (sid!=transponder.getSelectedSpatialLayerId() || tid!=transponder.getSelectedTemporalLayerId())
					//Send response
					connection.sendUTF(JSON.stringify({
						sid : transponder.getSelectedSpatialLayerId(),
						tid : transponder.getSelectedTemporalLayerId()
					}));
			});

			//Add local stream info it to the answer
			answer.addStream(info);

			//Add to streams
			streams[incomingStream.getId()] = incomingStream;

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
