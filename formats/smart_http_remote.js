
Git.SmartHttpRemote = function(repo, name, repoUrl) {
  Git.Remote.apply(this, [repo, name, repoUrl])
  
  this.fetchRefs = function(callback) {
    var remote = this
    $.get(
      this.makeUri('/info/refs', {service: "git-upload-pack"}),
      "",
      function(data) {
        var discInfo = Git.SmartHttpRemote.parseDiscovery(data)
        var i, ref
        for (i = 0; i < discInfo.refs.length; i++) {
          ref = discInfo.refs[i]
          remote.addRef(ref.name, ref.sha)
        }
        if (callback != "undefined") {
          callback(discInfo.refs)
        }
      }
    )
  }
  
  this.fetchReceiveRefs = function(callback) {
    var remote = this
    $.get(
      this.makeUri('/info/refs', {service: "git-receive-pack"}),
      "",
      function(data) {
        var discInfo = Git.SmartHttpRemote.parseDiscovery(data)
        var i, ref
        for (i = 0; i < discInfo.refs.length; i++) {
          ref = discInfo.refs[i]
          remote.addRef(ref.name, ref.sha)
        }
        if (callback != "undefined") {
          callback(discInfo.refs)
        }
      }
    )
  }
  
  this.fetchRef = function(wantRefs, haveRefs, moreHaves, callback) {
    var url = this.makeUri('/git-upload-pack')
    var body = Git.SmartHttpRemote.refWantRequest(wantRefs, haveRefs)
    var thisRemote = this
    $.ajax({
      url: url,
      data: body,
      type: "POST",
      contentType: "application/x-git-upload-pack-request",
      beforeSend: function(xhr) {
        xhr.overrideMimeType('text/plain; charset=x-user-defined')
      },
      success: function(data, textStatus, xhr) {
        var binaryData = xhr.responseText
        if (haveRefs && binaryData.indexOf("NAK") == 4){
        	if (moreHaves){
				thisRemote.repo._getCommitGraph(moreHaves, 32, function(commits, next){
					thisRemote.fetchRef(wantRefs, commits, next, callback);
				});
			}
        }
        else{
			var parser = new Git.UploadPackParser(binaryData, repo)
			parser.parse(function(objects, packData, common){
				if (callback != "undefined") {
				  callback(objects, packData, common);
				}
			});
		 }        
      },
      error: function(xhr, data, e) {
        Git.displayError("ERROR Status: " + xhr.status + ", response: " + xhr.responseText)
      }
    });
  },
  
  this.pushRefs = function(refPaths, packData, success,error){
  	var url = this.makeUri('/git-receive-pack');
  	var body = Git.SmartHttpRemote.pushRequest(refPaths, packData);
  	var xhr = new XMLHttpRequest();
	xhr.open("POST", url, true);
	xhr.onreadystatechange = function(evt){
		if (xhr.readyState == 4){
			if (xhr.status == 200){
				success();
			}
			else{
				if (error){
					error();
				}
				console.log('error pushing pack');
			}
		}
	}
	xhr.setRequestHeader('Content-Type', 'application/x-git-receive-pack-request');
	xhr.send(body);
	/*Gito.FileUtils.readBlob(body, 'BinaryString', function(strData){
  		$.ajax({
  			url : url,
  			data : strData,
  			type : 'POST',
  			contentType : 'application/x-git-receive-pack-request',
  			processData : false,
  			//mimeType :'text/plain; charset=x-user-defined',
		  	success : function(data, textstatus, xhr){
		  		var x = 0;
		  	},
		  	error : function (xhr, data, e){
		  		Git.displayError("ERROR Status: " + xhr.status + ", response: " + xhr.responseText)
		  	}
  		});
  	});*/
  }
  
}

// Parses the response to /info/refs?service=git-upload-pack, which contains ids for
// refs/heads and a capability listing for this git HTTP server.
//
// Returns {capabilities:"...", refs: [{name:"...", sha:"..."}, ...]}
Git.SmartHttpRemote.parseDiscovery = function(data) {
  var lines = data.split("\n")
  var result = {"refs":[]}
  for ( i = 1; i < lines.length - 1; i++) {
    thisLine = lines[i]
    if (i == 1) {
      var bits = thisLine.split("\0")
      result["capabilities"] = bits[1]
      var bits2 = bits[0].split(" ")
      result["refs"].push({name:bits2[1], sha:bits2[0].substring(8)})
    }
    else {
      var bits2 = thisLine.split(" ")
      result["refs"].push({name:bits2[1], sha:bits2[0].substring(4)})
    }
  }
  return result
}


Git.SmartHttpRemote.pushRequest = function(refPaths, packData){
    var padWithZeros = function(num){
    	var hex = num.toString(16);
    	var pad = 4 - hex.length;
    	for (x = 0; x < pad; x++){
    		hex = '0' + hex;
    	}
    	return hex;
    }
    
    var pktLine = function(refPath){
    	return refPath.sha + ' ' + refPath.head + ' ' + refPath.name; 
    }
	var bb = [];//new BlobBuilder();
	var str = pktLine(refPaths[0]) + '\0report-status\n';
	str = padWithZeros(str.length + 4) + str;
	bb.push(str);
	for (var i = 1; i < refPaths.length; i++){
	  if (!refPaths[i].head) continue;
		var val = pktLine(refPaths[i])  + '\n';
		val = padWithZeros(val.length + 4)
		bb.push(val);
	}
	bb.push('0000');
	bb.push(packData);
	var blob = new Blob(bb);
	return blob;
	
}
// Constructs the body of a request to /git-upload-pack, specifying a ref
// we want and a bunch of refs we have.
//
// Returns a String
Git.SmartHttpRemote.refWantRequest = function(wantRefs, haveRefs, moreHaves) {
  var str = "0067want " + wantRefs[0].sha + " multi_ack_detailed side-band-64k thin-pack ofs-delta\n"
  for (var i = 1; i < wantRefs.length; i++){
  	str += "0032want " + wantRefs[i].sha + "\n" 
  }
  str += "0000"
  if (haveRefs && haveRefs.length){
	  _(haveRefs).each(function(haveRef) {
		str += "0032have " + haveRef.sha + "\n"
	  });
	  if (moreHaves){
  	  	str += "0000"
  	  }
  	  else{
  	  	str += "0009done\n"
  	  }
  	  
  }
  else{
  	str += "0009done\n"
  }
  return str
}









