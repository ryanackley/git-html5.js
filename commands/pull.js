define(['commands/treemerger', 'commands/object2file', 'formats/smart_http_remote', 'formats/pack_index', 'formats/pack', 'utils/file_utils'], function(treeMerger, object2file, SmartHttpRemote, PackIndex, Pack, fileutils){
    

    var _updateWorkingTree = function (dir, store, fromTree, toTree, success){
        
        var processOps = function(rootDir, ops, callback){
            ops.remove.asyncEach(function(entry, done){
                var rm = entry.isBlob ? fileutils.rmFile : fileutils.rmDir;
                rm(rootDir, entry.name, done);
            },
            function(){
                ops.add.asyncEach(function(entry, done){
                    if (!entry.isBlob){
                        fileutils.mkdirs(rootDir, entry.name, function(dirEntry){
                            object2file.expandTree(dirEntry, store, entry.sha, done);
                        });
                    }
                    else{
                        object2file.expandBlob(rootDir, store, entry.name, entry.sha, done); 
                    }
                },
                function(){
                    ops.merge.asyncEach(function(entry, done){
                        if (entry.nu.isBlob){
                            object2file.expandBlob(rootDir, store, entry.nu.name, entry.nu.sha, done); 
                        }
                        else{
                            store._retrieveObjectList([entry.old.sha, entry.nu.sha], 'Tree', function(trees){
                                var newOps = treeMerger.diffTree(trees[0], trees[1]);
                                fileutils.mkdirs(rootDir, entry.nu.name, function(dirEntry){
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
        
        
        var ops = treeMerger.diffTree(fromTree, toTree);
        processOps(dir, ops, success);
    
    }

    var pull = function(dir, store, url, callback, error){
            mkdirs = fileutils.mkdirs,
            mkfile = fileutils.mkfile,
            remote = new SmartHttpRemote(store, "origin", url);
        
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
                        
                        var packIdxData = PackIndex.writePackIdx(objects, packSha);
                        
                        // get a view of the sorted shas
                        var sortedShas = new Uint8Array(packIdxData, 4 + 4 + (256 * 4), objects.length * 20);
                        packNameSha = Crypto.SHA1(sortedShas);
                        
                        var packName = 'pack-' + packNameSha;
                        mkdirs(store.dir, '.git/objects', function(objectsDir){
                            store.objectsDir = objectsDir;
                            mkfile(objectsDir, 'pack/' + packName + '.pack', packData.buffer);
                            mkfile(objectsDir, 'pack/' + packName + '.idx', packIdxData);
                            
                            var packIdx = new PackIndex(packIdxData);
                            if (!store.packs){
                                store.packs = [];
                            }
                            store.packs.push({pack: new Pack(packData, store), idx: packIdx});
                            
                            // TODO: not sure of the order of common. For pulling multiple branches 
                            // we may have to infer common from the object store instead of the 
                            // collection returned by git-upload-pack
                            var errors;
                            wantRefs.asyncEach(function(wantRef, done, i){
                                if (common.indexOf(wantRef.localHead) != -1){
                                    // fast forward merge
                                    mkfile(store.dir, '.git/' + wantRef.name, wantRef.sha, function(){
                                        store._getTreesFromCommits([wantRef.localHead, wantRef.sha], function(trees){
                                            _updateWorkingTree(dir, store, trees[0], trees[1], done);
                                        });
                                    }); 
                                }
                                else{
                                    // non-fast-forward merge
                                    var shas = [wantRef.localHead, common[i], wantRef.sha]
                                    store._getTreesFromCommits(shas, function(trees){
                                        treeMerger.mergeTrees(store, trees[0], trees[1], trees[2], function(finalTree){
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
    }
    return pull;
});