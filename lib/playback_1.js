//Get the Medooze Media Server interface
const MediaServer = require("medooze-media-server");
const FileSystem  = require("fs");
const Path	  = require("path");
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
		codecs		: ["vp9","vp8","h264;packetization-mode=1"],
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
	let player;
			
	connection.on('message', (frame) =>
	{
		//Get cmd
		var msg = JSON.parse(frame.utf8Data);

		//Get cmd
		if (msg.cmd==="OFFER")
		{
			let mp4;
			
			//Get all files in recording dir
			const files = FileSystem.readdirSync('recordings');
			for(let i in files)
			{
				if (Path.extname(files[i])===".mp4")
				{
					//got ir
					mp4 = files[i];
					break;
				}
			}
				
			//Check
			if (!mp4)
			{
				console.error("no mp4 found");
				return connection.close();
			}
			
			//Create player
			player = MediaServer.createPlayer(Path.join("recordings",mp4));
			
			//Process the sdp
			var offer = SDPInfo.process(msg.offer);

			//Create an DTLS ICE transport in that enpoint
			const transport = endpoint.createTransport(offer);

			//Set RTP remote properties
			transport.setRemoteProperties(offer);

			transport.dump("recordings/play-"+ Date.now()+".pcap",{
				outgoing : true,
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

			//Create new local stream with only video
			const outgoingStream  = transport.createOutgoingStream({
				audio: true,
				video: true
			});

			//Copy incoming data from the broadcast stream to the local one
			outgoingStream.attachTo(player);

			//Get local stream info
			const info = outgoingStream.getStreamInfo();

			//Add local stream info it to the answer
			answer.addStream(info);

			//Send response
			connection.sendUTF(JSON.stringify({
				answer : answer.toString()
			}));

		
			//Close on disconnect
			connection.on("close",() => {
				//Stop
				transport.stop();
				//Stop playback too
				player.stop();
			});
		} else if (msg.cmd==="PLAY") {
			player.play({
					repeat : true
				});
		}
	});
};