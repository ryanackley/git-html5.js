define(['utils/file_utils', 'utils/misc_utils', 'utils/errors'], function (fileutils, miscutils, errutils) {

    var walkFiles = function(dir, store, success){
               
        fileutils.ls(dir, function(entries){
            if (!entries.length){
                success();
                return;
            }

            var treeEntries = [];
            entries.asyncEach(function(entry, done){
                if (entry.name == '.git'){
                    done();
                    return;
                }
                if (entry.isDirectory){
                    walkFiles(entry, store, function(sha){
                        if (sha){
                            treeEntries.push({name: /*'40000 ' + */entry.name, sha: miscutils.convertShaToBytes(sha), isBlob: false});
                        }
                        done();
                    });
                    
                }
                else{
                    entry.file(function(file){
                        var reader = new FileReader();
                        reader.onloadend = function(){
                            store.writeRawObject('blob', new Uint8Array(reader.result), function(sha){
                                treeEntries.push({name: /*'100644 ' + */entry.name, sha: miscutils.convertShaToBytes(sha), isBlob: true});
                                done();
                            });
                        }
                        reader.readAsArrayBuffer(file);
                    });
                }
            },
            function(){
                treeEntries.sort(function(a,b){
                    if (a.name < b.name) return -1;
                    else if (a.name > b.name) return 1;
                    else
                    return 0;
                });
                store._writeTree(treeEntries, success);
            })
        });       
    }

    var checkTreeChanged = function(store, parent, sha, success, error){
        if (!parent || !parent.length){
            success();
        }
        else{
            store._retrieveObject(parent, "Commit", function(parentCommit){
                var oldTree = parentCommit.tree;
                if (oldTree == sha){
                    error({type: errutils.COMMIT_NO_CHANGES, msg: errutils.COMMIT_NO_CHANGES});
                }
                else{
                    success();
                }
            }, function(){
                error({type: errutils.OBJECT_STORE_CORRUPTED, msg: errutils.OBJECT_STORE_CORRUPTED_MSG});  
            })
        }
    }

    var _createCommitFromWorkingTree =  function(options, parent, ref, success, error){ 

        var dir = options.dir,
            store = options.objectStore,
            username = options.username,
            email = options.email,
            commitMsg = options.commitMsg;

        walkFiles(dir, store, function(sha){
            checkTreeChanged(store, parent, sha, function(){
                var now = new Date();
                var dateString = Math.floor(now.getTime()/1000);
                var offset = now.getTimezoneOffset()/-60;
                var absOffset = Math.abs(offset);
                var offsetStr = '' + (offset < 0 ? '-' : '+') + (absOffset < 10 ? '0' : '') + absOffset + '00';
                dateString = dateString + ' ' + offsetStr;
                var commitContent = ['tree ',sha,'\n'];
                if (parent && parent.length){
                    commitContent.push('parent ', parent);
                    if (parent.charAt(parent.length - 1) != '\n'){
                        commitContent.push('\n');
                    }
                }
                    
                commitContent.push('author ', username, ' <',email, '> ',  dateString,'\n', 
                    'committer ', username,' <', email, '> ', dateString, '\n\n', commitMsg,'\n');
                store.writeRawObject('commit', commitContent.join(''), function(commitSha){
                    fileutils.mkfile(dir, '.git/' + ref, commitSha + '\n', function(){
                        success(commitSha);
                    });
                });
            }, error);
        });
    }

    var commit = function(options, success, error){
        var rootDir = options.dir,
            objectStore = options.objectStore;

        var ref;
        var buildCommit = function(parent){
            _createCommitFromWorkingTree(options, parent, ref, success, error);
        }
        objectStore.getHeadRef(function(headRef){
            ref = headRef;
            objectStore._getHeadForRef(ref, buildCommit, function(){ buildCommit(); });
        });
    }

    return commit;

});