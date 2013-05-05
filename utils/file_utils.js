/*
* Copyright 2012 Ryan Ackley (ryanackley@gmail.com)
*
* This file is part of Tincr.
*
* Tincr is free software: you can redistribute it and/or
* modify it under the terms of the GNU General Public License
* as published by the Free Software Foundation; either version 2
* of the License, or (at your option) any later version.
* 
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
* 
* You should have received a copy of the GNU General Public License
* along with this program; if not, write to the Free Software
* Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
*/
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
	
	var addItem = function (item){
		counter.end += 1;
		func.call(list, item, done, addItem);
	}
	
	for (var i = 0; i < list.length; i++){
		func.call(list, list[i], finish, i, addItem);
	}
}

Gito = window.Gito || {};

Gito.FileUtils = (function(){
	
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
				if (typeof contents === "ArrayBuffer"){
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
				dirEntry.removeRecursively(callback, Gito.errorHandler);
			});
		},
		rmFile : function(root, filename, callback){
			root.getFile(filename, {create:true}, function(fileEntry){
				fileEntry.remove(callback, Gito.errorHandler);
			});
		},
		mkfile : function(root, filename, contents, callback){
			if (filename.charAt(0) == '/'){
				filename = filename.substring(1);
			}
			var pathParts = filename.split('/');
			if (pathParts.length > 1){
				Gito.FileUtils.mkdirs(root, pathParts.slice(0, pathParts.length - 1), function(dir){
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
				Gito.FileUtils.readBlob(file, dataType, callback);
			});
		},
		readFile : function(root, file, dataType, callback, onerror) {
			
			root.getFile(file, {create:false}, function(fileEntry){
				Gito.FileUtils.readFileEntry(fileEntry, dataType, callback);
			}, onerror ? onerror : Gito.errorHandler);
		}
	
	};
}
)();