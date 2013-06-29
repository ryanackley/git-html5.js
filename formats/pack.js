

define(['objectstore/delta', 'utils/misc_utils', 'utils/file_utils'], function(applyDelta, utils, fileutils){
  
  String.prototype.rjust = function( width, padding ) {
    padding = padding || " ";
    padding = padding.substr( 0, 1 );
    if( this.length < width )
      return padding.repeat( width - this.length ) + this;
    else
      return this.toString();
  }
  String.prototype.repeat = function( num ) {
    for( var i = 0, buf = ""; i < num; i++ ) buf += this;
    return buf;
  }

  var Pack = function(binary, store) {
    //var binaryString = Git.toBinaryString(binary)
    var data;
    if  (binary.constructor == String)
    	data = new Uint8Array(utils.stringToBytes(binary));//new BinaryFile(binaryString)
    else
    	 data = new Uint8Array(binary);//new BinaryFile(binaryString)
    var offset = 0
    var objects = null

    //var lastObjectData = null;
    //var chainCache = {};
   this.getData = function(){
   	return data;
   }
    
    //if (typeof require === "undefined") {
      var myDebug = function(obj) { console.log(obj) }
    //}
    //else {
    //  var myDebug = require('util').debug
    //}
    
    var peek = function(length) {
      return data.subarray(offset, offset + length)
    }
    
    var rest = function() {
      return data.subarray(offset)
    }
    
    var advance = function(length) {
      offset += length
    }
    
    var matchPrefix = function() {
      if (utils.bytesToString(peek(4)) === "PACK") {
        advance(4)
      }
      else {
        throw(Error("couldn't match PACK"))
      }
    }
    
    var matchVersion = function(expectedVersion) {
      var actualVersion = peek(4)[3]
      advance(4)
      if (actualVersion !== expectedVersion) {
        throw("expected packfile version " + expectedVersion + ", but got " + actualVersion)
      }
    }
    
    var matchNumberOfObjects = function() {
      var num = 0
      _(peek(4)).each(function(b) {
        num = num << 8
        num += b
      })
      advance(4);
      return num;
    }
    
    var objectSizeInfosToSize = function(sizeInfos) {
      var current = 0,
          currentShift = 0,
          i,
          sizeInfo;
          
      for (i = 0; i < sizeInfos.length; i++) {
        sizeInfo = sizeInfos[i]
        current += (parseInt(sizeInfo, 2) << currentShift)
        currentShift += sizeInfo.length
      }
      return current
    }
    
    var getType = function(typeStr) {
      return {
        "001":"commit",
        "010":"tree",
        "011":"blob",
        "100":"tag",
        "110":"ofs_delta",
        "111":"ref_delta"
        }[typeStr]
    }
      
    var matchObjectHeader = function() {
      var sizeInfos       = []
      var hintTypeAndSize = peek(1)[0].toString(2).rjust(8, "0")
      var typeStr         = hintTypeAndSize.slice(1, 4)
      var needMore        = (hintTypeAndSize[0] == "1")
      var hintAndSize     = null
      var objectStartOffset = offset
      
      sizeInfos.push(hintTypeAndSize.slice(4, 8))
      advance(1)

      while (needMore) {
        hintAndSize = peek(1)[0].toString(2).rjust(8, "0")
        needMore    = (hintAndSize[0] == "1")
        sizeInfos.push(hintAndSize.slice(1))
        advance(1)
      }
      return {size:objectSizeInfosToSize(sizeInfos), type:getType(typeStr), offset: objectStartOffset}
    }
    
   
    
    var intToBytes = function(val, atLeast) {
      var bytes = []
      var current = val
      while (current > 0) { 
        bytes.push(current % 256)
        current = Math.floor(current / 256)
      }
      while (atLeast && bytes.length < atLeast) {
        bytes.push(0)
      }
      return bytes.reverse()
    }
    
    var matchBytes = function(bytes) {
      var i
      var nextByte
      for (i = 0; i < bytes.length; i++) {
        nextByte = peek(1)[0]
        if (nextByte !== bytes[i]) {
          throw(Error("adler32 checksum didn't match"))
        }
        advance(1)
      }
    }
    
    var advanceToBytes = function(bytes) {
      var nextByte
      var matchedByteCount = 0
      while (matchedByteCount < bytes.length) {
        nextByte = peek(1)[0]
        if (nextByte == bytes[matchedByteCount]) {
          matchedByteCount++
        } else {
          matchedByteCount = 0
        }
        advance(1)
      }
    }
    
    var objectHash = function(type, content) {
      var contentData = new Uint8Array(content);
      var data = utils.stringToBytes(type + " " + contentData.byteLength + "\0");
      var buf = new ArrayBuffer(data.length + contentData.byteLength);
      var fullContent = new Uint8Array(buf);
      fullContent.set(data);
      fullContent.set(contentData, data.length);
      // return new SHA1(data).hexdigest()
      return Crypto.SHA1(fullContent, {asBytes:true});
    }
    
    var findDeltaBaseOffset = function(header){
    	var offsetBytes       = []
      var hintAndOffsetBits = peek(1)[0].toString(2).rjust(8, "0")
      var needMore          = (hintAndOffsetBits[0] == "1")
      
      offsetBytes.push(hintAndOffsetBits.slice(1, 8))
      advance(1)

      while (needMore) {
        hintAndOffsetBits = peek(1)[0].toString(2).rjust(8, "0")
        needMore          = (hintAndOffsetBits[0] == "1")
        offsetBytes.push(hintAndOffsetBits.slice(1, 8))
        advance(1)
      }
      
      var longOffsetString = _(offsetBytes).reduce(function(memo, byteString) {
        return memo + byteString
      }, "")
      
      var offsetDelta = parseInt(longOffsetString, 2)
      var n = 1
      _(offsetBytes.length - 1).times(function() {
        offsetDelta += Math.pow(2, 7*n)
        n += 1
      })
      var desiredOffset = header.offset - offsetDelta
      return desiredOffset;
    }
    
    var matchOffsetDeltaObject = function(header, dataType, success) {
    	
      
      //var baseObject = getObjectAtOffset(desiredOffset)
      
      var expandDelta = function(baseData, baseObject){
      	var dataOffset = offset; 
  		uncompressObject(dataOffset, "ArrayBuffer", function(buf, compressedLength){
  			
  			//var checksum = adler32(buf)
  			advance(compressedLength)
  			
  			//matchBytes(intToBytes(checksum, 4))
  			
  			
  			var deltaObject = {
  			  type: header.type,
  			  //dataOffset: dataOffset,
  			  //crc: crc32.crc(data.subarray(header.offset, offset)),
  			  //desiredOffset: desiredOffset,
  			  offset: header.offset
  			  //chain:[]
  			}
  	
  		
  			//var buf = reader.result;
  			expandOffsetDelta(baseObject, deltaObject, new Uint8Array(baseData), new Uint8Array(buf), dataType, function(expandedData){
  				success(deltaObject, offset);
  			});
  		});
      }
      
      if (header.type == "ofs_delta"){
      	var desiredOffset = findDeltaBaseOffset(header);
  		var oldOffset = offset;
  		matchObjectAtOffset(desiredOffset, "ArrayBuffer", function(baseObject){
  			offset = oldOffset;
  			expandDelta(baseObject.data, baseObject);
  		});
  	}
      else{
      	var shaBytes = peek(20)
        	advance(20)
        	var sha = _(shaBytes).map(function(b) { return b.toString(16).rjust(2, "0")}).join("")
        
      	store._retrieveRawObject(sha, 'ArrayBuffer', function(baseObject){
      		baseObject.sha = sha;
      		expandDelta(baseObject.data, baseObject);
      	});
      }
      
      /*if (chainCache[desiredOffset]){
  		
  	}
  	else{
  		uncompressObject(baseObject.dataOffset, function(buf){
  			expandDelta(new Uint8Array(buf));
  		});
  	
  	}*/
  		
  		
  		
      
    }
    
    var uncompressObject = function(objOffset, dataType, callback){
    	var deflated = data.subarray(objOffset);
      var out = utils.inflate(deflated);
      if (dataType != 'ArrayBuffer'){
        var reader = new FileReader();
      
        reader.onloadend = function(){
         var buf = reader.result;
          
         callback(buf, out.compressedLength);
        }
        reader['readAs' + dataType](new Blob([out]));
      }
      else{
        callback(utils.trimBuffer(out), out.compressedLength);
      }
      // var blob = RawDeflate.inflate(deflated)
      // var reader = new FileReader();
      
      // reader.onloadend = function(){
      // 	var buf = reader.result;
      	
      // 	callback(buf, blob.compressedLength);
      // }
      // reader['readAs' + dataType](blob);
    }
    
    var matchNonDeltaObject = function(header, dataType, success) {
      var dataOffset = offset;
      uncompressObject(dataOffset, dataType, function(buf, compressedLength){
      	
      	//var checksum = adler32(buf)
  		advance(compressedLength);
  		//matchBytes(intToBytes(checksum, 4))
  		
  		success({
  		  offset: header.offset,
  		  //dataOffset: dataOffset,
  		  //crc: crc32.crc(data.subarray(header.offset, offset)),
  		  type: header.type,
  		  //sha: objectHash(header.type, buf),
  		  data: buf
  		},offset);
      });
      
    }
    
    var matchObjectData = function(header, dataType, success) {
      if (header.type == "ofs_delta" || header.type == "ref_delta") {
        matchOffsetDeltaObject(header, dataType, success)
      }
      /*else if () {
        var shaBytes = peek(20)
        advance(20)
        var sha = _(shaBytes).map(function(b) { return b.toString(16).rjust(2, "0")}).join("")
        throw(Error("found ref_delta"))
      }*/
      else {
        matchNonDeltaObject(header, dataType, success)
      }
    }
    
    var matchObjectAtOffset = function(startOffset, dataType, success) {
      offset = startOffset
      var header = matchObjectHeader()
      return matchObjectData(header, dataType, success)
    }
    
    var stripOffsetsFromObjects = function() {
      _(objects).each(function(object) {
        delete object.offset
      })
    }
    
    var objectAtOffset = function(offset) {
      return _(objects).detect(function(obj) { return obj.offset == offset })
    }
    
    var expandOffsetDeltas = function(callback) {
      var progress = {counter:0}
      function markProgress(){
      	progress.counter += 1;
      	if (progress.counter == objects.length){
      		callback();
      	}
      }
      _(objects).each(function(object) {
  		if (object.type != "ofs_delta" && object.chain.length) {
  		  expandOffsetDelta(object, markProgress)
  		}
  		else{
  			markProgress();
  		}
      })
    }
    
    //var expandDelta = function(object) {
      
    //}
    
    var getObjectAtOffset = function(offset) {
      if (objects) {
        return objectAtOffset(offset)
      }
      var rawObject = matchObjectAtOffset(offset)
      expandDelta(rawObject)
      var newObject = Git.objects.make(rawObject.sha, rawObject.type, rawObject.data)
      return newObject
    }
    
    var expandOffsetDelta = function(baseObject, object, baseObjectData, objectData, dataType, callback) {
      
        applyDelta(baseObjectData, objectData, dataType, function(expandedData){
  		  object.type = baseObject.type
  		  delete object.desiredOffset
  		  object.data = expandedData
  		  
  		  if (dataType == 'ArrayBuffer')
  		  	object.sha = objectHash(object.type, object.data)
  		 
  		  callback(expandedData);
        });
      
    }
    
    this.matchObjectAtOffset = matchObjectAtOffset;
    
    this.parseAll = function(success) {
      try {
        var numObjects
        var i
        objects = []
        var progressCounter = {objectCount:0};
        
        matchPrefix()
        matchVersion(2)
        numObjects = matchNumberOfObjects()
        
        var findNextOrQuit = function(object, nextOffset){
          var dataArray = new Uint8Array(object.data);
          object.crc = crc32.crc(data.subarray(object.offset, nextOffset));
  		object.sha = objectHash(object.type, object.data);
          delete object.data;
  		objects.push(object);
  		
  		progressCounter.objectCount++;
  		if (numObjects == progressCounter.objectCount){
  			 //write out pack file
  			 success();
  			
  		}
  		else{
  			matchObjectAtOffset(nextOffset, 'ArrayBuffer', findNextOrQuit);
  		}
  	 }
        
        //for (i = 0; i < numObjects; i++) {
        matchObjectAtOffset(offset, 'ArrayBuffer', findNextOrQuit);
        //}
       
      }
      catch(e) {
        console.log("Error caught in pack file parsing data") // + Git.stringToBytes(data.getRawData()))
        throw(e)
      }
      return this
    }
    
    this.getObjects = function() {
      return objects
    }
    
    this.getObjectAtOffset = getObjectAtOffset
  }

  Pack.buildPack = function(heads, repo, callback){
  	var visited = {};
  	var counter = {x:0, numObjects:0};
  	var packed = [];//new BlobBuilder();
  	
  	var map = 
  	  {
  	  "commit" : 1,
        "tree": 2,
        "blob": 3
        };
  	
  	var packTypeSizeBits = function(type, size){
  	 	var typeBits = map[type];
  	 	var shifter = size;
  	 	var bytes = [];
  	 	var idx = 0;
  	 	
  	 	bytes[idx] = typeBits << 4 | (shifter & 0xf);
  	 	shifter = shifter >>> 4;
  	 	
  	 	while(shifter != 0){
  	 		bytes[idx] = bytes[idx] | 0x80;
  	 		bytes[++idx] = shifter & 0x7f;
  	 		shifter = shifter >>> 7;
  	 	}
  	 	return new Uint8Array(bytes);
  	}
  	
  	var packIt = function(object){
  		var compressed;
  		var size;
  		var type = object.type;
  		
  		if (object.compressedData){
  			size = object.size;
  			// clone the data since it may be sub view of a larger buffer;
  			compressed = new Uint8Array(compressedData).buffer;
  		}
  		else{
  			var buf = object.data;
  			var data;
  			if (buf instanceof ArrayBuffer){
  				data = new Uint8Array(buf);
  			}
  			else if (buf instanceof Uint8Array){
  				data = buf;
  			}
  			else{
  				// assume it's a string
  				data = utils.stringToBytes(buf);
  			}

  			compressed = utils.deflate(data);
  			size = data.length;
  		}
  		packed.push(packTypeSizeBits(type, size));
  		packed.push(compressed);
  		counter.numObjects++;
  	}
  	
  	var finishPack = function(){
  		var packedObjects = [];//new BlobBuilder();
  		
  		var buf = new ArrayBuffer(12);
  		var dv = new DataView(buf);
  		
  		// 'PACK'
  		dv.setUint32(0, 0x5041434b, false);
  		// version
  		dv.setUint32(4, 2, false);
  		//number of packed objects
  		dv.setUint32(8, counter.numObjects, false);
  		
  		//finalPack.append(buf);
  		//finalPack.append(packedObjects);
  		packedObjects.push(dv);
      //packed.reverse();
  		for (var i = 0; i < packed.length; i++){
  			packedObjects.push(packed[i]);
  		}
  		//packed.getBlob();
  		fileutils.readBlob(new Blob(packedObjects), 'ArrayBuffer', function(dataBuf){
  			packed = null;
        var dataBufArray = new Uint8Array(dataBuf);
  			var sha = Crypto.SHA1(dataBufArray, {asBytes:true});
  			
  			var finalPack = [];//new BlobBuilder();
  			finalPack.push(dataBufArray);
  			finalPack.push(new Uint8Array(sha));
  			
  			fileutils.readBlob(new Blob(finalPack), 'ArrayBuffer', callback);		
  		});
  		//fr.readAsArrayBuffer(finalBlob);
  		//fileutils.readBlob(finalPack.getBlob(), 'ArrayBuffer', function(dataBuf){
  		//	var sha = Crypto.SHA1(new Uint8Array(dataBuf), {asBytes:true});
  			/*finalPack.append(new Uint8Array(sha).buffer);
  			
  			fileutils.readBlob(finalPack.getBlob(), 'ArrayBuffer', function(dataBuf){
  				callback(dataBuf);
  			});*/
  		//});
  		
  	}
  	
  	var walkTree = function(treeSha, callback){
  		if (visited[treeSha]){
  			callback();
  			return;
  		}else{
  			visited[treeSha] = true;
  		}
  		
  		repo._retrieveObject(treeSha, 'Tree', function(tree, rawObj){
  			var childCount = {x:0};
  			var handleCallback = function(){
  				childCount.x++;
  				if (childCount.x == tree.entries.length){
  					packIt(rawObj);
  					callback();
  				}
  			}
  			
  			for (var i = 0; i < tree.entries.length; i++){
  				var nextSha = utils.convertBytesToSha(tree.entries[i].sha);
  				if (tree.entries[i].isBlob){
  					if (visited[nextSha]){
  						handleCallback();
  					}else{
  						visited[nextSha] = true;
  						repo._retrieveRawObject(nextSha, 'Raw', function(object){
  							packIt(object);
  							handleCallback();
  						});
  					}
  				}
  				else{
  					walkTree(nextSha, function(){
  						handleCallback();
  					});
  				}
  			}
  		});
  	}
  	
  	for (var name in heads){
  	    var commits = heads[name];
  	   	commits.forEach(function(commitObj){
  			//repo._retrieveObject(commitShas[i], 'Commit', function(commit, rawObj){
  			var commit = commitObj.commit;
  			walkTree(commit.tree, function(){
  				packIt(commitObj.raw);
  				if (++counter.x == commits.length){
  					finishPack();
  				}
  			});
  			//});
  		});
  	}
  }
  return Pack;
});
