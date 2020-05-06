const url = "wss://"+window.location.hostname+":"+window.location.port;

let videoResolution = true;
//Get our url
const href = new URL (window.location.href);
if (href.searchParams.has ("video"))
	switch (href.searchParams.get ("video").toLowerCase ())
	{
		case "1080p":
			videoResolution = {
				width: {min: 1920, max: 1920},
				height: {min: 1080, max: 1080},
			};
			break;
		case "720p":
			videoResolution = {
				width: {min: 1280, max: 1280},
				height: {min: 720, max: 720},
			};
			break;
		case "576p":
			videoResolution = {
				width: {min: 720, max: 720},
				height: {min: 576, max: 576},
			};
			break;
		case "480p":
			videoResolution = {
				width: {min: 640, max: 640},
				height: {min: 480, max: 480},
			};
			break;
		case "no":
			videoResolution = false;
			break;
	}
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
var texts =  document.querySelectorAll('.gaugeChartLabel');
var max =  document.querySelectorAll('.gaugeChartMax');

max[0].innerText = gauges[0].maxValue = videoResolution.width ? videoResolution.width.max : 640; 
max[1].innerText = gauges[1].maxValue = videoResolution.height ? videoResolution.height.max : 480;
max[2].innerText = gauges[2].maxValue = 30; 
max[3].innerText = gauges[3].maxValue = 2048; 
max[4].innerText = gauges[4].maxValue = videoResolution.width ? videoResolution.width.max : 640; 
max[5].innerText = gauges[5].maxValue = videoResolution.height ? videoResolution.height.max : 480;
max[6].innerText = gauges[6].maxValue = 30; 
max[7].innerText = gauges[7].maxValue = 2048;

var texts =  document.querySelectorAll('.gaugeChartLabel');
var max =  document.querySelectorAll('.gaugeChartLabel');

function addVideoForStream(stream,muted)
{
	//Create new video element
	const video = document.querySelector (muted ? "#local" : "#remote");
	//Set same id
	video.streamid = stream.id;
	//Set src stream
	video.srcObject = stream;
	//Set other properties
	video.autoplay = true;
	video.muted = muted;
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

	//Create PC
	pc = new RTCPeerConnection();
	
	var ws = new WebSocket(url,"svc");
	
	pc.onaddstream = function(event) {
		var prev = 0,prevFrames = 0,prevBytes = 0;
		console.debug("onAddStream",event);
		//Play it
		addVideoForStream(event.stream);
		//Get track
		var track = event.stream.getVideoTracks()[0];
		//Update stats
		setInterval(async function(){
			var results;
			
			try {
				//For ff
				results = await pc.getStats(track);
			} catch(e) {
				//For chrome
				results = await pc.getStats();
			}
			var width = track.width || remote.videoWidth;
			var height = track.height || remote.videoHeight;
					
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
					gauges[6].set(Math.min(Math.floor(fps)   ,30));
					gauges[7].set(Math.min(Math.floor(kbps) ,gauges[7].maxValue));
					texts[6].innerText = Math.floor(fps);
					texts[7].innerText =  Math.floor(kbps);
				} else if (result.type==="track") {
					//Update stats
					width = result.frameWidth;
					height = result.frameHeight;
				}
			}
			gauges[4].set(width);
			gauges[5].set(height);
			texts[4].innerText = width;
			texts[5].innerText = height;
		},1000);
			
	};
	
	ws.onopen = function(){
		console.log("opened");
		
		navigator.mediaDevices.getUserMedia({
			audio: false,
			video: videoResolution
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
			setInterval(async function(){
				var results;
				try {
					//For ff
					results = await pc.getStats(track);
				} catch(e) {
					//For chrome
					results = await pc.getStats();
				}
				
				var width = track.width || local.videoWidth;//result.stat("googFrameWidthReceived");
				var height = track.height || local.videoHeight;//result.stat("googFrameHeightReceived");
						
				//Get results
				for (let result of results.values())
				{
					if (result.type==="outbound-rtp")
					{

						//Get timestamp delta
						var delta = result.timestamp-prev;
						//Store this ts
						prev = result.timestamp;
						//Get values
						var fps =  ((result.framesEncoded-prevFrames)*1000/delta);
						var kbps = (result.bytesSent-prevBytes)*8/delta;
						//Store last values
						prevFrames = result.framesEncoded;
						prevBytes  = result.bytesSent;
						//If first
						if (delta==result.timestamp || isNaN(fps) || isNaN (kbps))
							return;

						for (var i=0;i<4;++i)
							gauges[i].animationSpeed = 10000000; // set animation speed (32 is default value)
						gauges[2].set(Math.min(Math.floor(fps)   ,30));
						gauges[3].set(Math.min(Math.floor(kbps) ,gauges[3].maxValue));
						texts[2].innerText = Math.floor(fps);
						texts[3].innerText = Math.floor(kbps);
					} else if (result.type==="track") {
						//Update stats
						width = result.frameWidth;
						height = result.frameHeight;
					}
				}
				gauges[0].maxValue = Math.max(gauges[0].maxValue,width);
				gauges[1].maxValue = Math.max(gauges[1].maxValue,height);
				gauges[4].maxValue = Math.max(gauges[4].maxValue,width);
				gauges[5].maxValue = Math.max(gauges[5].maxValue,height);
				gauges[0].set(width);
				gauges[1].set(height);
				texts[0].innerText = width;
				texts[1].innerText = height;
			},1000);

			//Add stream to peer connection
			pc.addStream(stream);
			//Create new offer
			return pc.createOffer();
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
			//Select simulcast layer
			ws.send(JSON.stringify({
				cmd		: "SELECT_LAYER",
				spatialLayerId	: 0,
				temporalLayerId	: 0
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
		
		if (msg.answer)
		{
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
			
			var listener = function(event) 
			{
				//Get previous selected
				var old = document.querySelector ('.mdl-button--colored');
				//Get data
				var spatialLayerId = event.target.dataset["sid"];
				var temporalLayerId = event.target.dataset["tid"];
				//Send event
				//Create room
				ws.send(JSON.stringify({
					cmd		: "SELECT_LAYER",
					spatialLayerId	: spatialLayerId,
					temporalLayerId	: temporalLayerId
				}));
				//Remove
				event.target.classList.add("mdl-button--colored");
				old.classList.remove("mdl-button--colored");
			};
			var buttons = document.querySelectorAll('button');
			for (var i = 0; i < buttons.length; i++) 
				buttons[i].addEventListener("click",listener);
		} else {
			
			var spatialLayerId = msg.sid;
			var temporalLayerId = msg.tid;
			//Get divs
			var old = document.querySelector (".mdl-button--colored");
			var selected = document.querySelector ("button[data-sid='"+spatialLayerId+"'][data-tid='"+temporalLayerId+"'");
			//Update 
			selected.classList.add("mdl-button--colored");
			old.classList.remove("mdl-button--colored");
		}
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
