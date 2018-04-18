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
				//Create video answer
				const video = videoOffer.answer({
					codecs: CodecInfo.MapFromNames(["VP8"], true),
					extensions: new Set([
						"urn:ietf:params:rtp-hdrext:toffset",
						"http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time",
						"urn:3gpp:video-orientation",
						"http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01",
						"http://www.webrtc.org/experiments/rtp-hdrext/playout-delay",	
						"urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id",
						"urn:ietf:params:rtp-hdrext:sdes:repair-rtp-stream-id",
						"urn:ietf:params:rtp-hdrext:sdes:mid",
					]),
					simulcast: true
				});
				
				//Limit incoming bitrate
				video.setBitrate(4096);

				//Add it to answer
				answer.addMedia(video);
			}

			//Set RTP local  properties
			transport.setLocalProperties({
				video : answer.getMedia("video")
			});

			const ts = Date.now();
			
			//Dump contents
			//transport.dump("/tmp/"+ts+".pcap");
			//Create recoreder
			const recorder = MediaServer.createRecorder ("/tmp/"+ts +".mp4");

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

				//Record it
				recorder.record(incomingStream);
			}

			//Send response
			connection.sendUTF(JSON.stringify({
					answer : answer.toString()
				}));

			//Close on disconnect
			connection.on("close",() => {
				//Stop transport an recorded
				transport.stop();
				recorder.stop();
			});
		} else {
			connection.transporder.selectEncoding(msg.rid);
			//Select layer
			connection.transporder.selectLayer(parseInt(msg.spatialLayerId),parseInt(msg.temporalLayerId));
		}
	});

};