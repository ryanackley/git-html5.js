define(['commands/object2file', 'formats/smart_http_remote', 'formats/pack_index', 'formats/pack', 'utils/file_utils'], function(object2file, SmartHttpRemote, PackIndex, Pack, fileutils){
    
    var _createCurrentTreeFromPack = function(dir, store, headSha, callback){
         store._retrieveObject(headSha, "Commit", function(commit){
            var treeSha = commit.tree;
            object2file.expandTree(dir, store, treeSha, callback);
         });
    }

    var clone = function(dir, store, url, callback){
        var mkdirs = fileutils.mkdirs,
            mkfile = fileutils.mkfile,
            remote = new SmartHttpRemote(store, "origin", url);
        
        mkdirs(dir, ".git", function(gitDir){
            remote.fetchRefs(function(refs){
                var headSha, wantShas =[];
                
                _(refs).each(function(ref){
                    if (ref.name == "HEAD"){
                        headSha = ref.sha;
                    }
                    else if (ref.name.indexOf("refs/heads") == 0){
                        if (ref.sha == headSha){
                            mkfile(gitDir, "HEAD", 'ref: ' + ref.name + '\n');
                        }
                        
                        mkfile(gitDir, ref.name, ref.sha + '\n');
                        wantShas.push(ref);
                    }
                });
                remote.fetchRef(wantShas, null, null, function(objects, packData){
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
                        _createCurrentTreeFromPack(dir, store, headSha, callback);
                    }); 
                });
                
            });
        });
    }
    return clone;
});