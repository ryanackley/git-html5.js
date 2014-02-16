define(['thirdparty/jsdiff', 'utils/misc_utils'], function (_na_, utils) { //JsDiff is a global, no AMD module
  
  /**
   * returns an object contain 3 properties:
   * add, remove, modified
   * each is an array. add and remove arrays contain Tree Entry items
   * while modified contains objects with 2 properties:
   * old, nu
   * which are the old and new Tree Entry items with matching names
   * but not matching SHA's
   */
  var diffTree = function(oldTree, newTree){
	  
		oldTree.sortEntries();
		newTree.sortEntries();
		
		var oldEntries = oldTree.entries, 
			newEntries = newTree.entries;
		var oldIdx = newIdx = 0;
		
		var remove = [],
			add = [], 
			modified = [];
		
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
				if (utils.compareShas(nu.sha,old.sha) != 0){
					modified.push({nu:nu, old:old});
				}
				oldIdx++;
				newIdx++;
			}
		}
		return {add:add, remove:remove, modified: modified};
	};
	
	// walk down the tree and all its subtrees, returning a Array of objects, each obj has:
	// path: path in repo
	// status: "old", "nu"
	// entry: the GitObject entry
	var recursiveTreeDiff = function(oldTree, newTree, path, store, callback) {
		console.log("recursiveTreeDiff start", oldTree, path);
		path = (path) ? path+"/" : "";
		var result = diffTree(oldTree, newTree);
		console.log("diffTree result", result);
		var treePathList = []; //each elem is obj with: path, nu, old with then pointing to a GitObject
		
		if (result.add.length > 0) {
			treePathList = treePathList.concat(flattenTree(result.add, path, "nu"));
		}
		if (result.remove.length > 0) {
			treePathList = treePathList.concat(flattenTree(result.remove, path, "old"));
		}
		result.modified.asyncEach(function(e, done, i) {
			if (e.old.isBlob && e.nu.isBlob) { // easy both a blobs
				e.path = path+e.old.name;
				treePathList.push(e);
				done();
			} else {
				if (e.old.isBlob && !e.nu.isBlob) { // again easy whole new tree to add
					treePathList = treePathList.concat(flattenTree(e.nu.entries, path, "nu"));
					done();
				} else if (!e.old.isBlob && e.nu.isBlob) {// again easy whole old tree to remove
					treePathList = treePathList.concat(flattenTree(e.old.entries, path, "old"));
					done();
				} else { // bit more work - both old and nu are trees
					var shalist = [e.old.sha, e.nu.sha];
					store._retrieveObjectList(shalist, "Tree", function(objs) {
						var subPath = e.old.name;
						//call ourselves with the 2 modified subtrees
						recursiveTreeDiff(objs[0], objs[1], subPath, store, function(subTreePathList) {
							treePathList = treePathList.concat(subTreePathList);
							done();
						});
					});
				}
			}
		},
		function () {
			callback(treePathList);
		});
	};
	
	// walk down the tree and all its subtrees, returning a Array of objects, each obj has:
	// path: path in repo
	// status: "old", "nu"
	// entry: the GitObject entry
	function flattenTree(entries, path, status) {
		var pathList = [];
		for (var i = 0; i < entries.length; i++) {
			var e = entries[i];
			if (e.isBlob) { //a leaf node
				var d = {}
				d.path = path+e.name;
				d[status] = e;
				pathList[i] = d;
			} else { //a branch node
				pathList = pathList.concat(flattenTree(e.entries, path+e.name, status));
			}
		}
		return pathList;
	}
	
	/**
	 * Show a Diff for the diffList - an Array as returned by recursiveTreeDiff()
	 */
	var renderDiff = function(diffList, store, callback) {
		var diffText = "";
		console.log("Render DiffList:", diffList);
		
		diffList.asyncEach( function(e, done, i) {
			console.log('diff entry:', e);
			var DEV_NULL =  '/dev/null';
			if (e.nu && e.old) {
				store._retrieveBlobsAsStrings([e.old.sha, e.nu.sha], function(objList) {
					if (objList.length == 2) {
						if (isBinary(objList[0].data) || isBinary(objList[1].data)) {
							diffText += "Binary Files"+" "+e.path+" Differ\n";
						} else {
							var txt = JsDiff.createPatch(e.path, objList[0].data, objList[1].data);
							diffText += txt+'\n';
						}
					} else {
						console.error("Did not find both Blob objects for SHA's:", objList);
					}
					done();
				});
			} else if (!e.old) {
				store._retrieveRawObject(e.nu.sha, 'Text', function(obj) {
					if (obj) {
						if (isBinary(obj.data)) {
							diffText += "Binary Files"+" "+e.path+" Differ\n";
						} else {
							var txt = JsDiff.createPatch(e.path, "", obj.data);
							diffText += txt+'\n';
						}
					} else {
						console.error("Did not find Blob object for SHA:", obj);
					}
					done();
				});
			} else if (!e.nu) {
				store._retrieveRawObject(e.old.sha, 'Text', function(obj) {
					if (obj) {
						if (isBinary(obj.data)) {
							diffText += "Binary Files"+" "+e.path+" Differ\nu";
						} else {
							var txt = JsDiff.createPatch(e.path, "", obj.data);
							diffText += txt+'\n';
						}
					} else {
						console.error("Did not find Blob object for SHA:", obj);
					}
					done();
				});
			}
		}, function() {
			callback(diffText);
		});
	};
	
	function isBinary(str) {
		for (var i=0; i < 8000; i++) {
			if (str.charCodeAt(i) === 0) {
				return true;
			}
		}
		return false;
	}
	
	return {
		diffTree : diffTree,
		renderDiff: renderDiff,
		recursiveTreeDiff: recursiveTreeDiff
	};
});