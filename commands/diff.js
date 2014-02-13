define(['thirdparty/jsdiff', 'utils/misc_utils'], function (_na_, utils) { //JsDiff is a global, no AMD module
  var diffTree = function(oldTree, newTree){
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
				if (utils.compareShas(nu.sha,old.sha) != 0){
					merge.push({nu:nu, old:old});
				}
				oldIdx++;
				newIdx++;
			}
		}
		return {add:add, remove:remove, merge: merge};
	};
	
	
	/**
	 * Show a Diff for the given 2 trees, recursing down through all subtrees
	 * TODO: the recursing bit !!!
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
		for (var i=0; i < result.merge.length; i++) {
			console.log("modified entries:", result.merge[i]);
			if (result.merge[i].old.isBlob) {
				var shaA = result.merge[i].old.sha;
				var shaB = result.merge[i].nu.sha;
				var name = result.merge[i].old.name;
				var gitDiffPrefix = utils.convertBytesToSha(shaA).substr(0, 7)+".."+utils.convertBytesToSha(shaB).substr(0, 7);
				store._retrieveBlobsAsStrings([shaA, shaB], processDiffList);
			} else {
				console.log("modified is tree:", result.merge[i]);
			}
		}
	};
	
	return {
		diffTree : diffTree,
		renderDiff: renderDiff
	}
});