define(['commands/object2file', 'commands/conditions', 'utils/file_utils', 'utils/errors'], function(object2file, Conditions, fileutils, errutils){
    
    var blowAwayWorkingDir = function(dir, success, error){
        fileutils.ls(dir, function(entries){
            entries.asyncEach(function(entry, done){
                if (entry.isDirectory){
                    if (entry.name == '.git'){
                        done();
                        return;
                    }
                    else{
                        entry.removeRecursively(done, error);
                    }
                }
                else{
                    entry.remove(done, error);
                }
            }, success);
        }, error)
    }

    var checkout = function(options, success, error){
        var dir = options.dir,
            store = options.objectStore,
            branch = options.branch,
            ferror = errutils.fileErrorFunc(error);

        
        store._getHeadForRef('refs/heads/' + branch, function(branchSha){
            store.getHeadSha(function(currentSha){
                if (currentSha != branchSha){
                    Conditions.checkForUncommittedChanges(dir, store, function(config){
                        blowAwayWorkingDir(dir, function(){
                            store._retrieveObject(branchSha, "Commit", function(commit){
                                var treeSha = commit.tree;
                                object2file.expandTree(dir, store, treeSha, function(){
                                    store.setHeadRef('refs/heads/' + branch, function(){
                                        store.updateLastChange(null, success);
                                    });
                                });
                             });
                        }, ferror);
                    }, error);
                }
                else{
                    store.setHeadRef('refs/heads/' + branch, success);
                }
            });
        }, 
        function(e){
            if (e.code == DOMException.NOT_FOUND_ERR){
                error({type: errutils.CHECKOUT_BRANCH_NO_EXISTS, msg: CHECKOUT_BRANCH_NO_EXISTS_MSG});
            }
            else{
                ferror(e);
            }
        });
        
    }
    return checkout;
})