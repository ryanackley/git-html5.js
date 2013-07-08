// requirejs.config({
//     shim: {

//     }
// });

define(['commands/clone', 'commands/commit', 'commands/init', 'commands/pull', 'commands/push', 'objectstore/file_repo', 'utils/errors', 'thirdparty/2.2.0-sha1', 'thirdparty/crc32', 'thirdparty/deflate.min', 'thirdparty/inflate.min', "worker_messages.js"], function(clone, commit, init, pull, push, FileObjectStore, errutils){
    
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
        PULL_UNCOMMITTED_CHANGES: errutils.PULL_UNCOMMITTED_CHANGES,

        
        init : function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            init({objectStore: objectStore}, success, error);
        },
        clone : function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                //clone(dir, objectStore, url, callback);
                clone({dir: options.dir, branch: options.branch, objectStore: objectStore, url: options.url, depth: options.depth}, success, error);
            }, error);
        },
        pull : function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                //pull(dir, objectStore, url, callback);
                pull({dir: options.dir, objectStore: objectStore}, success, error);
            }, error);
        },
        commit : function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                //commit(dir, objectStore, callback);
                commit({dir: options.dir, username: options.username, email: options.email, commitMsg: options.commitMsg, objectStore: objectStore}, success, error);
            }, error);
        },
        push : function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                push({objectStore: objectStore, dir: options.dir, url: options.url}, success, error);
            }, error);
        }
    }
    return api;
});