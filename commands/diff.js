define(["utils/misc_utils"], function (utils) {
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
    return {
		diffTree : diffTree
	}
});