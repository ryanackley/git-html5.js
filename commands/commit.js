define(['utils/file_utils'], function (fileutils) {

    var walkFiles = function(dir, store, success){
               
        var reader = dir.createReader();
        var entries = [];
        var treeEntries;
        
        function convertShaToBytes(sha){
            var bytes = new Uint8Array(sha.length/2);
            for (var i = 0; i < sha.length; i+=2)
            {
                bytes[i/2] = parseInt('0x' + sha.substr(i, 2));
            }
            return bytes;   
        }
        
        function loadEntries(){
            if (!entries.length){
                success();
                return;
            }
            var track = {counter: 0};
            treeEntries = [];//new Array(entries.length);
            
            function checkSuccess(){
                track.counter++;
                if (track.counter >= entries.length){
                    treeEntries.sort(function(a,b){
                        if (a.name < b.name) return -1;
                        else if (a.name > b.name) return 1;
                        else
                        return 0;
                    });
                    store._writeTree(treeEntries, success);

                }
            }
            //entries.sort();
            entries.forEach(function(entry, i){
                //var sha;
                if (entry.name == '.git'){
                    return true;
                }
                if (entry.isDirectory){
                    walkFiles(entry, store, function(sha){
                        if (sha){
                            treeEntries.push({name: /*'40000 ' + */entry.name, sha: convertShaToBytes(sha), isBlob: false});
                        }
                        checkSuccess();
                    });
                    
                }
                else{
                    entry.file(function(file){
                        var reader = new FileReader();
                        reader.onloadend = function(){
                            store.writeRawObject('blob', new Uint8Array(reader.result), function(sha){
                                treeEntries.push({name: /*'100644 ' + */entry.name, sha: convertShaToBytes(sha), isBlob: true});
                                checkSuccess();
                            });
                        }
                        reader.readAsArrayBuffer(file);
                    });
                }
            });
            
        }
        
        function doReadEntries(){
            reader.readEntries(function(results){
                if (results.length){
                    for (var i=0; i < results.length; i++){
                        if (results[i].name != '.git')
                            entries.push(results[i]);
                    }
                    doReadEntries();
                }
                else{
                    loadEntries();
                }
            });
        }
        doReadEntries();        
    }

    var _createCommitFromWorkingTree =  function(dir, store, parent, success){     
        walkFiles(dir, store, function(sha){
        
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
                
            commitContent.push('author Ryan Ackley <ryanackley@gmail.com> ',  dateString,'\n', 
                'committer Ryan Ackley <ryanackley@gmail.com> ', dateString, '\n\n', 'commit message','\n');
            store.writeRawObject('commit', commitContent.join(''), function(commitSha){
                fileutils.mkfile(dir, '.git/refs/heads/master', commitSha + '\n', function(){
                    success(commitSha)
                });
            });
        });
    }

    var commit = function(rootDir, objectStore, success){
        var buildCommit = function(parent){
            _createCommitFromWorkingTree(rootDir, objectStore, parent, success);
        }
        
        fileutils.readFile(rootDir,'.git/refs/heads/master', 'Text', buildCommit, buildCommit);
    }

    return commit;

});