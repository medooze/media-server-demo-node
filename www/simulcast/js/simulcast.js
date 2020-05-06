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

var ssrcs;

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

var pc;
let simulcast_03 = false;
let sdpMungling = false;
	
function connect() 
{
	//Create PC
	pc = new RTCPeerConnection({sdpSemantics : "plan-b"});

	var ws = new WebSocket(url,"simulcast");
	
	pc.ontrack = function(event) {
		var prev = 0,prevFrames = 0,prevBytes = 0;
		console.debug("ontrack",event);
		const stream = event.streams[0];
		//Play it
		addVideoForStream(stream);
		//Get track
		var track = stream.getVideoTracks()[0];
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
			},1000);
			window.s = stream;
			
			//Add stream tracks to peer connection
			stream.getTracks().forEach(track => pc.addTrack(track, stream));
			
			//Check API "compatibility"
			if (pc.getSenders()[0].setParameters)
			{
				try {
					//Enable simulcast
					pc.getSenders()[0].setParameters({
						encodings: [
							{ rid: "a"},
							{ rid: "b" , scaleDownResolutionBy: 2.0 },
							{ rid: "c" , scaleDownResolutionBy: 4.0 }
						]
					});
				} catch(e) {
				}
			}
			//Create new offer
			return pc.createOffer();
		})
		.then(function(offer){
			console.debug("createOffer sucess",offer);
			
			//Get offer
			let sdp = offer.sdp;
			
			//Check simulcast 04 format
			if (sdp.indexOf(": send rid"))
			{
				//Convert from simulcast_03 to simulcast
				sdp = sdp.replace(": send rid=",":send ");
				//We need to modify answer too
				simulcast_03 = true;
			}
			
			//If offer doesn't have simulcast
			if (sdp.indexOf("simulcast")==-1)
				try {
					//OK, chrome way
					const reg1 = RegExp("m=video.*\?a=ssrc:(\\d*) cname:(.+?)\\r\\n","s");
					const reg2 = RegExp("m=video.*\?a=ssrc:(\\d*) mslabel:(.+?)\\r\\n","s");
					const reg3 = RegExp("m=video.*\?a=ssrc:(\\d*) msid:(.+?)\\r\\n","s");
					const reg4 = RegExp("m=video.*\?a=ssrc:(\\d*) label:(.+?)\\r\\n","s");
					//Get ssrc and cname
					let res = reg1.exec(sdp);
					const ssrc = res[1];
					const cname = res[2];
					//Get other params
					const mslabel = reg2.exec(sdp)[2];
					const msid = reg3.exec(sdp)[2];
					const label = reg4.exec(sdp)[2];
					//Add simulcasts ssrcs
					const num = 2;
					const ssrcs = [ssrc];

					for (let i=0;i<num;++i)
					{
						//Create new ssrcs
						const ssrc = 100+i*2;
						const rtx   = ssrc+1;
						//Add to ssrc list
						ssrcs.push(ssrc);
						//Add sdp stuff
						sdp +=	"a=ssrc-group:FID " + ssrc + " " + rtx + "\r\n" +
							"a=ssrc:" + ssrc + " cname:" + cname + "\r\n" +
							"a=ssrc:" + ssrc + " msid:" + msid + "\r\n" +
							"a=ssrc:" + ssrc + " mslabel:" + mslabel + "\r\n" +
							"a=ssrc:" + ssrc + " label:" + label + "\r\n" +
							"a=ssrc:" + rtx + " cname:" + cname + "\r\n" +
							"a=ssrc:" + rtx + " msid:" + msid + "\r\n" +
							"a=ssrc:" + rtx + " mslabel:" + mslabel + "\r\n" +
							"a=ssrc:" + rtx + " label:" + label + "\r\n";
					}
					//Conference flag
					sdp += "a=x-google-flag:conference\r\n";
					//Add SIM group
					sdp += "a=ssrc-group:SIM " + ssrcs.join(" ") + "\r\n";
					//Update sdp in offer without the rid stuff
					offer.sdp = sdp;
					//Add RID equivalent to send it to the sfu
					sdp += "a=simulcast:send a;b;c\r\n";
					sdp += "a=rid:a send ssrc="+ssrcs[2]+"\r\n";
					sdp += "a=rid:b send ssrc="+ssrcs[1]+"\r\n";
					sdp += "a=rid:c send ssrc="+ssrcs[0]+"\r\n";
					//Disable third row
					//document.querySelector("tr[data-rid='c']").style.display = 'none';
					//Doing mungling
					sdpMungling = true;

				} catch(e) {
					console.error(e);
				}
			
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
				rid		: "b",
				spatialLayerId	: 0,
				temporalLayerId	: 2
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
		
		//Get sdp
		let sdp = msg.answer;
			
		//If offer was simulcast 04
		if (simulcast_03)
			//Conver it back
			sdp = sdp.replace(": recv rid=",":recv ");
		
		//if doing mungling
		if (sdpMungling)
			//Add custom flag and remove simulcast attirbute
			sdp = sdp.replace(/a=sim.*\r\n/,"") + "a=x-google-flag:conference\r\n";
			
		console.log(sdp);
		
		pc.setRemoteDescription(new RTCSessionDescription({
				type:'answer',
				//Convert from simulcast to simulcast_03
				sdp: sdp
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
			var temporalLayerId = event.target.dataset["tid"];
			//Select simulcast layer
			ws.send(JSON.stringify({
				cmd		: "SELECT_LAYER",
				rid		: rid,
				spatialLayerId	: 0,
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





