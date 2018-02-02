const url = "wss://"+window.location.hostname+":"+window.location.port;

const roomId = (new Date()).getTime() + "-" + Math.random();

var opts = {
	lines: 12, // The number of lines to draw
	angle: 0.15, // The length of each line
	lineWidth: 0.44, // 0.44 The line thickness
	pointer: {
		length: 0.8, // 0.9 The radius of the inner circle
		strokeWidth: 0.035, // The rotation offset
		color: '#A0A0A0'     // Fill color
	},
	limitMax: true,
	colorStart: '#28c1d1', // Colors
	colorStop: '#28c1d1', // just experiment with them
	strokeColor: '#F0F0F0', // to see which ones work best for you
	generateGradient: false,
	gradientType: 0
};
var targets = document.querySelectorAll('.gaugeChart'); // your canvas element
var gauges = [];
for (var i=0;i<targets.length;++i)
{
	gauges[i] = new Gauge(targets[i]).setOptions (opts); // create sexy gauge!
	gauges[i].animationSpeed = 10000; // set animation speed (32 is default value)
	gauges[i].set (0); // set actual value
}
gauges[0].maxValue = 640; 
gauges[1].maxValue = 480; 
gauges[2].maxValue = 30; 
gauges[3].maxValue = 1024; 
gauges[4].maxValue = 640; 
gauges[5].maxValue = 480; 
gauges[6].maxValue = 30; 
gauges[7].maxValue = 1024;

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
//Get user media promise based
function  getUserMedia(constrains)
{
	return new Promise(function(resolve,reject) {
		//Get it
		navigator.getUserMedia(constrains,
			function(stream){
				resolve(stream);
			},
			function(error){
				reject(error);
			});
	});
}

var sdp;
var pc;
	
function connect() 
{

	if (window.RTCPeerConnection)
		pc = new RTCPeerConnection({
			bundlePolicy: "max-bundle",
			rtcpMuxPolicy : "require"
		});
	else 
		pc = new webkitRTCPeerConnection(null);
	
	var ws = new WebSocket(url,"simulcast");
	
	pc.onaddstream = function(event) {
		var prev = 0,prevFrames = 0,prevBytes = 0;
		//Play it
		addVideoForStream(event.stream);
		//Get track
		var track = event.stream.getVideoTracks()[0];
		//Update stats
		setInterval(function(){
		
			//Get stats
			pc.getStats(track)
				.then(function(results) {
					//Get results
					for (let result of results.values())
					{
						if (result.type==="inbound-rtp")
						{
							//Get timestamp delta
							var delta = result.timestamp-prev;
							//Store this ts
							prev = result.timestamp;
							
							//Get values
							var width = track.width;//result.stat("googFrameWidthReceived");
							var height = track.height;//result.stat("googFrameHeightReceived");
							var fps =  (result.framesDecoded-prevFrames)*1000/delta;
							var kbps = (result.bytesReceived-prevBytes)*8/delta;
							//Store last values
							prevFrames = result.framesDecoded;
							prevBytes  = result.bytesReceived;
							//If first
							if (delta==result.timestamp || isNaN(fps) || isNaN (kbps))
								return;
							
							for (var i=4;i<targets.length;++i)
								gauges[i].animationSpeed = 10000000; // set animation speed (32 is default value)
							gauges[4].set(width);
							gauges[5].set(height);
							gauges[6].set(Math.min(Math.floor(fps)   ,30));
							gauges[7].set(Math.min(Math.floor(kbps) ,1024));
							texts[4].innerText = width;
							texts[5].innerText = height;
							texts[6].innerText = Math.floor(fps);
							texts[7].innerText =  Math.floor(kbps);
						}
					}
				});
		},1000);
			
	};
	
	pc.onremovestream = function(event) {
		console.debug("onRemoveStream",event);
		//Play it
		removeVideoForStream(event.stream);
	};
	
	ws.onopen = function(){
		console.log("opened");
		
		navigator.mediaDevices.getUserMedia({
			audio: false,
			video: true
		})
		.then(function(stream){	
			var prev = 0;
			var prevFrames = 0;
			var prevBytes = 0;
			var track = stream.getVideoTracks()[0];
			console.debug("getUserMedia sucess",stream);
			//Play it
			addVideoForStream(stream,true);
			//Update stats
			setInterval(function(){
				//Get stats
				pc.getStats(track)
					.then(function(results) {
						//Get results
						for (let result of results.values())
						{
							if (result.type==="outbound-rtp")
							{
								console.log(result);
								//Get timestamp delta
								var delta = result.timestamp-prev;
								//Store this ts
								prev = result.timestamp;

								//Get values
								var width = track.width;//result.stat("googFrameWidthReceived");
								var height = track.height;//result.stat("googFrameHeightReceived");
								var fps =  (result.framesEncoded-prevFrames)*1000/delta;
								var kbps = (result.bytesSent-prevBytes)*8/delta;
								//Store last values
								prevFrames = result.framesEncoded;
								prevBytes  = result.bytesSent;
								//If first
								if (delta==result.timestamp || isNaN(fps) || isNaN (kbps))
									return;

								for (var i=0;i<4;++i)
									gauges[i].animationSpeed = 10000000; // set animation speed (32 is default value)
								gauges[0].maxValue = 640; 
								gauges[1].maxValue = 480; 
								gauges[2].maxValue = 30; 
								gauges[3].maxValue = 1024;
								gauges[0].set(width);
								gauges[1].set(height);
								gauges[2].set(Math.min(Math.floor(fps)   ,30));
								gauges[3].set(Math.min(Math.floor(kbps) ,1024));
								texts[0].innerText = width;
								texts[1].innerText = height;
								texts[2].innerText = Math.floor(fps);
								texts[3].innerText = Math.floor(kbps);
							} 
						}
					});
			},1000);
			window.s = stream;
			//Add stream to peer connection
			pc.addStream(stream);
			//Enable simulcast
			pc.getSenders()[0].setParameters({
				encodings: [
					{ rid: "a"},
					{ rid: "b" , scaleDownResolutionBy: 2.0 },
					{ rid: "c" , scaleDownResolutionBy: 4.0 }
				]
			});
			//Create new offer
			return pc.createOffer();
		})
		.then(function(offer){
			console.debug("createOffer sucess",offer);
			//We have sdp
			//Convert from simulcast_03 to simulcast
			sdp = offer.sdp.replace(": send rid=",":send ");
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
				//Convert from simulcast to simulcast_03
				sdp: msg.answer.replace(":recv ",": recv rid=")
			}), function () {
				console.log("JOINED");
			}, function (err) {
				console.error("Error joining",err);
			}
		);
		var old = document.querySelector ('.mdl-button--colored');
		var listener = function(event) 
		{
			//Get data
			var rid = event.target.dataset["rid"];
			var spatialLayerId = event.target.dataset["sid"];
			var temporalLayerId = event.target.dataset["tid"];
			//Send event
			//Create room
			ws.send(JSON.stringify({
				cmd		: "SELECT_LAYER",
				rid		: rid,
				spatialLayerId	: spatialLayerId,
				temporalLayerId	: temporalLayerId
			}));
			//Remove
			event.target.classList.add("mdl-button--colored");
			old.classList.remove("mdl-button--colored");
			old = event.target;

		};
		var buttons = document.querySelectorAll('button');
		for (var i = 0; i < buttons.length; i++) 
			buttons[i].addEventListener("click",listener);
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





