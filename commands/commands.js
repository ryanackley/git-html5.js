Git.FileRepo = function(rootDir) {
 	this.dir = rootDir;
 	this.objectStore = new Git.FileObjectStore(rootDir);
 	this.packs = [];
 	this.treeMerger = new Gito.TreeMerger(this.objectStore);
}
Git.FileRepo.prototype = {
	init : function(callback){
		this.objectStore.init(callback);
	},
	push : function(url, success){
		var remote = new Git.SmartHttpRemote(this, "origin", url);
		var store = this.objectStore;
		remote.fetchReceiveRefs(function(refs){
			store._getCommitsForPush(refs, function(commits){
				Git.Pack.buildPack(commits, store, function(packData){
					remote.pushRefs(refs, packData, success);
					//var pck = new Git.Pack(packData);
					//pck.parseAll(function(){
					//	var x = 0;
					//});
				});
			});
		});
	},
	
	clone: function(url, callback){
	    var dir = this.dir
		var mkdirs = Gito.FileUtils.mkdirs,
		    mkfile = Gito.FileUtils.mkfile,
		    remote = new Git.SmartHttpRemote(this, "origin", url);
		
		var store = this.objectStore;
		var self = this;
		
		mkdirs(dir, ".git", function(gitDir){
			remote.fetchRefs(function(refs){
				var headSha, wantShas =[];
				
				_(refs).each(function(ref){
					if (ref.name == "HEAD"){
						headSha = ref.sha;
					}
					else if (ref.name.indexOf("refs/heads") == 0){
						if (ref.sha == headSha){
							mkfile(gitDir, "HEAD", 'ref: ' + ref.name + '\n');
						}
						
						mkfile(gitDir, ref.name, ref.sha + '\n');
						wantShas.push(ref);
					}
				});
				remote.fetchRef(wantShas, null, null, function(objects, packData){
					var packSha = packData.subarray(packData.length - 20);
					
					var packIdxData = Git.PackIndex.writePackIdx(objects, packSha);
					
					// get a view of the sorted shas
					var sortedShas = new Uint8Array(packIdxData, 4 + 4 + (256 * 4), objects.length * 20);
					packNameSha = Crypto.SHA1(sortedShas);
					
					var packName = 'pack-' + packNameSha;
					mkdirs(gitDir, 'objects', function(objectsDir){
						mkfile(objectsDir, 'pack/' + packName + '.pack', packData.buffer);
						mkfile(objectsDir, 'pack/' + packName + '.idx', packIdxData);
						
						var packIdx = new Gito.PackIndex(packIdxData);
						store.loadWith(objectsDir, [{pack: new Git.Pack(packData, self), idx: packIdx}]);
						self._createCurrentTreeFromPack(headSha, callback);
					});	
				});
				
			});
		});
	},
	
	commit : function(success){
		var self = this;
		
		var buildCommit = function(parent){
			self._createCommitFromWorkingTree(parent, success);
		}
		
		Gito.FileUtils.readFile(this.dir,'.git/refs/heads/master', 'Text', buildCommit, buildCommit);
	},
	
	_createCommitFromWorkingTree: function(parent, success){
				
		var store = this.objectStore;
		var dir = this.dir;
		this.walkFiles(dir, function(sha){
		
			var now = new Date();
			var dateString = Math.floor(now.getTime()/1000);
			var offset = now.getTimezoneOffset()/-60;
			var absOffset = Math.abs(offset);
			var offsetStr = '' + (offset < 0 ? '-' : '+') + (absOffset < 10 ? '0' : '') + absOffset + '00';
			dateString = dateString + ' ' + offsetStr;
			var commitContent = ['tree ',sha,'\n'];
			if (parent && parent.length){
				commitContent.push('parent ', parent);
				if (parent.charAt(parent.length - 1) != '\n'){
					commitContent.push('\n');
				}
			}
				
			commitContent.push('author Ryan Ackley <ryanackley@gmail.com> ',  dateString,'\n', 
				'committer Ryan Ackley <ryanackley@gmail.com> ', dateString, '\n\n', 'commit message','\n');
			store.writeRawObject('commit', commitContent.join(''), function(commitSha){
				Gito.FileUtils.mkfile(dir, '.git/refs/heads/master', commitSha + '\n', function(){
					success(commitSha)
				});
			});
		});
	},
	
	walkFiles : function(dir, success){
			   
		var reader = dir.createReader();
		var thiz = this; 
		var store = this.objectStore;
		var entries = [];
		var treeEntries;
		
		function convertShaToBytes(sha){
		    var bytes = new Uint8Array(sha.length/2);
			for (var i = 0; i < sha.length; i+=2)
			{
				bytes[i/2] = parseInt('0x' + sha.substr(i, 2));
			}
			return bytes;	
		}
		
		function loadEntries(){
			if (!entries.length){
				success();
				return;
			}
		    var track = {counter: 0};
		 	treeEntries = [];//new Array(entries.length);
			
			function checkSuccess(){
				track.counter++;
				if (track.counter >= entries.length){
					treeEntries.sort(function(a,b){
						if (a.name < b.name) return -1;
				      	else if (a.name > b.name) return 1;
				      	else
				        return 0;
					});
					console.log(treeEntries);
					store._writeTree(treeEntries, success);

				}
			}
			//entries.sort();
			entries.forEach(function(entry, i){
				//var sha;
				if (entry.name == '.git'){
					return true;
				}
				if (entry.isDirectory){
					thiz.walkFiles(entry, function(sha){
						if (sha){
							treeEntries.push({name: /*'40000 ' + */entry.name, sha: convertShaToBytes(sha), isBlob: false});
						}
						checkSuccess();
					});
					
				}
				else{
					entry.file(function(file){
						var reader = new FileReader();
						reader.onloadend = function(){
							store.writeRawObject('blob', reader.result, function(sha){
								treeEntries.push({name: /*'100644 ' + */entry.name, sha: convertShaToBytes(sha), isBlob: true});
								checkSuccess();
							});
						}
						reader.readAsArrayBuffer(file);
					});
				}
			});
			
		}
		
		function doReadEntries(){
			reader.readEntries(function(results){
				if (results.length){
					for (var i=0; i < results.length; i++){
						if (results[i].name != '.git')
							entries.push(results[i]);
					}
					doReadEntries();
				}
				else{
					loadEntries();
				}
			});
		}
		doReadEntries();
		
	},
	pull : function(url, callback, error){
		var store = this.objectStore,
			self = this;
			dir = this.dir,
			mkdirs = Gito.FileUtils.mkdirs,
		    mkfile = Gito.FileUtils.mkfile,
			remote = new Git.SmartHttpRemote(this, "origin", url);
		
		remote.fetchRefs(function(refs){
			var headSha, wantRefs = [], haveShas = [];
			
			refs.asyncEach(function(ref, callback){
				if (ref.name.indexOf("refs/heads") == 0){
					// see if we know about the branch's head commit if not add it to our want list
					store._retrieveRawObject(ref.sha, 'ArrayBuffer', callback, function(){
						wantRefs.push(ref);
						// try to get the local head for this branch. We may not know about this branch locally
						store._getHeadForRef(ref.name, function(sha){
							ref.localHead = sha;
							haveShas.push(sha);							
							callback();
						}, callback);
					});					
				}else{
					callback();
				}
			}, function(){
				store._getCommitGraph(haveShas, 32, function(commits, nextLevel){
					remote.fetchRef(wantRefs, commits, nextLevel, function(objects, packData, common){
						var packSha = packData.subarray(packData.length - 20);
						
						var packIdxData = Git.PackIndex.writePackIdx(objects, packSha);
						
						// get a view of the sorted shas
						var sortedShas = new Uint8Array(packIdxData, 4 + 4 + (256 * 4), objects.length * 20);
						packNameSha = Crypto.SHA1(sortedShas);
						
						var packName = 'pack-' + packNameSha;
						mkdirs(store.dir, '.git/objects', function(objectsDir){
							store.objectsDir = objectsDir;
							mkfile(objectsDir, 'pack/' + packName + '.pack', packData.buffer);
							mkfile(objectsDir, 'pack/' + packName + '.idx', packIdxData);
							
							var packIdx = new Gito.PackIndex(packIdxData);
							if (!store.packs){
								store.packs = [];
							}
							store.packs.push({pack: new Git.Pack(packData, self), idx: packIdx});
							
							// TODO: not sure of the order of common. For pulling multiple branches 
							// we may have to infer common from the object store instead of the 
							// collection returned by git-upload-pack
							var errors;
							wantRefs.asyncEach(function(wantRef, done, i){
								if (common.indexOf(wantRef.localHead) != -1){
									// fast forward merge
									mkfile(store.dir, '.git/' + wantRef.name, wantRef.sha, function(){
										store._getTreesFromCommits([wantRef.localHead, wantRef.sha], function(trees){
											self._updateWorkingTree(trees[0], trees[1], done);
										});
									}); 
								}
								else{
									// non-fast-forward merge
									var treeMerger = new Gito.TreeMerger(store);
									var shas = [wantRef.localHead, common[i], wantRef.sha]
									store._getTreesFromCommits(shas, function(trees){
										treeMerger.mergeTrees(trees[0], trees[1], trees[2], function(finalTree){
											mkfile(store.dir, '.git/' + wantRef.name, sha, done); 
										}, function(e){errors.push(e);done();});
									});
								}
							},
							function(){
								if (errors && errors.length != 0){
									error(errors);
								}
								else{
									callback();
								}
							});
						});	
					});
				});
			});
		});
	},
	
	_updateWorkingTree : function (fromTree, toTree, success){
		var store = this.objectStore;
		var self = this;
		
		var processOps = function(rootDir, ops, callback){
			ops.remove.asyncEach(function(entry, done){
				var rm = entry.isBlob ? Gito.FileUtils.rmFile : Gito.FileUtils.rmDir;
				rm(rootDir, entry.name, done);
			},
			function(){
				ops.add.asyncEach(function(entry, done){
					if (!entry.isBlob){
						Gito.FileUtils.mkdirs(rootDir, entry.name, function(dirEntry){
							self._expandTree(dirEntry, entry.sha, done);
						});
					}
					else{
						self._expandBlob(rootDir, entry.name, entry.sha, done); 
					}
				},
				function(){
					ops.merge.asyncEach(function(entry, done){
						if (entry.nu.isBlob){
							self._expandBlob(rootDir, entry.nu.name, entry.nu.sha, done); 
						}
						else{
							store._retrieveObjectList([entry.old.sha, entry.nu.sha], 'Tree', function(trees){
								var newOps = self.treeMerger.diffTree(trees[0], trees[1]);
								Gito.FileUtils.mkdirs(rootDir, entry.nu.name, function(dirEntry){
									processOps(dirEntry, newOps, done);
								});
							});
						}
					},
					function(){
						callback();
					});
				});
			});
		}
		
		
		var ops = self.treeMerger.diffTree(fromTree, toTree);
		processOps(self.dir, ops, success);
	
	},
	_createCurrentTreeFromPack : function(headSha, callback){
		 var dir = this.dir
		 var thiz = this;
		 
		 this.objectStore._retrieveObject(headSha, "Commit", function(commit){
		 	var treeSha = commit.tree;
		 	thiz._expandTree(dir, treeSha, callback);
		 });
	},
	_expandBlob : function(dir, name, blobSha, callback){
		var makeFileFactory = function(name){
			return function(blob){
				Gito.FileUtils.mkfile(dir, name, blob.data, callback);
			}
		}
		
		this.objectStore._retrieveObject(blobSha, "Blob", makeFileFactory(name));
	},
	_expandTree : function(dir, treeSha, callback){
		
		var thiz = this;
		
		this.objectStore._retrieveObject(treeSha, "Tree", function(tree){
			var entries = tree.entries;
			entries.asyncEach(function(entry, done){
				if (entry.isBlob){
					var name = entry.name;
					thiz._expandBlob(dir, name, entry.sha, done);
				}
				else{
					var sha = entry.sha;
					Gito.FileUtils.mkdirs(dir, entry.name, function(newDir){
						thiz._expandTree(newDir, sha, done);
					});
				}
			},callback);
		});
	},
}