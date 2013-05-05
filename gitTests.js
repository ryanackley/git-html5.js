

var fail = function(msg, callback){
        return function(){
            ok(false, msg);
            callback();
        }
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
                start();
                window.testDir = testDir;
            }); 
        });
    }
    var testTeardown = function(){
        if (testDir){
            stop()
            testDir.removeRecursively(function(){
                window.requestFileSystem(window.PERSISTENT, 5*1024*1024*1024, function(fs){
                    Gito.FileUtils.rmDir(fs.root, root + 'testDir1', function(){
                        start();
                    });
                });
            });
        }
    }
    
  $(document).ready(function(){
    var taskRunner = window.taskRunner;

    
    module("Supporting Lib tests", {setup: testSetup, teardown:testTeardown});
    
    asyncTest("Deflate to Inflate test", function(){
        var msg = "blah blah blah blah blargh smdnakjdhjkahsdjkasd hjka dkja dhjkajk dh ajkd hkja sdhjk";
        var bytes = Git.stringToBytes(msg);
        expect(1);
        //stop();
        var compressed = RawDeflate.deflate(bytes);
        
        var reader = new FileReader();
        reader.onloadend = function(){
            var uncompressed = RawDeflate.inflate(new Uint8Array(reader.result));
            
            var reader1 = new FileReader();
            reader1.onloadend = function(){
                equal(msg, reader1.result);
                start();
            }
            reader1.readAsText(uncompressed);
        }
        reader.readAsArrayBuffer(compressed);
    });
    
    asyncTest("FileUtil mk and rm dirs", function(){
        var dirs = ['a','b','c','d','e'];
        Gito.FileUtils.mkdirs(testDir, dirs.join('/'), function(newDir){
            verifyDir(testDir, dirs.join('/'), function(){
                Gito.FileUtils.rmDir(testDir,dirs[0], function(){
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
        Gito.FileUtils.mkfile(testDir, path.join('/'), content, function(file){
            verifyFile(testDir, path.join('/'), content, function(){
                Gito.FileUtils.readFile(testDir, path.join('/'), 'Text', function(readContent){
                    equal(content, readContent);
                    Gito.FileUtils.rmFile(testDir, path.join('/'), function(){
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
    
    var knownRepoUrl = /*'http://localhost/git/testDir';*/'https://github.com/ryanackley/GitTest.git';
        
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
            Gito.FileUtils.mkfile(testDir, fileName, fileContent, function(){
                var repo = new Git.FileRepo(testDir);
                repo.init(function(){
                    repo.commit(function(sha){
                        callback(repo, sha);
                    });
                });
            });
        }
        
        asyncTest("Test Simple Git Commit", function(){
        
            var cName = 'Ryan Ackley';
            var cEmail = 'ryanackley@gmail.com';
            var aName = 'Ryan Ackley';
            var aEmail = 'ryanackley@gmail.com';
            var message = 'commit message';
            
            var fileName = "simple.txt";
            var fileContent = "1";
            
            doSimpleCommit(fileName, fileContent, function(repo, sha){
                var store = repo.objectStore;
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
                            var contents = Git.bytesToString(new Uint8Array(blob.data));
                            start();
                        });
                    });
                });
            });
                    
        });
        
        asyncTest("Test Git Commit Parent",function(){
            doSimpleCommit('simple.txt', '1', function(repo, firstCommitSha){
                doSimpleCommit('simple.txt', '1\n2', function(repo, secondCommitSha){
                    repo.objectStore._retrieveObject(secondCommitSha, 'Commit', function(commit){
                        equal(firstCommitSha, commit.parents[0]);
                        start();
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
        var verifyHead = function(repo, refName, callback){
            var store = repo.objectStore;
            store._getHeadForRef(refName, function(sha){
            
                var verifyTree = function(tree, dir, callback){
                    Gito.FileUtils.ls(dir, function(entries){
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
                                    Gito.FileUtils.readFileEntry(item.file, 'Text', function(fileString){
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
        }
        
        asyncTest("Test Clone", function(){
            var repo = new Git.FileRepo(testDir);
            repo.clone(knownRepoUrl, function(){
                verifyHead(repo, 'refs/heads/master', function(){
                    ok(true, 'clone was successful');
                    start();
                });
            });
        });
        
        
        
        
        var setupFileStructure = function(root, files, callback){
            files.asyncEach(function(item, done){
                if(item.contents){
                    Gito.FileUtils.mkfile(root, item.name, item.contents, done);
                }
                else if (item.rmFile){
                    Gito.FileUtils.rmFile(root, item.name, done);
                }
                else if (item.rmDir){
                    Gito.FileUtils.rmDir(root, item.name, done);
                }
                else{
                    Gito.FileUtils.mkdirs(root, item.name, function(dir){
                        setupFileStructure(dir, item.entries, done);
                    });
                }
            },  callback);
        }
        
        var blowAwayWorkingDir = function(dir, callback){
            Gito.FileUtils.ls(dir, function(entries){
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
        
        var resetRemote = function(dir, url, initial, callback){
            var repo = new Git.FileRepo(dir);
            repo.clone(url, function(){
                verifyHead(repo, 'refs/heads/master', function(){
                    ok(true, 'clone was successful');
                    blowAwayWorkingDir(dir, function(){
                        setupFileStructure(dir, initial, function(){
                            repo.commit(function(sha){
                                ok(true, 'commit of new working dir was successful');
                                repo.push(url, function(){
                                    ok(true, 'successfully pushed into url');
                                    callback(repo);
                                });
                            });
                        });
                    });
                });
            });
        }
        
        asyncTest("Test Clone, commit, then push", function(){
            resetRemote(testDir, knownRepoUrl, initial, function(){
                start();
            });
        });
        
        
        var createMirrorRepo = function(url, callback){
            window.requestFileSystem(window.PERSISTENT, 5*1024*1024*1024, function(fs){
                var dirEntry = fs.root;
                dirEntry.getDirectory(root + 'testDir1', {create:true}, function(testDir){
                    var repo = new Git.FileRepo(testDir);
                    repo.clone(url, function(){
                        callback(repo, testDir);
                    });
                });
            });
        }
        var createMirrorRepo2 = function(url, callback){
            window.requestFileSystem(window.PERSISTENT, 5*1024*1024*1024, function(fs){
                var dirEntry = fs.root;
                dirEntry.getDirectory(root + 'testDir2', {create:true}, function(testDir){
                    var repo = new Git.FileRepo(testDir);
                    repo.clone(url, function(){
                        callback(repo, testDir);
                    });
                });
            });
        }
        var pushFastForwardCommit = function(url, callback){
            
            createMirrorRepo(url, function(repo, testDir){
                Gito.FileUtils.mkfile(testDir, '7.txt', '7\n8\n9', function(){
                    repo.commit(function(sha){
                        repo.push(url, function(){
                            callback();
                        });
                    });
                });
            });
                
        }
        
        var setupPullTest = function(initial, callback){
            var repo = new Git.FileRepo(testDir);
            repo.clone(knownRepoUrl, function(){
                resetRemote(testDir, knownRepoUrl, initial, function(repo){
                    callback(repo);
                });
            });
        }
        
        asyncTest("Test FF Pull simple", function(){
            setupPullTest(initial, function(repo){
                pushFastForwardCommit(knownRepoUrl, function(){
                    repo.pull(knownRepoUrl, function(){
                        Gito.FileUtils.readFile(testDir, '7.txt', 'Text', function(data){
                            equal('7\n8\n9', data);
                            start();
                        }, fail('7.txt doesn\'t exist', start));
                    });
                });
            });
        });
        
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
            
        var fastForwardPullTest = function(name, ops){  
            asyncTest(name, function(){
                setupPullTest(initial, function(repo){
                    createMirrorRepo(knownRepoUrl, function(repo1, testDir1){
                        setupFileStructure(testDir1, ops, function(){
                            repo1.commit(function(){
                                repo1.push(knownRepoUrl, function(){
                                    repo.pull(knownRepoUrl, function(){
                                        verifyHead(repo, 'refs/heads/master', function(){
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
            Gito.FileUtils.ls(expected, function(expectedFiles){
                expectedFiles.sort(entriesSort);
                Gito.FileUtils.ls(actual, function(actualFiles){
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
            Gito.FileUtils.readFileEntry(file1, "Text", function(data1){
                Gito.FileUtils.readFileEntry(file2, "Text", function(data2){
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
                setupPullTest(initialForMerge, function(repo){
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

        mergeTreeTest("FF Merge w/ tree merge test", folderMergeAdd, folderMergeChange, folderMergeAdd);
        
   });
