# media-server-demo-node
Demo application for the Medooze Media Server for Node.js

## Intallation
```
npm install
```

## Run
You need to run the demo passing as argument the public IP address of the media server that will be included in the SDP. This IP address is the one facing your clients.
```
node index.js <ip>
```

The demo will open an HTPPS/WSS server at port 8000. 

## Demos
### SVC Layer selection

To run this demo just open `https://ip:8000/svc/` on a Chrome browser and follow instructions.

### Recording

To run this demo just open `https://ip:8000/rec/` with Chrome or Firefox.

### Broadcasting

To run this demo just open `https://ip:8000/broadcast/` with Chrome or Firefox and follow instructions.

### Simulcat

To run this demo just open `https://ip:8000/simulcast/` with Chrome or Firefox and follow instructions.




