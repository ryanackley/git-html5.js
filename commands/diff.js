define(["utils/misc_utils"], function (utils) {
  return {
    /**
     * takes 2 git-html5 tree objs, which have an entries prop Array
     * and creates a list of differences between the 2
     * @return a object with 3 props: added, deleted, modified, each containing the name of the tree entry
     */
    diffTrees: function (treeA, treeB){
      console.log("diffing trees:", treeA, treeB);
      var diffLists = {
          added : [],
          deleted : [],
          modified : []
      };
      var inBoth;

      diffLists.added = _removeArrayItems(treeB.entries, treeA.entries);
      diffLists.deleted = _removeArrayItems(treeA.entries, treeB.entries);
      inBoth = _removeArrayItems(treeA.entries, diffLists.deleted);
      console.log("both", inBoth);

      for(var i=0; i < inBoth.length; i++) {
        if (utils.compareShas(_getTreeEntry(treeB, inBoth[i].name).sha, inBoth[i].sha) != 0) {
          if(inBoth[i].isBlob) {
            diffLists.modified.push(inBoth[i]);
          }
        }
      }
      return diffLists;
    }
  };

  //return entry in tree matching name or null
  function _getTreeEntry(tree, name) {
      var result = null;
      tree.entries.some(function(b) {
          if (b.name == name) {
              result = b;
              return true;
          }
      });
      return result;
  }

  /*
   * Removes a set of strings from an array. Takes two arrays as parameters, 
   * first being the array of items you want to manipulate, second a Array of items
   * you want to remove from the original array.
   * src: http://www.bytechaser.com/en/functions/cutxqjhtxq/remove-items-from-a-javascript-array.aspx
   *
   * @returns A new Array with all the selected items removed
   */
  function _removeArrayItems(array, itemsToRemove) {
    if (array.length == 0 || itemsToRemove.length == 0){
      return array;
    }
    var sMatchedItems = "|"+itemsToRemove.join('|')+"|";
    var newArray = [];
    for(var i=0; i<array.length; i++) {
        if(sMatchedItems.indexOf("|"+array[i]+"|") < 0) {
            newArray[newArray.length]=array[i];
        }
    }
    return newArray;
  }
});