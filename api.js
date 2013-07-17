// requirejs.config({
//     shim: {

//     }
// });

define(['commands/clone', 'commands/commit', 'commands/init', 'commands/pull', 'commands/push', 'commands/branch', 'commands/checkout', 'commands/conditions', 'objectstore/file_repo', 'formats/smart_http_remote', 'utils/errors', 'thirdparty/2.2.0-sha1', 'thirdparty/crc32', 'thirdparty/deflate.min', 'thirdparty/inflate.min', "workers/worker_messages"], function(clone, commit, init, pull, push, branch, checkout, Conditions, FileObjectStore, SmartHttpRemote, errutils){
    
    var api = {

         // Indicates an unexpected error in the file system.
        FILE_IO_ERROR: errutils.FILE_IO_ERROR,
        // Indicates an unexpected ajax error when trying to make a request
        AJAX_ERROR: errutils.AJAX_ERROR, 
        // trying to clone into a non-empty directory
        CLONE_DIR_NOT_EMPTY: errutils.CLONE_DIR_NOT_EMPTY,
        // .git directory already contains objects
        CLONE_GIT_DIR_IN_USE: errutils.CLONE_GIT_DIR_IN_USE,
        // No branch found with the name given
        REMOTE_BRANCH_NOT_FOUND: errutils.REMOTE_BRANCH_NOT_FOUND,
        // only supports fast forward merging at the moment.
        PULL_NON_FAST_FORWARD: errutils.PULL_NON_FAST_FORWARD,
        // Branch is up to date
        PULL_UP_TO_DATE: errutils.PULL_UP_TO_DATE,
        // Nothing to commit
        COMMIT_NO_CHANGES: errutils.COMMIT_NO_CHANGES,
        // The remote repo and the local repo share the same head.
        PUSH_NO_CHANGES: errutils.PUSH_NO_CHANGES,
        // Need to merge remote changes first.
        PUSH_NON_FAST_FORWARD: errutils.PUSH_NON_FAST_FORWARD,
        // unexpected problem retrieving objects
        OBJECT_STORE_CORRUPTED: errutils.OBJECT_STORE_CORRUPTED,
        // pull is attempted with uncommitted changed
        UNCOMMITTED_CHANGES: errutils.UNCOMMITTED_CHANGES,
        // 401 when attempting to make a request
        HTTP_AUTH_ERROR: errutils.HTTP_AUTH_ERROR,

        BRANCH_NAME_NOT_VALID: errutils.BRANCH_NAME_NOT_VALID,

        PUSH_NO_REMOTE: errutils.PUSH_NO_REMOTE,
        
        // init : function(options, success, error){
        //     var objectStore = new FileObjectStore(options.dir);
        //     init({objectStore: objectStore}, success, error);
        // },
        clone : function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                
                clone({
                        dir: options.dir, 
                        branch: options.branch, 
                        objectStore: objectStore, 
                        url: options.url, 
                        depth: options.depth, 
                        progress: options.progress,
                        username: options.username,
                        password: options.password
                    }, 
                    success, error);

            }, error);
        },
        pull : function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                
                pull({
                        dir: options.dir, 
                        objectStore: objectStore,
                        username: options.username,
                        password: options.password,
                        progress: options.progress
                    }, 
                    success, error);

            }, error);
        },
        commit : function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                
                commit({
                            dir: options.dir, 
                            username: options.name, 
                            email: options.email, 
                            commitMsg: options.commitMsg, 
                            objectStore: objectStore
                        }, success, error);
            }, error);
        },
        push : function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                push({
                        objectStore: objectStore, 
                        dir: options.dir, 
                        url: options.url,
                        username: options.username,
                        password: options.password,
                        progress: options.progress
                    }, 
                    success, error);
            }, error);
        },
        branch: function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                branch({
                    objectStore: objectStore,
                    dir: options.dir,
                    branch: options.branch
                }, success, error);
            }, error);

        },
        checkout: function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                checkout({
                    objectStore: objectStore,
                    dir: options.dir,
                    branch: options.branch
                }, success, error);
            }, error);
        },

        checkForUncommittedChanges: function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                Conditions.checkForUncommittedChanges(options.dir, objectStore, success, error);
            }, error);
        },
        getCurrentBranch : function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                objectStore.getHeadRef(function(ref){
                    success(ref.substring('refs/heads/'.length));
                });
            }, error);
        },
        getLocalBranches : function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                objectStore.getAllHeads(success);
            }, error);
        },
        getRemoteBranches : function(options, success, error){
            var remote = SmartHttpRemote(null, null, options.url, options.username, options.password, error);
            remote.fetchRefs(function(refs){
                var remoteBranches = [];
                refs.forEach(function(ref){
                    if (ref.name.indexOf('refs/heads/') == 0){
                        remoteBranches.push(ref.name.substring('refs/heads/'.length));
                    }
                });
                success(remoteBranches);
            });
        }

    }
    return api;
});