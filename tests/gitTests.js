
QUnit.config.autostart = false;
window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
String.prototype.endsWith = function(suffix){
    return this.lastIndexOf(suffix) == (this.length - suffix.length);
}
requirejs.config({baseUrl: "../"});
var fail = function(msg, callback){
        return function(){
            ok(false, msg);
            callback();
        }
    }

    var bytesToString = function(bytes) {
        var result = "";
        var i;
        for (i = 0; i < bytes.length; i++) {
          result = result.concat(String.fromCharCode(bytes[i]));
        }
        return result;
    }
      
    var stringToBytes = function(string) {
        var bytes = []; 
        var i; 
        for(i = 0; i < string.length; i++) {
          bytes.push(string.charCodeAt(i) & 0xff);
        }
        return bytes;
    }
    
    var requireShim = function(callback){
        requirejs(['objectstore/file_repo'], function(FileObjectStore){
            window.FileObjectStore = FileObjectStore;
            callback();
        });
    }

    var verifyDir = function(root, dirName, callback, original){
        var cf = {create:false};
        var components = dirName.split('/');
        var name = components.shift();
        original = original || dirName;
        root.getDirectory(name, cf, function(newDir){
            if (components.length > 0){
                verifyDir(newDir, components.join('/'), callback, original);
            }
            else{
                ok(true, "Found directory " + original);
                callback(newDir);
            }
        }, 
        fail(name + 'directory not found', callback));
    }
    
    var verifyFile = function(root, fileName, contents, callback){
        var cf = {create:false};
        var components = fileName.split('/');
        //var fileName = components.pop();
        
        var checkFile = function(root, leafName){
            root.getFile(leafName, cf, function(fileEntry){
                fileEntry.file(function(f){
                    var reader = new FileReader();
                    reader.onloadend = function(){
                        var text = reader.result;
                        equal(contents, text);
                        callback();
                    }
                    reader.readAsText(f);
                });
            },
            fail(fileName + " file not found", callback));
        }
        
        var leafName = components.pop();
        if (components.length > 0){
            verifyDir(root, components.join('/'), function(parentDir){
                if (parentDir){
                    checkFile(parentDir, leafName);
                }
            });
        }
        else{
            checkFile(root, leafName);
        }
    }
  var root = '';///Users/ryanackley/';
  var testSetup = function(){
        stop();
        window.requestFileSystem(window.PERSISTENT, 5*1024*1024*1024, function(fs){
            var dirEntry = fs.root;
            dirEntry.getDirectory(root + 'testDir', {create:true}, function(testDir){
                require(['utils/file_utils'], function(fileutils){
                    window.fileutils = fileutils;
                    start();
                    window.testDir = testDir;
                });
            }); 
        });
    }
    var testTeardown = function(){
        if (testDir){
            stop()
            testDir.removeRecursively(function(){
                window.requestFileSystem(window.PERSISTENT, 5*1024*1024*1024, function(fs){
                    fileutils.rmDir(fs.root, root + 'testDir1', function(){
                        start();
                    });
                });
            });
        }
    }
$(document).ready(function(){
    requireShim(function(){
        qunitTestRun();
    });
});
   var qunitTestRun = function(){
    var taskRunner = window.taskRunner;
    stop();
    
    module("Supporting Lib tests", {setup: testSetup, teardown:testTeardown});
    
    asyncTest("Deflate to Inflate test", function(){
        var msg = "blah blah blah blah blargh smdnakjdhjkahsdjkasd hjka dkja dhjkajk dh ajkd hkja sdhjk";
        var bytes = stringToBytes(msg);
        expect(1);
        //stop();
        require(['utils/misc_utils'], function(utils){
            var compressed = utils.deflate(bytes);
        
            var reader = new FileReader();
            reader.onloadend = function(){
                var uncompressed = utils.inflate(new Uint8Array(reader.result));
                
                var reader1 = new FileReader();
                reader1.onloadend = function(){
                    equal(msg, reader1.result);
                    start();
                }
                reader1.readAsText(new Blob([uncompressed]));
            }
            reader.readAsArrayBuffer(new Blob([compressed]));
        });
        
    });
    
    asyncTest("FileUtil mk and rm dirs", function(){
        var dirs = ['a','b','c','d','e'];
        fileutils.mkdirs(testDir, dirs.join('/'), function(newDir){
            verifyDir(testDir, dirs.join('/'), function(){
                fileutils.rmDir(testDir,dirs[0], function(){
                    testDir.getDirectory(dirs[0], {create:false}, function(){
                        ok(false, "failed to delete directory");
                        start();
                    },
                    function(){
                        ok(true, "directory successfully deleted");
                        start();
                    });
                });
            });
        });
    }); 
    
    asyncTest("FileUtil mk, read, and rm file", function(){
        var path = ['a','b','c','d','test.txt'];
        var content = "Lorem Ipsum\nblargh!";
        fileutils.mkfile(testDir, path.join('/'), content, function(file){
            verifyFile(testDir, path.join('/'), content, function(){
                fileutils.readFile(testDir, path.join('/'), 'Text', function(readContent){
                    equal(content, readContent);
                    fileutils.rmFile(testDir, path.join('/'), function(){
                        testDir.getFile(path.join('/'), {create:false}, function(){
                            ok(false, "failed to delete file");
                            start();
                        },
                        function(){
                            ok(true, "file successfully deleted");
                            start();
                        });
                    });
                }, function(){
                    ok(false, "Unable to read file");
                    start();
                });
            });
        });
    });
    
    //var knownRepoUrl = /*'http://localhost:8080/GitServerTest/git/testDir';*/ 'https://github.com/ryanackley/GitTest.git'/*'http://admin@localhost:7990/scm/git/gittest.git'*//*'https://ryanackley@bitbucket.org/ryanackley/gittest.git'*/;
        
        module("Basic Git FileSystem API Tests", {setup: testSetup, teardown:testTeardown});
        
        /*asyncTest("Test Git Init", function(){
            var repo = new Git.FileRepo(testDir);
            repo.init(testDir);
    
            verifyDir(testDir, '.git/refs/heads', function(){
                verifyFile(testDir, '.git/HEAD', "ref: refs/heads/master\n", function(){
                    start();
                });
            });
        });*/
        
        var doSimpleCommit = function(fileName, fileContent, callback){
            fileutils.mkfile(testDir, fileName, fileContent, function(){
                // var repo = new Git.FileRepo(testDir);
                // repo.init(function(){
                //     repo.commit(function(sha){
                //         callback(repo, sha);
                //     });
                // });
                //GitLite.init({dir: testDir}, function(){
                    GitLite.commit({dir:testDir, name: commitName, email: commitEmail, commitMsg: 'commit message'}, callback);
                //});
            });
        }
        
        asyncTest("Test Simple Git Commit", function(){
            var cName = commitName;
            var cEmail = commitEmail;
            var aName = commitName;
            var aEmail = commitEmail;
            var message = 'commit message';
            
            var fileName = "simple.txt";
            var fileContent = "1";
            
            doSimpleCommit(fileName, fileContent, function(sha){
                var store = new FileObjectStore(testDir);
                store.init(function(){
                    store._retrieveObject(sha, 'Commit', function(commit){
                        equal('commit', commit.type);
                        equal(cName, commit.committer.name);
                        equal(cEmail, commit.committer.email);
                        equal(aName, commit.author.name);
                        equal(aEmail, commit.author.email);
                        equal(message, commit.message);
                        ok(!commit.parent, "For the first commit, there should be no parent");
                        var treeSha = commit.tree;
                        store._retrieveObject(treeSha, 'Tree', function(tree){
                            equal(1, tree.entries.length);
                            var entry = tree.entries[0];
                            equal(true, entry.isBlob);
                            equal(fileName, entry.name);
                            store._retrieveObject(entry.sha, 'Blob', function(blob){
                                var contents = bytesToString(new Uint8Array(blob.data));
                                start();
                            });
                        });
                    });
                });
            });
                    
        });
        
        asyncTest("Test Git Commit Parent",function(){
            doSimpleCommit('simple.txt', '1', function(firstCommitSha){
                doSimpleCommit('simple.txt', '1\n2', function(secondCommitSha){
                    var objectStore = new FileObjectStore(testDir);
                    objectStore.init(function(){
                        objectStore._retrieveObject(secondCommitSha, 'Commit', function(commit){
                            equal(firstCommitSha, commit.parents[0]);
                            start();
                        });
                    });
                });
            });
        });

         asyncTest("Test Unicode tree entry",function(){
            doSimpleCommit('\u039bckley.txt', '\u06ae', function(firstCommitSha){   
                var store = new FileObjectStore(testDir);
                store.init(function(){
                    store._retrieveObject(firstCommitSha, 'Commit', function(commit){
                        var treeSha = commit.tree;
                        store._retrieveObject(treeSha, 'Tree', function(tree){
                            equal(1, tree.entries.length);
                            var entry = tree.entries[0];
                            equal(true, entry.isBlob);
                            equal('\u039bckley.txt', entry.name);
                            start();
                        });
                    });
                });
            });
        });
        /*asyncTest("Test Git Push", function(){
            var repoName = 'testGit' + Math.floor(Math.random()*2000);
            GitHub.createGitRepo('', '', repoName, function(data){
                doSimpleCommit('simple.txt', '1', function(repo, sha){
                    repo.push(data.clone_url, function(){
                        ok(true, 'successfully pushed into url');
                        start();
                    });
                });
            });
        });*/
        //var fileBuilder = function(files
        var verifyHead = function(refName, callback){
            var store = new FileObjectStore(testDir);
            store.init(function(){
                store._getHeadForRef(refName, function(sha){
                
                    var verifyTree = function(tree, dir, callback){
                        fileutils.ls(dir, function(entries){
                            var sorter = function(a, b){
                                var nameA = a.name, nameB = b.name;
                                if (nameA < nameB) //sort string ascending
                                    return -1; 
                                if (nameA > nameB)
                                    return 1;
                                return 0;
                            }
                            entries.sort(sorter);
                            tree.sortEntries();
                            
                            var pairs = [];
                            for (var i = 0, j = 0; i < entries.length; i++, j++){
                                if (entries[i].name == '.git'){
                                    i++;
                                }
                                if (tree.entries[j].name != entries[i].name ||
                                    tree.entries[j].isBlob != entries[i].isFile){
                                    ok(false, 'Tree doesn\'t match working directory "' + dir.name + '"');
                                    callback();
                                    return;
                                }
                                else if (!tree.entries[j].isBlob){
                                    pairs.push({type:'tree', tree: tree.entries[j], dir: entries[i]});
                                }
                                else{
                                    pairs.push({type: 'blob', blob: tree.entries[j], file:entries[i]});
                                }
                            }
                            
                            pairs.asyncEach(function(item, done){
                                if (item.type == 'tree'){
                                    store._retrieveObject(item.tree.sha, 'Tree',function(subtree){
                                        verifyTree(subtree, item.dir, done);
                                    });
                                }
                                else{
                                    store._retrieveBlobsAsStrings([item.blob.sha], function(strings){
                                        fileutils.readFileEntry(item.file, 'Text', function(fileString){
                                            if (fileString != strings[0]){
                                                ok(false, item.file.name + ' is not up to date');
                                            }
                                            else{
                                                ok(true, item.file.name + ' matches');
                                            }
                                            done();
                                        });
                                    });
                                }
                            },
                            function(){
                                ok(true, 'Tree matched working directory "' + dir.name + '"');
                                callback();
                            });
                        });
                    }
                    
                    store._getTreeFromCommitSha(sha, function(tree){
                        verifyTree(tree, testDir, callback);
                    });
                }, fail('couldn\'t find head sha for ' + refName, callback));
            });
        }
        

        var cloneTest = function(depth){
            return function(){
                GitLite.clone({dir: testDir, url: knownRepoUrl, depth: depth}, function(){
                    verifyHead('refs/heads/master', function(){
                        ok(true, 'clone was successful');
                        start();
                    });
                });
            }
        }
        asyncTest("Test Clone", cloneTest());
        asyncTest("Test Clone Shallow", cloneTest(1));
        
        
        
        var setupFileStructure = function(root, files, callback){
            files.asyncEach(function(item, done){
                if(item.contents){
                    fileutils.mkfile(root, item.name, item.contents, done);
                }
                else if (item.rmFile){
                    fileutils.rmFile(root, item.name, done);
                }
                else if (item.rmDir){
                    fileutils.rmDir(root, item.name, done);
                }
                else{
                    fileutils.mkdirs(root, item.name, function(dir){
                        setupFileStructure(dir, item.entries, done);
                    });
                }
            },  callback);
        }
        
        var blowAwayWorkingDir = function(dir, callback){
            fileutils.ls(dir, function(entries){
                entries.asyncEach(function(item, done){
                    if (item.name == '.git'){
                        done();
                    }
                    else if (item.isDirectory){
                        item.removeRecursively(done);
                    }
                    else{
                        item.remove(done);
                    }
                },
                callback);
            });
        }
        
        
        var initial = [
            {name: '1.txt', contents: '1'},
            {name: '2.txt', contents: '2'},
            {name: '3.txt', contents: '3'},
            {name: 'aaa', entries: [
                                        {name: '4.txt', contents:'4'},
                                        //{name: 'bbb', entries:[]}
                                   ]},
            {name: 'bbb', entries: [
                                        {name: '5.txt', contents: '5'},
                                        {name: '6.txt', contents: '6'}
                                   ]}
        ];

        var test1 = [
            {name: '1.txt', contents: '14'},
            {name: '2.txt', contents: '2' + new Date().getTime()},
            {name: '3.txt', contents: '3'},
            {name: 'aaa', entries: [
                                        {name: '4.txt', contents:'4'},
                                        //{name: 'bbb', entries:[]}
                                   ]},
            {name: 'bbb', entries: [
                                        {name: '5.txt', contents: '5'},
                                        {name: '6.txt', contents: '6'}
                                   ]}
        ];

        var test2 = [
            {name: '1.txt', contents: '17'},
            {name: '2.txt', contents: '22' + new Date().getTime()},
            {name: '3.txt', contents: '3'},
            {name: 'aaa', entries: [
                                        {name: '4.txt', contents:'4'},
                                        //{name: 'bbb', entries:[]}
                                   ]},
            {name: 'bbb', entries: [
                                        {name: '5.txt', contents: '5'},
                                        {name: '6.txt', contents: '6'}
                                   ]}
        ];
        
        var resetRemote = function(url, depth, initial, callback){
            
            GitLite.clone({dir: testDir, url: url}, function(){
                verifyHead('refs/heads/master', function(){
                    ok(true, 'clone was successful');
                    blowAwayWorkingDir(testDir, function(){
                        setupFileStructure(testDir, initial, function(){
                            GitLite.commit({dir: testDir, name: commitName, email: commitEmail, commitMsg: 'commit message'}, function(sha){
                                ok(true, 'commit of new working dir was successful');
                                GitLite.push({dir: testDir, url: url}, function(){
                                    ok(true, 'successfully pushed into url');
                                    callback();
                                });
                            }, function(e){
                                if (e.type == 8){
                                    callback();
                                }
                                else{
                                    ok(false);
                                }
                            });
                        });
                    });
                });
            });
        }
        
        var cloneCommitPushTest = function(depth, initial){
            return function(){
                resetRemote(knownRepoUrl, depth, initial, function(){
                    start();
                });
            }
        }
        asyncTest("Test Clone, commit, then push", cloneCommitPushTest(0, test1));
        asyncTest("Test Clone shallow, commit, then push", cloneCommitPushTest(1, test2));
        
        
        var createMirrorRepo = function(url, callback){
            window.requestFileSystem(window.PERSISTENT, 5*1024*1024*1024, function(fs){
                var dirEntry = fs.root;
                dirEntry.getDirectory(root + 'testDir1', {create:true}, function(testDir){
                    //var repo = new Git.FileRepo(testDir);
                    GitLite.clone({dir: testDir, url: url}, function(){
                        callback(testDir);
                    });
                });
            });
        }
        var createMirrorRepo2 = function(url, callback){
            window.requestFileSystem(window.PERSISTENT, 5*1024*1024*1024, function(fs){
                var dirEntry = fs.root;
                dirEntry.getDirectory(root + 'testDir2', {create:true}, function(testDir){
                    //var repo = new Git.FileRepo(testDir);
                    GitLite.clone({dir: testDir, url: url}, function(){
                        callback(testDir);
                    });
                });
            });
        }
        var pushFastForwardCommit = function(url, callback){
            
            createMirrorRepo(url, function(testDir){
                fileutils.mkfile(testDir, '7.txt', '7\n8\n9', function(){
                    GitLite.commit({dir: testDir, name: commitName, email: commitEmail, commitMsg: 'commit message'}, function(sha){
                        GitLite.push({dir: testDir, url: url}, function(){
                            callback();
                        });
                    });
                });
            });
                
        }
        
        var setupPullTest = function(depth, initial, callback){
            resetRemote(knownRepoUrl, depth, initial, function(){
                callback();
            });
        }
        
        simplePullTest = function(depth){
            return function(){
                setupPullTest(depth, initial, function(){
                    pushFastForwardCommit(knownRepoUrl, function(){
                        GitLite.pull({dir: testDir, url: knownRepoUrl}, function(){
                            fileutils.readFile(testDir, '7.txt', 'Text', function(data){
                                equal('7\n8\n9', data);
                                start();
                            }, fail('7.txt doesn\'t exist', start));
                        });
                    });
                });
            }
        }

        asyncTest("Test FF Pull simple", simplePullTest());
        asyncTest("Test FF Pull simple shallow", simplePullTest(1));

        
        var folderMergeAdd = [
            {name : 'bbb', entries: [
                                        {name: '12.txt', contents: '12'},
                                        {name: '13.txt', contents: '13'}
                                    ]}
        ];
        
        var folderMergeChange = [
            {name : 'bbb', entries: [
                                        {name: '5.txt', contents: '55555'}
                                    ]}
        ];
        
        var folderMergeDelete = [
            {name : 'bbb', entries: [
                                        {name: '5.txt', rmFile:true}
                                    ]}
        ];      
        
        var folderDelete = [{name : 'aaa', rmDir: true}];
        
        var fileDelete = [{name : '1.txt', rmFile: true}];
        
        var fileChange = [{name : '1.txt', contents:'1.1'}];
            
        var fastForwardPullTest = function(name, ops, depth){  
            asyncTest(name, function(){
                setupPullTest(depth, initial, function(repo){
                    createMirrorRepo(knownRepoUrl, function(testDir1){
                        setupFileStructure(testDir1, ops, function(){
                            GitLite.commit({dir: testDir1, name: commitName, email: commitEmail, commitMsg: 'commit message'}, function(){
                                GitLite.push({dir: testDir1, url: knownRepoUrl}, function(){
                                    GitLite.pull({dir: testDir, url: knownRepoUrl}, function(){
                                        verifyHead('refs/heads/master', function(){
                                            ok(true);
                                            start();
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }
        fastForwardPullTest("Test FF Pull with folder merge and some added files", folderMergeAdd);
        fastForwardPullTest("Test FF Pull with folder merge and a changed file", folderMergeChange);
        fastForwardPullTest("Test FF Pull with folder merge and a deleted file", folderMergeDelete);
        fastForwardPullTest("Test FF Pull with a deleted folder", folderDelete);
        fastForwardPullTest("Test FF Pull with a deleted files", fileDelete);
        fastForwardPullTest("Test FF Pull with a changed file", fileChange);

        fastForwardPullTest("Test FF Pull with folder merge and some added files shallow", folderMergeAdd, 1);
        fastForwardPullTest("Test FF Pull with folder merge and a changed file shallow", folderMergeChange, 1);
        fastForwardPullTest("Test FF Pull with folder merge and a deleted file shallow", folderMergeDelete, 1);
        fastForwardPullTest("Test FF Pull with a deleted folder shallow", folderDelete, 1);
        fastForwardPullTest("Test FF Pull with a deleted files shallow", fileDelete, 1);
        fastForwardPullTest("Test FF Pull with a changed file shallow", fileChange, 1);
    
        module("Error condition tests", {setup: testSetup, teardown:testTeardown})
        
        asyncTest("File IO error", function(){
            fileutils.mkfile(testDir, '.git', 'adasd', function(file){
                // try to clone into a file
                GitLite.clone({dir: testDir, url: knownRepoUrl}, function(){ 
                    ok(false, "error should've been thrown");
                    start();
                },
                function(e){
                    equal(GitLite.FILE_IO_ERROR, e.type);
                    start();
                })
            });
        });

        asyncTest("Ajax error", function(){
            GitLite.clone({dir: testDir, url: "http://www.google.com"}, function(){
                ok(false, "error should've been thrown");
                start();
            },
            function(e){
                equal(GitLite.AJAX_ERROR, e.type);
                start();
            });
        });

        asyncTest("Clone directory not empty", function(){
            fileutils.mkfile(testDir, 'test', 'adasd', function(file){
                GitLite.clone({dir: testDir, url: knownRepoUrl}, function(){ 
                    ok(false, "error should've been thrown");
                    start();
                },
                function(e){
                    equal(GitLite.CLONE_DIR_NOT_EMPTY, e.type);
                    start();
                })
            });
        });

        asyncTest("Clone into existing git db", function(){
            GitLite.clone({dir: testDir, url: knownRepoUrl}, function(){ 
                fileutils.ls(testDir, function(entries){
                    entries.asyncEach(function(entry, done){
                        if (entry.isFile){
                            entry.remove(done, done);
                        }
                        else{
                            if (entry.name == '.git'){
                                done();
                                return;
                            }
                            entry.removeRecursively(done, done);
                        }
                    },
                    function(){
                        GitLite.clone({dir: testDir, url: knownRepoUrl}, function(){ 
                            ok(false, "error should've been thrown");
                            start();
                        },
                        function(e){
                            equal(GitLite.CLONE_GIT_DIR_IN_USE, e.type);
                            start();
                        });
                    });
                })
            });
        });

        asyncTest("Clone a non-existent branch", function(){
            GitLite.clone({dir: testDir, url: knownRepoUrl, branch: "nonexistent"}, function(){
                ok(false, "error should've been thrown");
                start();
            },
            function(e){
                equal(GitLite.REMOTE_BRANCH_NOT_FOUND, e.type);
                start();
            });
        });

        asyncTest("Non-fast-forward pull error", function(){
            setupPullTest(0, initial, function(){
                pushFastForwardCommit(knownRepoUrl, function(){
                    setupFileStructure(testDir, folderMergeChange, function(){
                        GitLite.commit({dir: testDir, name: commitName, email: commitEmail, commitMsg: 'commit message'}, function(){
                            GitLite.pull({dir: testDir, url: knownRepoUrl}, function(){
                                ok(false,"error should've been thrown");
                                start();
                            },
                            function(e){
                                equal(GitLite.PULL_NON_FAST_FORWARD, e.type);
                                start();
                            });
                        });
                    });
                });
            });
        });

        asyncTest("Up to date pull", function(){
            GitLite.clone({dir: testDir, url: knownRepoUrl}, function(){
                GitLite.pull({dir: testDir, url: knownRepoUrl}, function(){
                    ok(false, "error should've been thrown");
                    start();
                },
                function(e){
                    equal(GitLite.PULL_UP_TO_DATE, e.type);
                    start();
                });
            });
        });

        asyncTest("No changes to commit", function(){
            GitLite.clone({dir: testDir, url: knownRepoUrl}, function(){
                setupFileStructure(testDir, folderMergeChange, function(){
                    GitLite.commit({dir: testDir, name: commitName, email: commitEmail, commitMsg: 'commit message'}, function(){
                        GitLite.commit({dir: testDir, name: commitName, email: commitEmail, commitMsg: 'commit message'}, function(){
                            ok(false, "error should've been thrown");
                            start();
                        },
                        function(e){
                            equal(GitLite.COMMIT_NO_CHANGES, e.type);
                            start();
                        });
                    });
                });
            });
        });

        asyncTest("No changes to push", function(){
            GitLite.clone({dir: testDir, url: knownRepoUrl}, function(){
                setupFileStructure(testDir, folderMergeChange, function(){
                    GitLite.commit({dir: testDir, name: commitName, email: commitEmail, commitMsg: 'commit message'}, function(){
                        GitLite.push({dir: testDir, url: knownRepoUrl}, function(){
                            GitLite.push({dir: testDir, url: knownRepoUrl}, function(){
                                ok(false, "error should've been thrown");
                                start();
                            },
                            function(e){
                                equal(GitLite.PUSH_NO_CHANGES, e.type);
                                start();
                            });
                        });
                    });
                });
            });
        });

        asyncTest("No remote to push to", function(){
            setupFileStructure(testDir, initial, function(){
                GitLite.commit({dir: testDir, name: commitName, email: commitEmail, commitMsg: 'commit message'}, function(){
                    GitLite.push({dir: testDir}, function(){
                        ok(false, "error should've been thrown");
                        start();
                    },
                    function(e){
                        equal(GitLite.PUSH_NO_REMOTE, e.type);
                        start();
                    });
                });
            });
        });

        asyncTest("Non-fast-forward push error", function(){
            setupPullTest(0, initial, function(){
                pushFastForwardCommit(knownRepoUrl, function(){
                    setupFileStructure(testDir, folderMergeChange, function(){
                        GitLite.commit({dir: testDir, name: commitName, email: commitEmail, commitMsg: 'commit message'}, function(){
                            GitLite.push({dir: testDir, url: knownRepoUrl}, function(){
                                ok(false, "error should've been thrown");
                                start();
                            },
                            function(e){
                                equal(GitLite.PUSH_NON_FAST_FORWARD, e.type);
                                start();
                            });
                        });
                    });
                });
            });
        });

        asyncTest("pull with uncommitted changes", function(){
            setupPullTest(0, initial, function(){
                pushFastForwardCommit(knownRepoUrl, function(){
                    setupFileStructure(testDir, folderMergeChange, function(){
                        GitLite.pull({dir: testDir, url: knownRepoUrl}, function(){
                            ok(false, "error should've been thrown");
                            start();
                        },
                        function(e){
                            equal(GitLite.UNCOMMITTED_CHANGES, e.type);
                            start();
                        });
                    });
                });
            });
        });

        asyncTest("Empty repo with uncommitted changes", function(){
            setupFileStructure(testDir, initial, function(){
                GitLite.checkForUncommittedChanges({dir: testDir}, function(){
                    ok(false, "error should've been thrown");
                    start();
                },
                function(e){
                    equal(GitLite.UNCOMMITTED_CHANGES, e.type);
                    start();
                });
            });
        })

        module("Branch tests", {setup: testSetup, teardown:testTeardown});

        var createTestBranch = function(name, cloneDepth, success){
            setupPullTest(cloneDepth, initial, function(){
                GitLite.branch({dir: testDir, branch: name}, function(){
                    fileutils.readFile(testDir, '.git/refs/heads/' + name, 'Text', function(branchSha){
                        fileutils.readFile(testDir, '.git/refs/heads/master', 'Text', function(masterSha){
                            equal(masterSha, branchSha);;
                            success();
                        })  
                    })
                })
            });
        }
        var createRandomTestBranch = function(cloneDepth,success){
            var randomBranchName = 'testBranch-' + new Date().getTime();
            createTestBranch(randomBranchName, cloneDepth, function(){
                success(randomBranchName);
            }); 
        }
        asyncTest("Simple branching", function(){
            createTestBranch('testBranch', 0, start);
        });

        asyncTest("Test bad branch names", function(){
            // see https://www.kernel.org/pub/software/scm/git/docs/git-check-ref-format.html for rules
            var badNames = ['..noDots', 'no..Dots', 'noDots..', 'no\ttabs', 'no spaces', 'no\u0000special','no~tilde', 'no^caret', 'no:colon', 'no?mark', 'no*asterisk', 'noopen[bracket', 'noendslash/', 'noenddot.','.nobegindot', 'no@{seq', 'no\\backslash', 'no.lock'];
            require(['commands/branch'], function(branch){
                badNames.asyncEach(function(name, done){
                    try{
                        branch({branch: name}, function(){
                            ok(false, 'shouldn\'t get here');
                            done();  
                        }, function(e){
                            if (e.type == GitLite.BRANCH_NAME_NOT_VALID){
                                ok(true, name + ' is invalid');
                            }
                            else{
                                ok(false, name + ' should be invalid');
                            }
                            done();
                        })
                    }
                    catch(e){
                        ok(false, name + ' should be invalid');
                        done();
                    }
                },start);
            })
        });

        module("Checkout tests", {setup: testSetup, teardown:testTeardown});

        asyncTest('Create a branch from head then immediately check it out', function(){
            createTestBranch('testBranch', 0, function(){
                GitLite.checkout({dir: testDir, branch: 'testBranch'}, function(){
                    fileutils.readFile(testDir, '.git/HEAD', 'Text', function(headRef){
                        equal(headRef.trim(), 'ref: refs/heads/testBranch');
                        verifyHead('refs/heads/testBranch', function(){
                            start();
                        });
                    });  
                });
            });
        });

        asyncTest('Create a branch from head with uncommitted changes then immediately check it out', function(){
            createTestBranch('testBranch', 0, function(){
                setupFileStructure(testDir, folderMergeAdd, function(){
                    GitLite.checkout({dir: testDir, branch: 'testBranch'}, function(){
                        fileutils.readFile(testDir, '.git/HEAD', 'Text', function(headRef){
                            equal(headRef.trim(), 'ref: refs/heads/testBranch');
                            fileutils.readFile(testDir, 'bbb/12.txt', 'Text', function(txt){
                                equal('12', txt);
                                start();
                            })
                        });  
                    });
                });
            });
        });

        asyncTest('Create a branch from head, commit some changes then check out new branch', function(){
            createTestBranch('testBranch', 0, function(){
                setupFileStructure(testDir, folderMergeAdd, function(){
                    GitLite.commit({dir: testDir, name: commitName, email: commitEmail, commitMsg: 'commit message'}, function(){
                        GitLite.checkout({dir: testDir, branch: 'testBranch'}, function(){
                            fileutils.readFile(testDir, '.git/HEAD', 'Text', function(headRef){
                                equal(headRef.trim(), 'ref: refs/heads/testBranch');
                                verifyHead('refs/heads/testBranch', function(){
                                    GitLite.checkout({dir: testDir, branch: 'master'}, function(){
                                        verifyHead('refs/heads/master', start);
                                    });
                                });
                            });  
                        });
                    });
                });
            });
        });

        asyncTest('Checkout a diverged branch with uncommitted changes', function(){
            createTestBranch('testBranch', 0, function(){
                setupFileStructure(testDir, folderMergeAdd, function(){
                    GitLite.commit({dir: testDir, name: commitName, email: commitEmail, commitMsg: 'commit message'}, function(){
                        // one problem with checking timestamps is that the html5 filesystem records modification time 
                        // with 1 second granularisty. 
                        window.setTimeout(function(){
                            setupFileStructure(testDir, folderDelete, function(){
                                GitLite.checkout({dir: testDir, branch: 'testBranch'}, function(){
                                    ok(false, 'The checkout should fail');
                                    start();     
                                }, function(e){
                                    equal(e.type, GitLite.UNCOMMITTED_CHANGES);
                                    start();
                                });
                            });
                        }, 2000);
                    });
                });
            });
        });
        var checkoutBranchChangeAndPushTest = function(depth){
            return function(){
                createRandomTestBranch(depth, function(branchName){
                    GitLite.checkout({dir: testDir, branch: branchName}, function(){
                        setupFileStructure(testDir, folderMergeAdd, function(){
                            GitLite.commit({dir: testDir, name: commitName, email: commitEmail, commitMsg: 'commit message'}, function(){
                                GitLite.push({dir: testDir}, function(){
                                    ok(true, 'push successful');
                                    start();
                                },
                                function(e){
                                    ok(false, 'push unsuccessful');
                                    start();
                                });
                            });
                        });
                    });
                });
            }
        }

        asyncTest('Checkout branch make some changes and push it to remote', checkoutBranchChangeAndPushTest());
        asyncTest('Checkout branch make some changes and push it to remote shallow', checkoutBranchChangeAndPushTest(1));

        var checkoutBranchAndPushTest = function(depth){
            return function(){
                createRandomTestBranch(depth, function(branchName){
                    GitLite.checkout({dir: testDir, branch: branchName}, function(){
                        GitLite.push({dir: testDir}, function(){
                            ok(true, 'push successful');
                            start();
                        },
                        function(e){
                            ok(false, 'push unsuccessful');
                            start();
                        });
                    });
                });
            }
        }

        asyncTest('Checkout branch make no changes and push it to remote', checkoutBranchAndPushTest());
        asyncTest('Checkout branch make no changes and push it to remote shallow', checkoutBranchAndPushTest(1));

        module("Tree Merging Tests", {setup: testSetup, teardown:testTeardown});


        var initialForMerge = [
            {name: '1.txt', contents: '1\n2\n3\n4'},
            {name: '2.txt', contents: '2\n3'},
            {name: '3.txt', contents: '3\n4'},
            {name: 'aaa', entries: [
                                        {name: '4.txt', contents:'4\n6\n7\n8'},
                                        //{name: 'bbb', entries:[]}
                                   ]},
            {name: 'bbb', entries: [
                                        {name: '5.txt', contents: '5\ntest'},
                                        {name: '6.txt', contents: '6\n1\n89\n90\n45'}
                                   ]}
        ];

        var entriesSort = function(a, b){
            var nameA = a.name, nameB = b.name;
            if (nameA < nameB) //sort string ascending
                return -1 
            if (nameA > nameB)
                return 1
            return 0 //default return value (no sorting)
        }

        var compareDirs = function(expected, actual, callback){
            fileutils.ls(expected, function(expectedFiles){
                expectedFiles.sort(entriesSort);
                fileutils.ls(actual, function(actualFiles){
                    actualFiles.sort(entriesSort);
                    var isEqual = true;
                    actualFiles.asyncEach(function(item, done, idx){
                        if (!isEqual){
                            done();
                            return;
                        }
                        var expectedItem = expectedFiles[idx];
                        if (item.name != expectedItem.name){
                            isEqual = false;
                            done();
                            return;
                        }

                        if (item.isFile){
                            if (expectedItem.isFile){
                                compareFiles(item, expectedItem, function(eq){
                                    isEqual = eq;
                                    done();
                                });
                            }
                            else{
                                isEqual = false;
                                done();
                            }
                        }
                        else{
                            if (expectedItem.isFile){
                                isEqual = false;
                                done();
                            }
                            else{
                                compareDirs(expectedItem, item, function(eq){
                                    isEqual = eq;
                                    done();
                                });
                            }
                        }

                    },
                    function(){
                        callback(isEqual);
                    });
                });
            });
        }

        var compareFiles = function(file1, file2, callback){
            fileutils.readFileEntry(file1, "Text", function(data1){
                fileutils.readFileEntry(file2, "Text", function(data2){
                    callback(data1 == data2);
                });
            });
        }

        var verifyMerge = function(mirror, opsMerged, callback){
            setupFileStructure(mirror, opsMerged, function(){
                compareDirs(mirror, testDir, callback);
            });
        } 

        var mergeTreeTest = function(name, ops1, ops2, opsMerged){
            asyncTest(name, function(){
                setupPullTest(0, initialForMerge, function(repo){
                    setupFileStructure(testDir, ops1, function(){
                        repo.commit(function(){
                            createMirrorRepo(knownRepoUrl, function(repo1, testDir1){
                                createMirrorRepo2(knownRepoUrl, function(repo2, testDir2){
                                    setupFileStructure(testDir1, ops2, function(){
                                        repo1.commit(function(){
                                            repo1.push(knownRepoUrl, function(){
                                                repo.pull(knownRepoUrl, function(){
                                                    verifyMerge(testDir2, opsMerged, function(success){
                                                        ok(success);
                                                        start();
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }

        chrome.storage.local.get(null, function(data){
            knownRepoUrl = data['knownRepoUrl'];
            commitName = data['commitName'];
            commitEmail = data['commitEmail'];

            $('#url').val(knownRepoUrl);
            $('#commitName').val(commitName);
            $('#commitEmail').val(commitEmail);
        })

        $('#repo-form').submit(function(){
            knownRepoUrl = $('#url').val();
            commitName = $('#commitName').val();
            commitEmail = $('#commitEmail').val();

            var obj = {knownRepoUrl: knownRepoUrl, commitName: commitName, commitEmail: commitEmail};
            chrome.storage.local.set(obj);

            start();
            return false;
        });
        //start();
        //mergeTreeTest("FF Merge w/ tree merge test", folderMergeAdd, folderMergeChange, folderMergeAdd);
        
   }
