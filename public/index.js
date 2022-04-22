console.log("Started...");

let audios = new Map();
let nodeIdMap = new Map();
let encodingIdMap = new Map();
let timingMap = new Map();
let parentSimilatiry = new Map();
let parentMap = new Map();

let inst_to_track = {"piano":0,"violin":1,"cello":2,"bass":3,"guitar":4,"flute":5,"clarinet":6,"trumpet":7,"harp":8,"drum":9};


function parseToken(token) {
	token = +token;
	if (token >= 0 && token < 3840) {
		var pitch = token % 128;
		var inst_vol_index = token >> 7;
		var instrument = ["piano","piano","piano","piano","piano","piano","piano","piano","piano","piano","piano","piano","piano","piano",
		                  "violin","violin","cello","cello","bass","bass","guitar","guitar",
		                  "flute","flute","clarinet","clarinet","trumpet","trumpet","harp","harp"][inst_vol_index];
		var volume = [0,24,32,40,48,56,64,72,80,88,96,104,112,120,80,0,80,0,80,0,80,0,80,0,80,0,80,0,80,0][inst_vol_index];
		return {"type":"note","pitch":pitch,"instrument":instrument,"volume":volume};
	} else if (token >= 3840 && token < 3968) {
		var pitch = token % 128;
		return {"type":"note","pitch":pitch,"instrument":"drum","volume":80};
	} else if (token >= 3968 && token < 4096) {
		var delay = (token % 128) + 1;
		return {"type":"wait","delay":delay}
	} else if (token == 4096) {
		return {"type":"start"}
	} else {
		return {"type":"invalid"}
	}

}


var ding = new Audio("chord.wav");
ding.volume = 0.1;

/*

{
        text: { name: "Parent node" },
        children: [
            {
                innerHTML: nodeHTML
            },
            {
                innerHTML: nodeHTML,
                children: [
                    {
                        innerHTML: nodeHTML
                    }
                ]
            }
        ]
    }

*/

let nodes = {
};

$("#importMIDI").click(() => {
    // prompt user to select a midi file
    $("#midiFile").click();
});

$("#midiFile").change(() => {
    const file = $("#midiFile")[0].files[0];

    let reader = new FileReader();
	reader.readAsArrayBuffer(file);
	window.file = file;

	reader.onload = readerEvent => {
		let content = new Uint8Array(readerEvent.target.result);
		let midiData = parseMidi(content);
		console.log(midiData);

		let mergedTrack = [];
		let originalOrder = 0;
		for (let i=0; i<midiData.tracks.length; i++) {
			let startTime = 0;
			for (let j=0; j<midiData.tracks[i].length; j++) {
				let event = midiData.tracks[i][j];
				startTime += event.deltaTime;
				event.startTime = Math.round(startTime * 48 / midiData.header.ticksPerBeat);
				event.originalOrder = originalOrder;
				mergedTrack.push(event);
				originalOrder++;
			}
		}
		mergedTrack.sort(function(a, b){
			if(a.startTime < b.startTime) { return -1; }
			if(a.startTime > b.startTime) { return 1; }
			if(a.originalOrder < b.originalOrder) { return -1; }
			if(a.originalOrder > b.originalOrder) { return 1; }
			return 0;
		})

		document.getElementById("piano").checked = false;
		document.getElementById("strings").checked = false;
		document.getElementById("winds").checked = false;
		document.getElementById("drums").checked = false;
		document.getElementById("harp").checked = false;
		document.getElementById("guitar").checked = false;
		document.getElementById("bass").checked = false;

		let encoded = "";
		let currentInsts = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
		for (let i=0; i<mergedTrack.length; i++) {
			let event = mergedTrack[i];
			let deltaTime = (i == 0) ? event.startTime : (event.startTime - mergedTrack[i-1].startTime);
			let timeLeftToWait = deltaTime;
			while (timeLeftToWait > 0) {
				let waitTime = timeLeftToWait > 128 ? 128 : timeLeftToWait;
				let token = 3968 + waitTime - 1;
				encoded += token + " ";
				timeLeftToWait -= waitTime;
			}

			if (event.type == "programChange") {
				currentInsts[event.channel] = event.programNumber;
			}
			let currentInst = currentInsts[event.channel];
			let inst;
			let baseNoteOn;
			let baseNoteOff;
			let checkboxID;
			if ([40,41,44,45,48,49,50,51].indexOf(currentInst) > -1) {
				inst = "violin";
				baseNoteOn = 14*128;
				baseNoteOff = 15*128;
				checkboxID = "strings";
			} else if ([42,43].indexOf(currentInst) > -1) {
				inst = "cello";
				baseNoteOn = 16*128;
				baseNoteOff = 17*128;
				checkboxID = "strings";
			} else if ([32,33,34,35,36,37,38,39].indexOf(currentInst) > -1) {
				inst = "bass";
				baseNoteOn = 18*128;
				baseNoteOff = 19*128;
				checkboxID = "bass";
			} else if ([24,25,26,27,28,29,30,31].indexOf(currentInst) > -1) {
				inst = "guitar";
				baseNoteOn = 20*128;
				baseNoteOff = 21*128;
				checkboxID = "guitar";
			} else if ([72,73,74,75,76,77,78,79].indexOf(currentInst) > -1) {
				inst = "flute";
				baseNoteOn = 22*128;
				baseNoteOff = 23*128;
				checkboxID = "winds";
			} else if ([64,65,66,67,68,69,70,71].indexOf(currentInst) > -1) {
				inst = "clarinet";
				baseNoteOn = 24*128;
				baseNoteOff = 25*128;
				checkboxID = "winds";
			} else if ([56,57,58,59,60,61,62,63].indexOf(currentInst) > -1) {
				inst = "trumpet";
				baseNoteOn = 26*128;
				baseNoteOff = 27*128;
				checkboxID = "winds";
			} else if ([46].indexOf(currentInst) > -1) {
				inst = "harp";
				baseNoteOn = 28*128;
				baseNoteOff = 29*128;
				checkboxID = "harp";
			} else {
				inst = "piano";
				baseNoteOn = 8*128;
				baseNoteOff = 0*128;
				checkboxID = "piano";
			}

			if (event.channel == 9) {
				inst = "drum";
				baseNoteOn = 3840;
				baseNoteOff = null;
				checkboxID = "drums";
			}
			if (event.type == "noteOff" || (event.type == "noteOn" && event.velocity==0)) {
				if (baseNoteOff !== null) {
					token = baseNoteOff + event.noteNumber;
					encoded += token + " ";
				}
			} else if (event.type == "noteOn" && event.velocity > 0) {
				token = baseNoteOn + event.noteNumber;
				encoded += token + " ";
				document.getElementById(checkboxID).checked = true;
			}
		}
        window.encoding = encoded.trim();
        nodes = {
            innerHTML: `<div class="stack"><p>MIDI Upload</p><input value="${encoded.trim()}"></input><button id="rootExtend" onclick="window.extend()">Extend</button><button class="extend2" onclick="window.extend2()">Nearest</button></div>`,
            children: []
        }
        window.currentNode = nodes;
        generate();
		// document.getElementById("inbox").value = encoded.trim();
		// window.encodingToMidiFile(document.getElementById("inbox").value, "download_inbox");
	}

});

window.play = (url, id, startTime) => {

    // if currently playing something stop, if we were playing what we are trying to stop -> STOP
    if(window.isPlaying) {
        if(window.playingURL === url) {
            window.stopPlaying();
            return;
        } else {
            window.stopPlaying();
        }
    }

    if(!audios.has(url)) {
        audios.set(url, {
            url,
            audio: new Audio(url)
        });
    }

    const a = audios.get(url);
    
    a.audio.load();
    a.audio.currentTime = startTime;
    a.audio.play();

    let duration = timingMap.get(id);

    const timeUpdate = (e) => {
        let percent = (a.audio.currentTime / duration) * 100;
        $(`#${id}`).find(".play").css("background", `linear-gradient(90deg, rgb(0 0 0) 0%, rgb(20 20 20) ${percent}%, rgba(255,255,255,0) ${percent + 1}%)`);
        $(`#${id}`).find(".play").css("border", "1px solid black");
        if(a.audio.currentTime >= duration) {
            window.stopPlaying();
        }
    }
    a.audio.addEventListener("timeupdate", timeUpdate);

    window.isPlaying = true;
    window.playingURL = url;
    window.stopPlaying = () => {
        a.audio.pause();
        window.isPlaying = false;
        $(`#${id}`).find(".play").css("background", "black");
        $(`#${id}`).find(".play").css("border", "unset");
        a.audio.removeEventListener("timeupdate", timeUpdate);
    }
}

const EXTEND_AMOUNT = 8;

window.downloadMp3 = (url) => {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    a.href = url;
    a.download = "download.mp3";
    a.click();
}

window.downloadMidi = (id) => {

    let encoding = encodingIdMap.get(id);

	var midiData = {
	    header: {
	    	"format": 1,
	    	"numTracks": 10,
	    	"ticksPerBeat": 48
	    },
	    tracks: [[{"deltaTime":0,"channel":0,"type":"programChange","programNumber":0}],
	             [{"deltaTime":0,"channel":1,"type":"programChange","programNumber":40}],
	             [{"deltaTime":0,"channel":2,"type":"programChange","programNumber":42}],
	             [{"deltaTime":0,"channel":3,"type":"programChange","programNumber":32}],
	             [{"deltaTime":0,"channel":4,"type":"programChange","programNumber":24}],
	             [{"deltaTime":0,"channel":5,"type":"programChange","programNumber":73}],
	             [{"deltaTime":0,"channel":6,"type":"programChange","programNumber":71}],
	             [{"deltaTime":0,"channel":7,"type":"programChange","programNumber":56}],
	             [{"deltaTime":0,"channel":8,"type":"programChange","programNumber":46}],
	             [{"deltaTime":0,"channel":9,"type":"programChange","programNumber":0}]]
	};

	var tokens = encoding.trim().split(" ");

	var deltaTimes = [0,0,0,0,0,0,0,0,0,0];
	var usedDrumNotes = new Set();
	for (var i=0; i<tokens.length; i++) {
		var token = tokens[i];
		var parsedToken = parseToken(token);
		if (parsedToken.type == "note") {
			var trackIndex = inst_to_track[parsedToken.instrument];
			midiData.tracks[trackIndex].push({
				"deltaTime": deltaTimes[trackIndex],
				"channel": trackIndex,
				"type": parsedToken.volume > 0 ? "noteOn" : "noteOff",
				"noteNumber": parsedToken.pitch,
				"velocity": parsedToken.volume
			});
			if (parsedToken.instrument == "drum") {
				usedDrumNotes.add(parsedToken.pitch);
			}
			deltaTimes[trackIndex] = 0;
		} else if (parsedToken.type == "wait") {
			for (var j=0; j<10; j++) {
				deltaTimes[j] += parsedToken.delay;
			}
		}
	}
	for (let pitch of usedDrumNotes) {
		midiData.tracks[9].push({
			"deltaTime": deltaTimes[9],
			"channel": 9,
			"type": "noteOff",
			"noteNumber": pitch,
			"velocity": 0
		});
		deltaTimes[9] = 0;
	}

	for (var i=0; i<midiData.tracks.length; i++) {
		midiData.tracks[i].push({
			"deltaTime": deltaTimes[i],
			"meta": true,
			"type": "endOfTrack"
		});
		deltaTimes[i] = 0;
	}

	midiData.tracks = midiData.tracks.filter(track => track.length > 2);

	console.log(midiData);

	var midiBlob = new Blob([new Uint8Array(writeMidi(midiData))], {type: "audio/midi"});

    let a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    a.href = URL.createObjectURL(midiBlob);
    a.download = "download.mid";
    a.click();
}

window.extend2 = (node) => {
    let realExtend = Math.floor(EXTEND_AMOUNT / 4);
    let promises = [];
    for(let i = 0; i < realExtend; i++) {
        promises.push(window.extend(node));
    }

    let parentId = typeof node === "undefined" ? "root" : node;
    let existingNodes = [];
    if(parentMap.has(parentId)) {
        // loop entires in parentMap
        let nodes = parentMap.get(parentId);

        for(let i = 0; i < nodes.length; i++) {
            existingNodes.push({
                id: nodes[i],
                encoding: encodingIdMap.get(nodes[i])
            });
        }
    }
    console.log("Existing nodes:");
    console.log(existingNodes); 
        

    console.log("STARTED");
    Promise.all(promises).then(data => {
        console.log("FINISHED");

        let nodes = [];
        for(let i = 0; i < data.length; i++) {
            nodes = nodes.concat(data[i].nodes);
        }
        nodes = nodes.concat(existingNodes);

        
        console.log(nodes);
        const encoding = data[0].encoding;
        
        let bestV = 0;
        let bestN = false; 
        
        for(let i = 0; i < nodes.length; i++) {
            let node = nodes[i];
            let nodeEncoding = node.encoding;

            console.log("Removed length: " + encoding.length);
            console.log("Before length: " + nodeEncoding.length);

            nodeEncoding = nodeEncoding.split(encoding)[1];
            if(nodeEncoding.startsWith(" ")) {
                // remove space at front
                nodeEncoding = nodeEncoding.substring(1);
            }

            console.log("After length: " + nodeEncoding.length);

            let similatiry = window.stringSimilarity(encoding, nodeEncoding, 2, false);
            if(similatiry > bestV) {
                bestV = similatiry;
                bestN = node;
            }
            parentSimilatiry.set(node.id, {
                best: false,
                value: similatiry
            });
        }

        if(bestN) {
            parentSimilatiry.set(bestN.id, {
                best: true,
                value: bestV
            });
        }

    });
}

window.extend = (node) => {
    return new Promise(resolve => {
        let enc = window.encoding;
        let extendElement;

        let parent;

        if(typeof node === "undefined") {
            extendElement = $("#rootExtend").parent().parent().find("button");
            node = nodes;
            parent = "root";
        } else {
            parent = node;
            extendElement = $(`#${node}`).find("button");
            enc = encodingIdMap.get(node);
            node = nodeIdMap.get(node);
        }
    
        extendElement.css("cursor", "not-allowed");
        extendElement.css("opacity", "0.2");
    
        $(".controller").css("opacity", "0.2");
        $("html").css("cursor", "wait");
        // document.getElementById("loader-inner").style.animation = "progress 60s linear both";
        let genre = document.getElementById("genre").value;
    
        fetch("https://musenet.openai.com/sample", {
            "method": "POST",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": JSON.stringify({
                "genre": genre,
                "instrument":{
                    "piano": document.getElementById("piano").checked,
                    "strings": document.getElementById("strings").checked,
                    "winds": document.getElementById("winds").checked,
                    "drums": document.getElementById("drums").checked,
                    "harp": document.getElementById("harp").checked,
                    "guitar": document.getElementById("guitar").checked,
                    "bass": document.getElementById("bass").checked
                },
                "encoding": enc,
                "temperature":parseFloat(document.getElementById("temperature").value),
                "truncation":parseFloat(document.getElementById("truncation").value),
                "generationLength":parseFloat(document.getElementById("generationLength").value),
                "audioFormat": "ogg"
            })
        }).then(res => res.json()).then(function (response) {
            //need to convert from dataURI to blob to avoid firefox issue
            var format = "audio/mp3";
            var audioKey = "audioFile";
            if (response.completions[0].oggFile) {
                format = "audio/ogg";
                audioKey = "oggFile";
            }
    
    
            
    
            // add 4 children nodes to node
    
            let url1 = URL.createObjectURL(new Blob([convertDataURIToBinary("data:"+format+";base64,"+response.completions[0][audioKey].substring(2,response.completions[0][audioKey].length-1))], {type : format}));
            let url2 = URL.createObjectURL(new Blob([convertDataURIToBinary("data:"+format+";base64,"+response.completions[1][audioKey].substring(2,response.completions[1][audioKey].length-1))], {type : format}));
            let url3 = URL.createObjectURL(new Blob([convertDataURIToBinary("data:"+format+";base64,"+response.completions[2][audioKey].substring(2,response.completions[2][audioKey].length-1))], {type : format}));
            let url4 = URL.createObjectURL(new Blob([convertDataURIToBinary("data:"+format+";base64,"+response.completions[3][audioKey].substring(2,response.completions[3][audioKey].length-1))], {type : format}));
            
            let encoding1 = response.completions[0].encoding;
            let encoding2 = response.completions[1].encoding;
            let encoding3 = response.completions[2].encoding;
            let encoding4 = response.completions[3].encoding;
    
            let totalTime1 = response.completions[0].totalTime;
            let totalTime2 = response.completions[1].totalTime;
            let totalTime3 = response.completions[2].totalTime;
            let totalTime4 = response.completions[3].totalTime;
    
            let id1 = Math.round(Math.random() * 999999);
            let id2 = Math.round(Math.random() * 999999);
            let id3 = Math.round(Math.random() * 999999);
            let id4 = Math.round(Math.random() * 999999);
    
            encodingIdMap.set(id1, encoding1);
            encodingIdMap.set(id2, encoding2);
            encodingIdMap.set(id3, encoding3);
            encodingIdMap.set(id4, encoding4);
    
            timingMap.set(id1, totalTime1);
            timingMap.set(id2, totalTime2);
            timingMap.set(id3, totalTime3);
            timingMap.set(id4, totalTime4);
            

            if(!parentMap.get(parent)) parentMap.set(parent, []);
            parentMap.get(parent).push(id1);
            parentMap.get(parent).push(id2);
            parentMap.get(parent).push(id3);
            parentMap.get(parent).push(id4);

            // send window.play parents duration so it knows where to start from
    
            let startTime = 0;
            if(node.duration) startTime = node.duration - 2;
    
            let nodeDuration1 = totalTime1 - startTime;
            let nodeDuration2 = totalTime2 - startTime;
            let nodeDuration3 = totalTime3 - startTime;
            let nodeDuration4 = totalTime4 - startTime;
    
            let timeDisplay1 = `${nodeDuration1.toFixed(2)}s / ${totalTime1.toFixed(2)}s`;
            let timeDisplay2 = `${nodeDuration2.toFixed(2)}s / ${totalTime2.toFixed(2)}s`;
            let timeDisplay3 = `${nodeDuration3.toFixed(2)}s / ${totalTime3.toFixed(2)}s`;
            let timeDisplay4 = `${nodeDuration4.toFixed(2)}s / ${totalTime4.toFixed(2)}s`;
            
            let n1 = {
                innerHTML: `<div id="${id1}" class="stack"><div class="row"><p>${timeDisplay1}</p><p></p></div><button class="play" onclick="window.play('${url1}', ${id1}, ${startTime})" >Play</button><button class="extend" onclick="window.extend(${id1})">Extend</button><button class="extend2" onclick="window.extend2(${id1})">Nearest</button><div class="row2"><button class="download" onclick="window.downloadMidi(${id1})" >MIDI</button><button class="download2" onclick="window.downloadMp3('${url1}')" >MP3</button></div><input value="${encoding1}"></input></div>`,
                duration: totalTime1,
                children: [],
            };
            let n2 = {
                innerHTML: `<div id="${id2}" class="stack"><div class="row"><p>${timeDisplay2}</p><p></p></div><button class="play" onclick="window.play('${url2}', ${id2}, ${startTime})">Play</button><button class="extend" onclick="window.extend(${id2})">Extend</button><button class="extend2" onclick="window.extend2(${id2})">Nearest</button><div class="row2"><button class="download" onclick="window.downloadMidi(${id2})" >MIDI</button><button class="download2" onclick="window.downloadMp3('${url2}')" >MP3</button></div><input value="${encoding2}"></input></div>`,
                duration: totalTime2,
                children: [],
            };
            let n3 = {
                innerHTML: `<div id="${id3}" class="stack"><div class="row"><p>${timeDisplay3}</p><p></p></div><button class="play" onclick="window.play('${url3}', ${id3}, ${startTime})">Play</button><button class="extend" onclick="window.extend(${id3})">Extend</button><button class="extend2" onclick="window.extend2(${id3})">Nearest</button><div class="row2"><button class="download" onclick="window.downloadMidi(${id3})" >MIDI</button><button class="download2" onclick="window.downloadMp3('${url3}')" >MP3</button></div><input value="${encoding3}"></input></div>`,
                duration: totalTime3,
                children: [],
            };
            let n4 = {
                innerHTML: `<div id="${id4}" class="stack"><div class="row"><p>${timeDisplay4}</p><p></p></div><button class="play" onclick="window.play('${url4}', ${id4}, ${startTime})">Play</button><button class="extend" onclick="window.extend(${id4})">Extend</button><button class="extend2" onclick="window.extend2(${id4})">Nearest</button><div class="row2"><button class="download" onclick="window.downloadMidi(${id4})" >MIDI</button><button class="download2" onclick="window.downloadMp3('${url4}')" >MP3</button></div><input value="${encoding4}"></input></div>`,
                duration: totalTime4,
                children: [],
            };
            
    
            nodeIdMap.set(id1, n1);
            nodeIdMap.set(id2, n2);
            nodeIdMap.set(id3, n3);
            nodeIdMap.set(id4, n4);
    
            node.children.push(n1);
            node.children.push(n2);
            node.children.push(n3);
            node.children.push(n4);
    
            generate();
    
            ding.play();
            $("html").css("cursor", "unset");
            $(".controller").css("opacity", "1");
    
            extendElement.css("cursor", "pointer");
            extendElement.css("opacity", "1");

            resolve({
                encoding: enc,
                nodes: [{
                    id: id1,
                    encoding: encoding1
                }, {
                    id: id2,
                    encoding: encoding2
                }, {
                    id: id3,
                    encoding: encoding3
                }, {
                    id: id4,
                    encoding: encoding4
                }]
            });
        }).catch(error => {
            ding.play();
            $("html").css("cursor", "unset");
            $(".controller").css("opacity", "1");
            extendElement.css("cursor", "pointer");
            extendElement.css("opacity", "1");
            resolve(false);
            throw error;
        });
    });
}

const generate = () => {
    window._chart = chart = new Treant({
        chart: {
            container: "#tree-simple",
            node: {
                HTMLclass: "museNode",
                collapsable: true,
            },
            levelSeparation: 100,
            siblingSeparation: 50,
            // connectors: "curve",
        },
        
        nodeStructure: nodes,
    }, () => {
        console.log("Tree view has been updated...");

        setTimeout(() => {
            for(let [id, data] of parentSimilatiry) {
                let isBest = data.best;
                let value = data.value;
    
                $($(`#${id} .row p`)[1]).text(value.toFixed(2));
                if(isBest) {
                    $(`#${id}`).parent().css("background-color", "rgba(0, 255, 0, 0.2)");
                } else {
                    // set percentage green based on value
                    let green = Math.floor(value * 255);
                    $(`#${id}`).parent().css("background-color", `rgba(0, ${green}, 0, 0.2)`);
                }
            }
        }, 1000);
        // loop all parentSimilarity Map
    }, $);
}


const nodeHTML = `<div class="stack"><p>#1</p><button>Play</button><button>Delete</button><button>Extend</button></div>`;