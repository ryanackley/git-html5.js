
define(['formats/pack', 'utils/misc_utils'], function(Pack, utils){
  var parse = function(arraybuffer, repo, success) {
    var data   = new Uint8Array(arraybuffer);//new BinaryFile(binaryString);
    var offset = 0;
    var remoteLines = null;
    var objects = null;
    
    var peek = function(length) {
      return Array.prototype.slice.call(data, offset, offset + length);
    };
    
    var advance = function(length) {
      offset += length;
    };
    
    // A pkt-line is defined in http://git-scm.com/gitserver.txt
    var nextPktLine = function() {
      var pktLine = null;
      var length;
      length = parseInt(utils.bytesToString(peek(4)), 16);
      advance(4);
      if (length == 0) {
      //   return nextPktLine()
      } else {
        pktLine = peek(length - 4);
        advance(length - 4);
      }
      return pktLine;
    };

    console.log("Parsing upload pack of  " + arraybuffer.byteLength + " bytes")
    var startTime = new Date()
    var pktLine = nextPktLine()
    var packFileParser
    var remoteLine = ""
    var packData = ""
    var gotAckOrNak = false
    var ackRegex = /ACK ([0-9a-fA-F]{40}) common/;
    var common = [];
    
    var pktLineStr = utils.bytesToString(pktLine);
    while (pktLineStr.slice(0, 7) === "shallow") {
      pktLine = nextPktLine()
    }
    
    while (pktLineStr === "NAK\n" || 
            pktLineStr.slice(0, 3) === "ACK") {
      var matches = ackRegex.exec(pktLineStr);
      if (matches){
      	common.push(matches[1]);
      }
      pktLine = nextPktLine();
      pktLineStr = utils.bytesToString(pktLine);
      gotAckOrNak = true;
    }
    
    if (!gotAckOrNak) {
      throw(Error("got neither ACK nor NAK in upload pack response"))
    }
    
    while (pktLine !== null) {
      // sideband format. "2" indicates progress messages, "1" pack data
      if (pktLine[0] == 2) {
        var lineString = utils.bytesToString(pktLine)
        lineString = lineString.slice(1, lineString.length)
        remoteLine += lineString
      }
      else if (pktLine[0] == 1) {
        packData += utils.bytesToString(pktLine.slice(1))
      }
      else if (pktLine[0] == 3) {
        throw(Error("fatal error in packet line"))
      }
      pktLine = nextPktLine()
    }
    
    packFileParser = new Pack(packData, repo)
    packData = null;
    data = null;
    binaryString = null;
    packFileParser.parseAll(function(){
    	objects = packFileParser.getObjects()
          
		/*remoteLines = []
		var newLineLines = remoteLine.split("\n")
		for (var i = 0; i < newLineLines.length; i++) {
		  var crLines = newLineLines[i].split("\r")
		  var newRemoteLine = crLines[crLines.length - 1]
		  if (newRemoteLine !== "") {
			remoteLines.push(newRemoteLine)
		  }
		}*/
		console.log("took " + (new Date().getTime() - startTime.getTime()) + "ms")
		success(objects, packFileParser.getData(), common);
    });
    
  };
  return {parse : parse};
});

