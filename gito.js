window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;

Gito = {
	convertShaToBytes : function(sha){
		var bytes = new Array(sha.length/2);
		for (var i = 0; i < sha.length; i+=2)
		{
			bytes[i/2] = parseInt('0x' + sha.substr(i, 2));
		}
		return bytes;	
	},
	convertBytesToSha : function(bytes){
		var shaChars = [];
		for (var i = 0; i < bytes.length; i++){
			var next = (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
			shaChars.push(next);
		}
		return shaChars.join('');
	},
	compareShas : function(sha1, sha2){
		for (var i = 1; i < 20; i++){
			if (sha1[i] != sha2[i]){
				return sha1[i] - sha2[i];
			}
		}
		return 0;
	},
	
	errorHandler : function(e) {
	  var msg = '';
	
	  switch (e.code) {
		case FileError.QUOTA_EXCEEDED_ERR:
		  msg = 'QUOTA_EXCEEDED_ERR';
		  break;
		case FileError.NOT_FOUND_ERR:
		  msg = 'NOT_FOUND_ERR';
		  break;
		case FileError.SECURITY_ERR:
		  msg = 'SECURITY_ERR';
		  break;
		case FileError.INVALID_MODIFICATION_ERR:
		  msg = 'INVALID_MODIFICATION_ERR';
		  break;
		case FileError.INVALID_STATE_ERR:
		  msg = 'INVALID_STATE_ERR';
		  break;
		default:
		  msg = 'Unknown Error';
		  break;
	  };
	
	  console.log('Error: ' + msg);
	}
}

String.prototype.endsWith = function(suffix){
	return this.lastIndexOf(suffix) == (this.length - suffix.length);
}

