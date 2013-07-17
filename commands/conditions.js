define(['utils/file_utils', 'utils/errors'],function(fileutils, errutils){

    var conditions = {

        checkForUncommittedChanges : function(dir, store, callback, error){
            var lastUpdate;
            var walkDir = function(dir, callback){
                
                dir.getMetadata(function(md){
                    if (md.modificationTime > lastUpdate){
                        callback(true);
                        return;
                    }
                    fileutils.ls(dir, function(entries){
                        var changed;
                        entries.asyncEach(function(entry, done){
                            if (changed){
                                done();
                                return;
                            }

                            if (entry.isDirectory){
                                if (entry.name == '.git'){
                                    done();
                                    return;
                                }
                                entry.getMetadata(function(md){
                                    walkDir(entry, function(isChanged){
                                        changed |= isChanged;
                                        done();
                                    });
                                }, done);
                            }
                            else{
                                entry.getMetadata(function(md){
                                    if (md.modificationTime > lastUpdate){
                                        changed = true;
                                    }
                                    done();
                                }, done);
                                
                            }
                        },function(){
                            callback(changed);
                        });
                    });
                });
            };

            store.getConfig(function(config){
                // this would mean we have no commits.
                if (!config.time){
                    config.time = 1;
                }
                lastUpdate = new Date(config.time);
                walkDir(dir, function(changed){
                    if (changed){
                        error({type: errutils.UNCOMMITTED_CHANGES, msg: errutils.UNCOMMITTED_CHANGES_MSG});
                    }
                    else{
                        callback(config);
                    }
                });
            });
        }
    }
    return conditions;
});