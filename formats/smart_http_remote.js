

define(['formats/upload_pack_parser'], function(UploadPackParser){
  var SmartHttpRemote = function(store, name, repoUrl) {
    this.store = store;
    this.name = name;
    this.refs = {};
    this.url = repoUrl.replace(/\?.*/, "").replace(/\/$/, "");

    var parseDiscovery = function(data) {
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

    var pushRequest = function(refPaths, packData){
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
      bb.push(new Uint8Array(packData));
      var blob = new Blob(bb);
      return blob;
      
    }

    var refWantRequest = function(wantRefs, haveRefs, moreHaves) {
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

    var queryParams = function(uri) {
      var paramString = uri.split("?")[1]
      if (!paramString) {
        return {}
      }
      
      var paramStrings = paramString.split("&")
      var params = {}
      _(paramStrings).each(function(paramString) {
        var pair = paramString.split("=")
        params[pair[0]] = decodeURI(pair[1])
      })
      return params
    }

    this.urlOptions = queryParams(repoUrl);

    this.fetchRefs = function(callback) {
      var remote = this
      $.get(
        this.makeUri('/info/refs', {service: "git-upload-pack"}),
        "",
        function(data) {
          var discInfo = parseDiscovery(data)
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
          var discInfo = parseDiscovery(data)
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
      var body = refWantRequest(wantRefs, haveRefs)
      var thisRemote = this
      var xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.responseType = 'arraybuffer';
      xhr.setRequestHeader("Content-Type", "application/x-git-upload-pack-request");

      xhr.onload = function(){
        var binaryData = xhr.response;
        if (haveRefs && String.fromCharCode.apply(null, new Uint8Array(binaryData, 4, 3)) == "NAK"){
          if (moreHaves){
              thisRemote.store._getCommitGraph(moreHaves, 32, function(commits, next){
                thisRemote.fetchRef(wantRefs, commits, next, callback);
              });
          }
        }
        else{
          UploadPackParser.parse(binaryData, store, function(objects, packData, common){
            if (callback) {
              callback(objects, packData, common);
            }
          });
        }     
      }
      xhr.send(body);
     //  $.ajax({
     //    url: url,
     //    data: body,
     //    type: "POST",
     //    contentType: "application/x-git-upload-pack-request",
     //    beforeSend: function(xhr) {
     //      xhr.overrideMimeType('text/plain; charset=x-user-defined')
     //    },
     //    success: function(data, textStatus, xhr) {
     //      var binaryData = xhr.responseText
     //      if (haveRefs && binaryData.indexOf("NAK") == 4){
     //      	if (moreHaves){
  			// 	thisRemote.repo._getCommitGraph(moreHaves, 32, function(commits, next){
  			// 		thisRemote.fetchRef(wantRefs, commits, next, callback);
  			// 	});
  			// }
     //      }
     //      else{
  			// var parser = new Git.UploadPackParser(binaryData, repo)
  			// parser.parse(function(objects, packData, common){
  			// 	if (callback != "undefined") {
  			// 	  callback(objects, packData, common);
  			// 	}
  			// });
  		 // }        
     //    },
     //    error: function(xhr, data, e) {
     //      Git.displayError("ERROR Status: " + xhr.status + ", response: " + xhr.responseText)
     //    }
     //  });
    },
    
    this.pushRefs = function(refPaths, packData, success,error){
    	var url = this.makeUri('/git-receive-pack');
    	var body = pushRequest(refPaths, packData);
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

    this.makeUri = function(path, extraOptions) {
      var uri = this.url + path
      var options = _(this.urlOptions).extend(extraOptions || {})
      if (options && _(options).size() > 0) {
        var optionKeys = _(options).keys()
        var optionPairs = _(optionKeys).map(function(optionName) {
          return optionName + "=" + encodeURI(options[optionName])
        })

        return uri + "?" + optionPairs.join("&")
      }
      else {
        return uri
      }
    }

    // Add a ref to this remote. fullName is of the form:
    //   refs/heads/master or refs/tags/123
    this.addRef = function(fullName, sha) {
      var type, name
      if (fullName.slice(0, 5) == "refs/") {
        type = fullName.split("/")[1]
        name = this.name + "/" + fullName.split("/")[2]
      }
      else {
        type = "HEAD"
        name = this.name + "/" + "HEAD"
      }
      this.refs[name] = {name:name, sha:sha, remote:this, type:type}
    }
    
    this.getRefs = function() {
      return _(this.refs).values()
    }
    
    this.getRef = function(name) {
      return this.refs[this.name + "/" + name]
    }
  }
  return SmartHttpRemote;
});

