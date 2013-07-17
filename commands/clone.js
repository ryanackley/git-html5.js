define(['commands/object2file', 'formats/smart_http_remote', 'formats/pack_index', 'formats/pack', 'utils/file_utils', 'utils/errors'], function(object2file, SmartHttpRemote, PackIndex, Pack, fileutils, errutils){
    
    var _createCurrentTreeFromPack = function(dir, store, headSha, callback){
         store._retrieveObject(headSha, "Commit", function(commit){
            var treeSha = commit.tree;
            object2file.expandTree(dir, store, treeSha, callback);
         });
    }
    
    var checkDirectory = function(dir, store, success, error, ferror){
        fileutils.ls(dir, function(entries){
            
            if (entries.length == 0){
                error({type: errutils.CLONE_DIR_NOT_INTIALIZED, msg: errutils.CLONE_DIR_NOT_INTIALIZED_MSG});
            }
            else if (entries.length != 1 || entries[0].isFile || entries[0].name != '.git'){
                error({type: errutils.CLONE_DIR_NOT_EMPTY, msg: errutils.CLONE_DIR_NOT_EMPTY_MSG});
            }
            else{
                fileutils.ls(store.objectsDir, function(entries){
                    if (entries.length > 0){
                        error({type: errutils.CLONE_GIT_DIR_IN_USE, msg: errutils.CLONE_GIT_DIR_IN_USE_MSG});
                    }
                    else{
                        success();
                    }
                }, ferror);
            }

        }, ferror);
    };

    var clone = function(options, success, error){
        
        var dir = options.dir,
            store = options.objectStore,
            url = options.url,
            callback = success,
            depth = options.depth,
            branch = options.branch || 'master',
            progress = options.progress,
            username = options.username,
            password = options.password,
            ferror = errutils.fileErrorFunc(error);

        var mkdirs = fileutils.mkdirs,
            mkfile = fileutils.mkfile,
            remote = new SmartHttpRemote(store, "origin", url, username, password, error);

        var createInitialConfig = function(shallow, localHeadRef, callback){
            var config = {url: url, time: new Date()};
            if (options.depth && shallow){
                config.shallow = shallow;
            }
            config.remoteHeads = {};
            
            if (localHeadRef)
                config.remoteHeads[localHeadRef.name] = localHeadRef.sha;

            store.setConfig(config, callback);  
        }

        checkDirectory(dir, store, function(){ 
            mkdirs(dir, ".git", function(gitDir){
                remote.fetchRefs(function(refs){
                    
                    if (!refs.length){
                        createInitialConfig(null, null, success);
                        return;
                    }

                    var remoteHead, remoteHeadRef, localHeadRef;

                    _(refs).each(function(ref){
                        if (ref.name == "HEAD"){
                            remoteHead = ref.sha;
                        }
                        else if (ref.name == "refs/heads/" + branch){
                            localHeadRef = ref;
                        }
                        else if (ref.name.indexOf("refs/heads/") == 0){
                            if (ref.sha == remoteHead){
                                remoteHeadRef = ref;
                            }
                        }
                    });

                    if (!localHeadRef){
                        if (options.branch){
                            error({type: errutils.REMOTE_BRANCH_NOT_FOUND, msg: errutils.REMOTE_BRANCH_NOT_FOUND_MSG});
                            return;
                        }
                        else{
                            localHeadRef = remoteHeadRef;
                        }
                    }

                    mkfile(gitDir, "HEAD", 'ref: ' + localHeadRef.name + '\n', function(){
                        mkfile(gitDir, localHeadRef.name, localHeadRef.sha + '\n', function(){
                            remote.fetchRef([localHeadRef], null, null, depth, null, function(objects, packData, common, shallow){
                                var packSha = packData.subarray(packData.length - 20);
                                
                                var packIdxData = PackIndex.writePackIdx(objects, packSha);
                                
                                // get a view of the sorted shas
                                var sortedShas = new Uint8Array(packIdxData, 4 + 4 + (256 * 4), objects.length * 20);
                                packNameSha = Crypto.SHA1(sortedShas);
                                
                                var packName = 'pack-' + packNameSha;
                                mkdirs(gitDir, 'objects', function(objectsDir){
                                    mkfile(objectsDir, 'pack/' + packName + '.pack', packData.buffer);
                                    mkfile(objectsDir, 'pack/' + packName + '.idx', packIdxData);
                                    
                                    var packIdx = new PackIndex(packIdxData);
                                    store.loadWith(objectsDir, [{pack: new Pack(packData, self), idx: packIdx}]);
                                    _createCurrentTreeFromPack(dir, store, localHeadRef.sha, function(){
                                        createInitialConfig(shallow, localHeadRef, callback);
                                    });
                                }, ferror); 
                            }, null, progress);
                        }, ferror);
                    }, ferror);
                });
            }, ferror);
        }, error, ferror);
    }
    return clone;
});