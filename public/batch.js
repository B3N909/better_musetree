var ding = new Audio("chord.wav");
ding.volume = 0.1;


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

const extend = (encoding, parentEncoding) => {
    return new Promise(resolve => {
        let temp = document.getElementById("temperature").value;
        let trunc = document.getElementById("truncation").value;
        fetch("https://musenet.openai.com/sample", {
            "method": "POST",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": JSON.stringify({
                "genre": $("#genre").val(),
                "instrument":{
                    "piano": document.getElementById("piano").checked,
                    "strings": document.getElementById("strings").checked,
                    "winds": document.getElementById("winds").checked,
                    "drums": document.getElementById("drums").checked,
                    "harp": document.getElementById("harp").checked,
                    "guitar": document.getElementById("guitar").checked,
                    "bass": document.getElementById("bass").checked
                },
                "encoding": encoding,
                "temperature":parseFloat(temp === '' ? '1.0' : temp),
                "truncation": parseFloat(trunc === '' ? '0' : trunc),
                "generationLength":parseFloat(document.getElementById("generationLength").value),
                "audioFormat": "ogg"
            })
        }).then(res => res.json()).then(response => {
            //need to convert from dataURI to blob to avoid firefox issue
            let format = "audio/mp3";
            let audioKey = "audioFile";
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
    
            // find which encoding is most similar to parentEncoding
            let sim1 = window.stringSimilarity(parentEncoding, encoding1, 2, false);
            let sim2 = window.stringSimilarity(parentEncoding, encoding2, 2, false);
            let sim3 = window.stringSimilarity(parentEncoding, encoding3, 2, false);
            let sim4 = window.stringSimilarity(parentEncoding, encoding4, 2, false);

            let bestURL;
            let best = 0;
            let bestEncoding = "";
            let bestTotalTime;
            if(sim1 > best) {
                best = sim1;
                bestEncoding = encoding1;
                bestURL = url1;
                bestTotalTime = totalTime1;
            }
            if(sim2 > best) {
                best = sim2;
                bestEncoding = encoding2;
                bestURL = url2;
                bestTotalTime = totalTime2;
            }
            if(sim3 > best) {
                best = sim3;
                bestEncoding = encoding3;
                bestURL = url3;
                bestTotalTime = totalTime3;
            }
            if(sim4 > best) {
                best = sim4;
                bestEncoding = encoding4;
                bestURL = url4;
                bestTotalTime = totalTime4;
            }

            let doContinue = true;
            if(bestTotalTime > $("#songLength").val()) doContinue = false;

            ding.play();

            resolve({
                doContinue,
                encoding: bestEncoding, // newly generated encoding,
                parentEncoding: encoding,
                totalTime: bestTotalTime,
                url: bestURL
            });
        }).catch(error => {
            console.log("Error occured");
            $("html").css("cursor", "unset");
            $(".controller").css("opacity", "1");
            resolve(false);
            throw error;
        });
    });
}





const readMidi = (path) => {
    return new Promise(async resolve => {

        const file = await fetch(path).then(r => r.blob());
        // let file = URL.createObjectURL(blob);

        let reader = new FileReader();
        reader.readAsArrayBuffer(file);

        reader.onload = readerEvent => {
            let content = new Uint8Array(readerEvent.target.result);
            let midiData = parseMidi(content);
            // console.log(midiData);

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

            // document.getElementById("piano").checked = false;
            // document.getElementById("strings").checked = false;
            // document.getElementById("winds").checked = false;
            // document.getElementById("drums").checked = false;
            // document.getElementById("harp").checked = false;
            // document.getElementById("guitar").checked = false;
            // document.getElementById("bass").checked = false;

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
                    // document.getElementById(checkboxID).checked = true;
                }
            }

            resolve(encoded.trim());
        }
    });
}


const play = (url) => {
    if(window.isPlaying) {
        if(window.playingURL === url) {
            window.stopPlaying();
            return;
        } else {
            window.stopPlaying();
        }
    }

    const audio = new Audio(url);
    audio.load();
    audio.play();

    window.isPlaying = true;
    window.playingURL = url;
    window.stopPlaying = () => {
        audio.pause();
        window.isPlaying = false;
    }
}


window.downloadMp3 = (url) => {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    a.href = url;
    a.download = "download.mp3";
    a.click();
}

window.downloadMidi = (encoding) => {


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

$("#startGenerating").click(async () => {
    $(".controller").css("opacity", 0.2);
    $("html").css("cursor", "wait");


    const songLengthSeconds = $("#songLength").val();
    const generatePerSong = $("#generatePerSong").val();
    const song = $("#song").val();

    let songs = [];
    if(song === "all") {
        const optgroup = $($("#song optgroup")[1]);
        // loop children and append value to songs
        for(let i = 0; i < optgroup.children().length; i++) {
            songs.push(optgroup.children()[i].value);
        }
    } else {
        songs.push(song);
    }


    let inputMidis = [];
    let promises = [];
    for(let i = 0; i < songs.length; i++) {
        promises.push(readMidi(`./samples/${songs[i]}`));
    }

    const midis = await Promise.all(promises);

    for(let i = 0; i < midis.length; i++) {
        (async () => {
            for(let j = 0; j < generatePerSong; j++) {
                const element = $(`<tr>
                <td><a href="./samples/${songs[i]}">${songs[i]}</a><a style="margin-left: 25px; color: #d94a4a !important; text-decoration: none !important;" href="./raw/${songs[i]}">raw</a></td>
                <td class="length">~</td>
                <td class="actions">Generating...</td> -->
                </tr>`);
                element.appendTo("table");
                
                let encoding = midis[i];
                let parentEncoding = encoding;

                let letContinue = true;
                while(letContinue) {
                    let section = await extend(encoding, parentEncoding);
                    if(!section.doContinue) {
                        console.log("Song finished!");
                        console.log(section.url);
                        element.find(".actions").text("");
                        $(`<button onclick="play('${section.url}')">Play</button>`).appendTo(element.find(".actions"));
                        $(`<button onclick="downloadMidi('${section.encoding}')">MIDI</button>`).appendTo(element.find(".actions"));
                        $(`<button onclick="downloadMp3('${section.url}')">MP3</button>`).appendTo(element.find(".actions"));
                        letContinue = false;
                    }
                    encoding = section.encoding;
                    parentEncoding = section.parentEncoding;

                    element.find(".length").text(section.totalTime + "s");
                }
            }
        })();
    }
});