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
	
	
	var recursiveTreeDiff = function(oldTree, newTree, path, store, callback) {
		console.log("recursiveTreeDiff start", oldTree, path);
		path = (path) ? path+"/" : "";
		var result = diffTree(oldTree, newTree);
		console.log("diffTree result", result);
		var treeMaps = {
			addMap: {},
			removeMap: {}, 
			modifiedMap: {}
		};
		
		concatObjects(treeMaps.addMap,  mapTree(result.add, path));
		concatObjects(treeMaps.removeMap, mapTree(result.remove, path));

		result.modified.asyncEach(function(sha, done, i) {
			var e = result.modified[i];
			console.log("e ", i, e);
			if (e.old.isBlob && e.nu.isBlob) { // easy both a blobs
				treeMaps.modifiedMap[path+e.old.name] = e;
				done();
			} else {
				if (e.old.isBlob && !e.nu.isBlob) { // again easy whole new tree to add
					concatObjects(treeMaps.addMap, mapTree(e.nu.entries, path));
					done();
				} else if (!e.old.isBlob && e.nu.isBlob) {// again easy whole old tree to remove
					concatObjects(treeMaps.removeMap, mapTree(e.old.entries, path));
					done();
				} else { // bit more work - both old and nu are trees
					var shalist = [e.old.sha, e.nu.sha];
					store._retrieveObjectList(shalist, "Tree", function(objs) {
						var subPath = e.old.name;
						console.log("objs - subPath", objs, subPath);
						recursiveTreeDiff(objs[0], objs[1], subPath, store, function(subTreeMaps) {
							concatObjects(treeMaps.addMap, subTreeMaps.addMap);
							concatObjects(treeMaps.removeMap, subTreeMaps.removeMap);
							concatObjects(treeMaps.modifiedMap, subTreeMaps.modifiedMap);
							done();
						});
					});
				}
			}
		},
		function () {
			callback(treeMaps);
		});
	};
	
	// walk down the tree and all its subtrees, returning a map
	// of pathnames to objects
	function mapTree(entries, path) {
		var pathMap = {};
		console.log("mapTree", entries, path);
		for (var i = 0; i < entries.length; i++) {
			var e = entries[i];
			if (e.isBlob) { //a leaf node
				pathMap[path+e.name] = e;
			} else { //a branch node
				concatObjects(pathMap, mapTree(e.entries, path+e.name));
			}
		}
		return pathMap;
	}
	
	//shallow concat - adds all B props to A
	function concatObjects(A, B) {
		var key;
		for (key in B) {
			if (B.hasOwnProperty(key)) {
				A[key] = B[key];
			}
		}
	}
			
	/**
	 * Show a Diff for the given 2 trees, recursing down through all subtrees
	 */
	var renderDiff = function(treeA, treeB, store) {
		var result = diffTree(treeA, treeB);
		console.log("Render Diff", treeA, treeB);
		function processDiffList(objList) {
			console.log("objList:", objList);
			if (objList.length == 2) {
				console.log(JsDiff.createPatch(name, objList[0].data, objList[1].data));
			} else {
				console.error("Did not find both Blob objects for SHA's:", objList);
			}
		}
		
		console.log("Diff Result:", result);
		for (var i=0; i < result.modified.length; i++) {
			console.log("modified entries:", result.modified[i]);
			if (result.modified[i].old.isBlob) {
				var shaA = result.modified[i].old.sha;
				var shaB = result.modified[i].nu.sha;
				var name = result.modified[i].old.name;
				var gitDiffPrefix = utils.convertBytesToSha(shaA).substr(0, 7)+".."+utils.convertBytesToSha(shaB).substr(0, 7);
				store._retrieveBlobsAsStrings([shaA, shaB], processDiffList);
			} else {
				console.log("modified is tree:", result.modified[i]);
			}
		}
	};
	
	return {
		diffTree : diffTree,
		renderDiff: renderDiff,
		recursiveTreeDiff: recursiveTreeDiff
	};
});