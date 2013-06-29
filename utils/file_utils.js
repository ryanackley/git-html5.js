
define(['utils/misc_utils'], function(utils){
	Array.prototype.asyncEach = function(func, callback){
		if (this.length == 0){
			callback();
			return;
		}
		var list = this,
		    counter = {x:0, end:list.length};
		
		var finish = function(){
			counter.x += 1;
			if (counter.x == counter.end){
				callback();
			}
		}
		
		for (var i = 0; i < list.length; i++){
			func.call(list, list[i], finish, i);
		}
	}

	var FileUtils = (function(){
		
		var toArray = function(list) {
			return Array.prototype.slice.call(list || [], 0);
		}
		
		
		var makeFile = function(root, filename, contents, callback){
			root.getFile(filename, {create:true}, function(fileEntry){
				fileEntry.createWriter(function(writer){
					writer.onwriteend = function(){
						if (callback)
							callback();
					}
					if (contents instanceof ArrayBuffer){
						contents = new Uint8Array(contents);
					}
					writer.write(new Blob([contents]));
				});
			});
		}
		
		var makeDir = function(root, dirname, callback){
			root.getDirectory(dirname, {create:true},callback);
		}
		
		return {
			mkdirs : function(root, dirname, callback){
				var pathParts;
				if (dirname instanceof Array){
					pathParts = dirname;
				}
				else{
					pathParts = dirname.split('/');
				}
				
				var makeDirCallback = function(dir){
					if (pathParts.length){
						makeDir(dir, pathParts.shift(), makeDirCallback);
					}
					else{
						if (callback)
							callback(dir);
					}
				}
				makeDirCallback(root);
			},
			rmDir : function (root, dirname, callback){
				root.getDirectory(dirname, {create:true}, function(dirEntry){
					dirEntry.removeRecursively(callback, utils.errorHandler);
				});
			},
			rmFile : function(root, filename, callback){
				root.getFile(filename, {create:true}, function(fileEntry){
					fileEntry.remove(callback, utils.errorHandler);
				});
			},
			mkfile : function(root, filename, contents, callback){
				if (filename.charAt(0) == '/'){
					filename = filename.substring(1);
				}
				var pathParts = filename.split('/');
				if (pathParts.length > 1){
					FileUtils.mkdirs(root, pathParts.slice(0, pathParts.length - 1), function(dir){
						makeFile(dir, pathParts[pathParts.length - 1], contents, callback);
					});
				}
				else{
					makeFile(root, filename, contents, callback);
				}
			},
			ls: function(dir, callback){
				var reader = dir.createReader();
				var entries = [];
				
				var readEntries = function() {
					reader.readEntries (function(results) {
						if (!results.length) {
							callback(entries);
						} else {
							entries = entries.concat(toArray(results));
							readEntries();
						}
					}, function(){});
				}
				readEntries();
				
			},
			readBlob: function(blob, dataType, callback){
				var reader = new FileReader();
				reader.onloadend = function(e){
					callback(reader.result);
				}
				reader["readAs" + dataType](blob);
			},
			readFileEntry : function(fileEntry, dataType, callback){
				fileEntry.file(function(file){
					FileUtils.readBlob(file, dataType, callback);
				});
			},
			readFile : function(root, file, dataType, callback, onerror) {
				
				root.getFile(file, {create:false}, function(fileEntry){
					FileUtils.readFileEntry(fileEntry, dataType, callback);
				}, onerror ? onerror : utils.errorHandler);
			}
		
		};
	}
	)();

	return FileUtils; 
});