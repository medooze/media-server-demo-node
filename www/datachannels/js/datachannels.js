const url = "wss://"+window.location.hostname+":"+window.location.port;



var sdp;
var pc;
	
function connect() 
{

	//Create PC
	pc = new RTCPeerConnection();
	const dc = pc.createDataChannel("aaaaaaaaaaaaaaaa");
	
	var ws = new WebSocket(url,"datachannels");
	
	ws.onopen = async function() {
		//Create new offer
		const offer = await pc.createOffer();
		//We have sdp
		sdp = offer.sdp;
		console.log("offer",sdp);
		//Set it
		await pc.setLocalDescription(offer);
		//Create room
		ws.send(JSON.stringify({
			cmd		: "OFFER",
			offer		: sdp
		}));
	};
	
	ws.onmessage = function(event){
		//Get protocol message
		const msg = JSON.parse(event.data);
		const answer = msg.answer.replace("m=application 9 UDP/TLS/RTP/SAVPF","m=application 9 DTLS/SCTP 5000") + "a=sctpmap:5000 webrtc-datachannel 1024\r\n"
		console.log("answer",answer);
		pc.setRemoteDescription(new RTCSessionDescription({
				type:'answer',
				sdp: answer
			}), function () {
				console.log("JOINED");
			}, function (err) {
				console.error("Error joining",err);
			}
		);
	};
}

connect();

