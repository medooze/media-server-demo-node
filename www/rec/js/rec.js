const url = "wss://"+window.location.hostname+":"+window.location.port;

const roomId = (new Date()).getTime() + "-" + Math.random();

var texts =  document.querySelectorAll('.gaugeChartLabel');

function addVideoForStream(stream,muted)
{
	//Create new video element
	const video = document.querySelector (muted ? "#local" : "#remote");
	//Set same id
	video.id = stream.id;
	//Set src stream
	video.src = URL.createObjectURL(stream);
	//Set other properties
	video.autoplay = true;
	video.muted = muted;
}
function removeVideoForStream(stream)
{
	//Get video
	var video = document.getElementById(stream.id);
	//Remove it when done
	video.addEventListener('webkitTransitionEnd',function(){
            //Delete it
	    video.parentElement.removeChild(video);
        });
	//Disable it first
	video.className = "disabled";
}

var sdp;
var pc;
	
function connect() 
{

	if (window.RTCPeerConnection)
		pc = new RTCPeerConnection({
			bundlePolicy	: "max-bundle",
			rtcpMuxPolicy	: "require",
			mediaCryptoKey	: "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkw",
			mediaCryptoSuite: "AES_CM_128_HMAC_SHA1_80"
		});
	else 
		pc = new webkitRTCPeerConnection(null);
	
	var ws = new WebSocket(url,"rec");
	
	pc.onaddstream = function(event) {
		var prev = 0;
		console.debug("onAddStream",event);
		//Play it
		addVideoForStream(event.stream);

			
	};
	
	pc.onremovestream = function(event) {
		console.debug("onRemoveStream",event);
		//Play it
		removeVideoForStream(event.stream);
	};
	
	ws.onopen = function(){
		console.log("opened");
		
		navigator.mediaDevices.getUserMedia({
			audio: true,
			video: true
		})
		.then(function(stream){	
			var prev = 0;
			console.debug("getUserMedia sucess",stream);
			//Play it
			addVideoForStream(stream,true);
			window.s = stream;
			//Add stream to peer connection
			pc.addStream(stream);
			//Create new offer
			return pc.createOffer(stream);
		})
		.then(function(offer){
			console.debug("createOffer sucess",offer);
			//We have sdp
			sdp = offer.sdp;
			//Set it
			pc.setLocalDescription(offer);
			console.log(sdp);
			//Create room
			ws.send(JSON.stringify({
				cmd		: "OFFER",
				offer		: sdp
			}));
		})
		.catch(function(error){
			console.error("Error",error);
		});
	};
	
	ws.onmessage = function(event){
		console.log(event);
		
		//Get protocol message
		const msg = JSON.parse(event.data);
		
		console.log(msg.answer);
		pc.setRemoteDescription(new RTCSessionDescription({
				type:'answer',
				sdp: msg.answer
			}), function () {
				console.log("JOINED");
			}, function (err) {
				console.error("Error joining",err);
			}
		);
	};
}

var dialog = document.querySelector('dialog');
if (dialog.showModal)
{
	dialog.showModal();
	dialog.querySelector('.ready').addEventListener('click', function() {
		dialog.close();
		connect();
	});
} else {
	connect();
}





