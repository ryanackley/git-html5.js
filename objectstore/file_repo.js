define(['formats/pack', 'formats/pack_index', 'objectstore/objects', 'utils/misc_utils', 'utils/file_utils'], function(Pack, PackIndex, GitObjects, utils, fileutils){

	var FileObjectStore = function(rootDir) {
	 	this.dir = rootDir;
	 	this.packs = [];
	}

	FileObjectStore.prototype = {
		haveRefs: function(){
			return [];
		},
		load : function(callback){
			var rootDir = this.dir;
			var thiz = this;
			rootDir.getDirectory('.git/objects', {create:true}, function(objectsDir){
				thiz.objectsDir = objectsDir;
				objectsDir.getDirectory('pack', {create:true}, function(packDir){
					var packEntries = [];
					var reader = packDir.createReader();
					var readEntries = function(){
						reader.readEntries(function(entries){
						    if (entries.length){
								for (var i = 0; i < entries.length; i++){
									if (entries[i].name.endsWith('.pack'))
										packEntries.push(entries[i]);
								}
								readEntries();
							}
							else{
								if (packEntries.length){
									var counter = {x : 0};
									packEntries.forEach(function(entry, i){
										fileutils.readFile(packDir, entry.name, "ArrayBuffer", function(packData){
											var nameRoot = entry.name.substring(0, entry.name.lastIndexOf('.pack'));
											fileutils.readFile(packDir, nameRoot + '.idx', 'ArrayBuffer', function(idxData){
												thiz.packs.push({pack: new Pack(packData, thiz), idx: new PackIndex(idxData)});
												counter.x += 1;
												if (counter.x == packEntries.length){
													callback();
												}
											});
										});
									});
								}
								else{
									callback();
								}
							}
						});
					}
					readEntries();
				});
			});
		},
		loadWith : function(objectsDir, packs){
			this.objectsDir = objectsDir;
			this.packs = packs;
		},
		_getCommitGraph : function(headShas, limit, callback){
			var commits = [];
			var thiz = this;
			var seen = {};
			
			var walkLevel = function(shas, callback){
				var nextLevel = [];
				shas.asyncEach(function(sha, callback){
					if (seen[sha]){
						callback();
						return;
					}
					else{
						seen[sha] = true;
					}
					thiz._retrieveObject(sha, 'Commit', function(obj){
						nextLevel = nextLevel.concat(obj.parents);
						var i = commits.length - 1
						for (; i >= 0; i--){
							if (commits[i].author.timestamp > obj.author.timestamp){
								commits.splice(i + 1, 0, obj);
								break;
							}
						}
						if (i < 0){
							commits.unshift(obj);
						}
						callback();
					});
				}, function(){
					if (commits.length >= limit || nextLevel.length == 0){
						/*var shas = [];
						for (var i = 0; i < commits.length; i++){
							shas.push(commit.sha);
						}*/
						callback(commits, nextLevel);
					}
					else{
						walkLevel(nextLevel, callback);
					}
				});
			}
			walkLevel(headShas, callback);
		},
		_getCommitsForPush : function(baseRefs, callback, error){
			
			var thiz = this;
			var allCommits ={};
			
			// special case of empty remote. We don't support local branching so push master only
			if (baseRefs.length == 1 && baseRefs[0].sha == "0000000000000000000000000000000000000000"){
				baseRefs[0].name = 'refs/heads/master';
			}
			
			// does a breadth first search of the commit graph to find commits to push. The levels are ordered by 
			// descendents first and the nodes on each level are ordered by commit date. 
			baseRefs.asyncEach(function(ref, callback){
				thiz._getHeadForRef(ref.name, function(sha){
					if (sha != ref.sha){
						ref.head = sha;
						var tips = [], seen = {};
						
						var pushCommit = function(sha, ignore, callback){
							thiz._retrieveObject(sha, 'Commit', function(commit, rawObj){
								var i = 0,commitObj = {commit: commit, raw: rawObj};
								seen[sha] = commitObj;
								commit.ignore = ignore;
									
								for (;i < tips.length; i++){
									if (commit.author.timestamp >= tips[i].commit.author.timestamp){
										tips.splice(i, 0, commitObj);
										break;
									}
								}
								
								if (i == tips.length){
									tips.push(commitObj);
								}
								callback();
							});
						}
						
						var searchLevel = function(shas, ignore, callback){
							shas.asyncEach(function(sha, callback){
								if (sha == "0000000000000000000000000000000000000000"){
									callback();
									return;
								}
								var commitObj = seen[sha];
								if (!commitObj)
									pushCommit(sha, ignore || sha == ref.sha, callback);
								else{
									var commit = commitObj.commit;
									if (ignore && !commit.ignore){
										commit.ignore = true;
										var parents = commit.parents;
										while (parents.length != 0){
											var pObj = seen[parents.pop()];
											if (pObj){
												var p = pObj.commit;
												if (ignore && !p.ignore){
													p.ignore = true;
												}
												parents = parents.concat(p.parents);
											}
										}
									}
									callback();
								}
							}, function(){
								var keepGoing = false;
								for (var i = 0; i < tips.length; i++){
									if (!tips[i].commit.ignore){
										keepGoing = true;
										break;
									}
								}
								if (keepGoing){
									var latest = tips.shift();
									searchLevel(latest.commit.parents, latest.commit.ignore, callback);
								}
								else{
									callback();
								}
							});
						}
						
						searchLevel([sha, ref.sha], false, function(){
							var wants = [];
							
							var recurseFill = function(sha){
								var next = seen[sha];
								if (next && !next.commit.ignore){
									wants.push(next);
									for (var i = 0; i < next.commit.parents.length; i++){
										recurseFill(next.commit.parents[i]);
									}
								}
							}
							recurseFill(sha);
							allCommits[ref.name] = wants;
							callback();
						});
					}
				}, callback);
			},
			function(){
				callback(allCommits);
			});
			
		},
		_getHeadForRef : function(name, callback, onerror){
			fileutils.readFile(this.dir, '.git/' + name, 'Text', function(data){callback(data.substring(0, 40));}, onerror) ;	
		},
		
		_findLooseObject : function(sha, success, error){
			this.objectsDir.getFile(sha.substring(0,2) + '/' + sha.substring(2), {create:false}, function(fileEntry){
				success(fileEntry);
			},
			function(e){
				error(e);
			});
		},
		_findPackedObject : function(sha, success, error){
			for (var i = 0; i < this.packs.length; i++){
				var offset = this.packs[i].idx.getObjectOffset(sha);
				if (offset != -1){
					success(offset, this.packs[i].pack);
					return;
				}
			}
			error();
		},
		_retrieveRawObject : function(sha, dataType, callback, error){
		     var shaBytes;
		     if (sha instanceof Uint8Array){
		     	shaBytes = sha;
		     	sha = utils.convertBytesToSha(shaBytes);
		     }
		     else{
		     	shaBytes = utils.convertShaToBytes(sha);
		     }
		     
			 
			 
			 var thiz = this;
			 this._findLooseObject(sha, function(fileEntry){
			 	fileutils.readFileEntry(fileEntry, 'ArrayBuffer', function(buf){
			 		var inflated = utils.inflate(new Uint8Array(buf));
			 		if (dataType == 'Raw' || dataType == 'ArrayBuffer'){
			 			var buffer = utils.trimBuffer(inflated);
			 			callback(new GitObjects.RawLooseObject(buffer));
			 		}
			 		else{
			 			fileutils.readBlob(new Blob([inflated]), dataType, function(data){
							callback(new GitObjects.RawLooseObject(data));
						});
			 		}
			 	});
			 }, function(e){
			 		thiz._findPackedObject(shaBytes, function(offset, pack){
			 			dataType = dataType == 'Raw' ? 'ArrayBuffer' : dataType;
			 			pack.matchObjectAtOffset(offset, dataType, function(object){
							callback(object);
						});
			 	}, function(){
			 	    if (error) error.call(thiz);
			 	    else throw(Error("Can't find object with SHA " + sha));
			 	});
			 });
		},
		_retrieveBlobsAsStrings : function(shas, callback){
			var blobs =[],
				self = this;
			shas.asyncEach(function(sha, done){
				self._retrieveRawObject(sha, 'Text', function(object){
					blobs.push(new GitObjects.Blob(sha, object.data));
					done();
				 });
			},
			function(){
				callback(blobs);
			});
		},
		_retrieveObjectList : function(shas, objType, callback){
			var objects = [],
				self = this;
				
			shas.asyncEach(function(sha, done){
				self._retrieveObject(sha, objType, function(obj){
					objects.push(obj);
					done();
				});
			},
			function(){
				callback(objects);
			});
		},
		_retrieveObject : function(sha, objType, callback){
			 var dataType = "ArrayBuffer";
			 if (objType == "Commit"){
			 	dataType = "Text";
			 }
			 
			 this._retrieveRawObject(sha, dataType, function(object){
			 	callback(new GitObjects[objType](sha, object.data), object);
			 });
		},
		init : function(success){
			var root = this.dir;
			var self = this;
			
			root.getDirectory('.git', {create:false}, function(gitDir){
				self.load(success);
			},
			function(e){
				self._init(success);
			});
		},
		_init : function(success){
			var root = this.dir;
			var self = this;
			fileutils.mkdirs(root, '.git/objects', function(objectsDir){
				self.objectsDir = objectsDir;
				fileutils.mkfile(root, '.git/HEAD', 'ref: refs/heads/master\n', success);
			});

		},
		
		_getTreesFromCommits : function(shas, callback){
			var trees = [],
			    shaIndex = 0,
				self = this;
			
			var fillTrees = function(){
				self._getTreeFromCommitSha(shas[shaIndex++], function(tree){
					trees.push(tree);
					if (shaIndex >= shas.length){
						callback(trees);
					}
					else{
						fillTrees();
					}
				});
			}
			fillTrees();
		},
		_getTreeFromCommitSha : function(sha, callback){
			var self = this;
			this._retrieveObject(sha, 'Commit', function(commit){
				self._retrieveObject(commit.tree, 'Tree', callback);
			});
		},
		writeRawObject : function(type, content, callback){
			var bb = [];//new BlobBuilder();
			var size = content.byteLength || content.length || content.size;
			var header = type + ' ' + String(size) ;
			
			//var store = header + content;
			
			bb.push(header);
			bb.push(new Uint8Array([0]));
			bb.push(content);
			var thiz = this;
			var fr = new FileReader();
			fr.onloadend = function(e){
				var buf = fr.result;
				var store = new Uint8Array(buf);
				var digest = Crypto.SHA1(store);
				thiz._findPackedObject(utils.convertShaToBytes(digest), function(){callback(digest);}, function(){
					thiz._storeInFile(digest, store, callback);
				});
			}
			
			fr.readAsArrayBuffer(new Blob(bb));   
		},
		
		_storeInFile : function(digest, store, callback){
			var subDirName = digest.substr(0,2); 	
			var objectFileName = digest.substr(2);
			
			this.objectsDir.getDirectory(subDirName, {create:true}, function(dirEntry){
				dirEntry.getFile(objectFileName, {create:true}, function(fileEntry){
					fileEntry.file(function(file){
						 if(!file.size){
						 	var content = utils.deflate(store);
						 	fileEntry.createWriter(function(fileWriter){
						 		fileWriter.write(new Blob([content]));;
						 		callback(digest);
						 	}, utils.errorHandler);
						 }
						 else{
						 	callback(digest);
						 }
					}, utils.errorHandler);
				
				}, utils.errorHandler);
				
			}, utils.errorHandler);
		},

		_writeTree : function(treeEntries, success){
			var bb = [];//new BlobBuilder();
			for (var i = 0; i < treeEntries.length; i++){
				bb.push((treeEntries[i].isBlob ? '100644 ' : '40000 ') + treeEntries[i].name);
				bb.push(new Uint8Array([0]));
				bb.push(treeEntries[i].sha);
			}
			this.writeRawObject('tree', new Blob(bb), function(sha){
				success(sha);
			});
		}
		
	}

	return FileObjectStore;
});

