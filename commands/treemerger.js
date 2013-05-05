Gito.TreeMerger = function(store){
	this.store = store;
}

Gito.TreeMerger.prototype = {

	diffTree : function(oldTree, newTree){
		oldTree.sortEntries();
		newTree.sortEntries();
		
		var oldEntries = oldTree.entries, 
			newEntries = newTree.entries;
		var oldIdx = newIdx = 0;
		
		var remove = [],
			add = [], 
			merge = [];
		
		
		
		while (true){
			var nu = newEntries[newIdx];
			var old = oldEntries[oldIdx];
			
			if (!nu){
				if (!old){
					break;
				}
				remove.push(old);
				oldIdx++;
			}
			else if (!old){
				add.push(nu);
				newIdx++;
			}
			else if (nu.name < old.name){
				add.push(nu);
				newIdx++;
			}
			else if (nu.name > old.name){
				remove.push(old);
				oldIdx++;
			}
			else{
				if (Gito.compareShas(nu.sha,old.sha) != 0){
					merge.push({nu:nu, old:old});
				}
				oldIdx++;
				newIdx++;
			}
		}
		return {add:add, remove:remove, merge: merge};
	},
	
	mergeTrees : function(ourTree, baseTree, theirTree, success, error){
		
		var finalTree = [], 
			next = null;
			indices = [0,0,0],
			conflicts = [];
		
		
		
		// base tree can be null if we're merging a sub tree from ours and theirs with the same name
		// but it didn't exist in base. 
		if (baseTree == null){
			baseTree = {entries:[], sortEntries: function(){}};
		}
		
		ourTree.sortEntries();
		theirTree.sortEntries();
		baseTree.sortEntries();
		
		var allTrees = [ourTree.entries, baseTree.entries, theirTree.entries];
		
		while (conflicts.length == 0){
			next = null;
			var nextX = 0;
			for (var x = 0; x < allTrees.length; x++){
				var treeEntries = allTrees[x];
				var top = treeEntries[indices[x]];
				
				if (!next || (top && top.name < next.name)){
					next = top;
					nextX = x;
				}
			}
			
			if (!next){
				break;
			}
			
			function shasEqual(sha1, sha2){
				for (var i = 0; i < sha1.length; i++){
					if (sha1[i] != sha2[i]){
						return false;
					}
				}
				return true;
			}

			switch (nextX){
				case 0:
					var theirEntry = allTrees[2][indices[2]];
					var baseEntry = allTrees[1][indices[1]];
					if (theirEntry.name == next.name){
						if (!shasEqual(theirEntry.sha,next.sha)){
							if (baseEntry.name != next.name){
								baseEntry = {entries:[]};
								if (next.isBlob){
									conflicts.push({conflict:true, ours: next, base: null, theirs: theirEntry});
									break;
								}
							}
							if (next.isBlob === theirEntry.isBlob && (baseEntry.isBlob === next.isBlob)){
								if (shasEqual(next.sha, baseEntry.sha)){
									finalTree.push(theirEntry);
								}
								else{
									finalTree.push({merge:true, ours: next, base: baseEntry, theirs: theirEntry});
								}
							}
							else{
								conflicts.push({conflict:true, ours: next, base: baseEntry, theirs: theirEntry});
							}
						}
						else{
							finalTree.push(next);
						}
					}
					else if (baseEntry.name == next.name){
						if (!shasEqual(baseEntry.sha, next.sha)){
							//deleted from theirs but changed in ours. Delete/modify conflict.
							conflicts.push({conflict:true, ours: next, base: baseEntry, theirs: null});
						}
					}
					else{
						finalTree.push(next);
					}
					break;
				case 1:
					var theirEntry = allTrees[indices[2]];
					if (next.name == theirEntry.name && !shasEqual(next.sha, theirEntry.sha)){
						// deleted from ours but changed in theirs. Delete/modify conflict
						conflicts.push({conflict: true, ours: null, base: next, theirs: theirEntry}); 
					}
					break;
				case 2:
					finalTree.push(next);
					break;
			}
			
			for (var x = 0; x < allTrees.length; x++){
				var treeEntries = allTrees[x];	
				if (treeEntries[indices[x]].name == next.name){
					indices[x]++;
				}
			}
			
		}
		
		if (conflicts.length){
			error(conflicts);
		}
		
		//var mergeBlobs = function(
		var store = this.store;
		var self = this;
		
		finalTree.asyncEach(function(item, done, index){
			if (item.merge){
				
				var shas = [item.ours.sha, item.base.sha, item.theirs.sha];
				if (item.ours.isBlob){
					store._retrieveBlobsAsStrings(shas, function(blobs){
						var newBlob = Diff.diff3_dig(blobs[0].data, blobs[1].data, blobs[2].data); 
						if (newBlob.conflict){
							conflicts.push(newBlob);
							done();
						}
						else{
							store.writeRawObject(objectDir, 'blob', newBlob.text, function(sha){
								finalTree[index].sha = sha;
								done(); 
							});
						}
						
					});
				}
				else{
					store._retrieveObjectList(shas, 'Tree', function(trees){
						self.mergeTrees(trees[0], trees[1], trees[2], function(mergedSha){
							finalTree[index] = item.ours;
							item.ours.sha = mergedSha;
							done();
						},
						function(newConflicts){
							conflicts = conflicts.concat(newConflicts);
							done();
						});
					});
				}
				
			}
			else{
				done();
			}
		},
		function(){
			if (!conflicts.length){
				//Gito.FileUtils.mkdirs(self.dir, '.git/objects', function(objectDir){
				store._writeTree(finalTree, success);
				//});
				//success(finalTree)
			}
			else{
				error(conflicts);
			}
		});
		
	}

}