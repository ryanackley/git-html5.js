define(['text!workers/api-worker-built.js', 'utils/errors', 'workers/worker_messages'],function(apiWorkerText, errutils){
    var workerBlob = new Blob([apiWorkerText], {type: "text/javascript"});
    var workerUrl = URL.createObjectURL(workerBlob);

    var newResponseHandler = function(success, error, progress, worker){
        var updateProgress = function(){}
        if (progress){
            updateProgress = function(){
                progress.apply(null, msg.args || []);
            }
        }
        error = error || function(e){console.error(e);}
        return function(evt){

            var msg = evt.data;
            switch(msg.type){
                case GitLiteWorkerMessages.SUCCESS:
                    console.log('success');
                    success.apply(null, msg.args || []);
                    //worker.terminate();
                    break;
                case GitLiteWorkerMessages.ERROR:
                    error(msg.error);
                    //worker.terminate();
                    break;
                case GitLiteWorkerMessages.PROGRESS:
                    updateProgress();
                    break;
            }
        }
    }
    var id = 0;
    callbacks = {};
    var worker;
    var doApiCall = function(type, options, success, error){
        options.dir = options.dir.fullPath;
        if (!worker){
            worker = new Worker(workerUrl);
            worker.onmessage = function(evt){
                var msgHandler = callbacks[evt.data.id];
                msgHandler.call(null, evt);
                if (evt.data.type == GitLiteWorkerMessages.SUCCESS || evt.data.type == GitLiteWorkerMessages.ERROR){
                    delete callbacks[id];
                }
            }
        }
        callbacks[id] = newResponseHandler(success, error, options.progress);
        worker.postMessage({id: id++, type: type, options: options});
    }

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

        
        clone : function(options, success, error){
            // var objectStore = new FileObjectStore(options.dir);
            // objectStore.init(function(){
            //     //clone(dir, objectStore, url, callback);
            //     clone({dir: options.dir, branch: options.branch, objectStore: objectStore, url: options.url, depth: options.depth, progress: options.progress}, success, error);
            // }, error);
            doApiCall(GitLiteWorkerMessages.API_CALL_CLONE, options, success, error);
            
        },
        pull : function(options, success, error){
            // var objectStore = new FileObjectStore(options.dir);
            // objectStore.init(function(){
            //     //pull(dir, objectStore, url, callback);
            //     pull({dir: options.dir, objectStore: objectStore}, success, error);
            // }, error);
            doApiCall(GitLiteWorkerMessages.API_CALL_PULL, options, success, error);

        },
        commit : function(options, success, error){
            // var objectStore = new FileObjectStore(options.dir);
            // objectStore.init(function(){
            //     //commit(dir, objectStore, callback);
            //     commit({dir: options.dir, username: options.username, email: options.email, commitMsg: options.commitMsg, objectStore: objectStore}, success, error);
            // }, error);
            doApiCall(GitLiteWorkerMessages.API_CALL_COMMIT, options, success, error);
        },
        push : function(options, success, error){
            // var objectStore = new FileObjectStore(options.dir);
            // objectStore.init(function(){
            //     push({objectStore: objectStore, dir: options.dir, url: options.url}, success, error);
            // }, error);
            doApiCall(GitLiteWorkerMessages.API_CALL_PUSH, options, success, error);
        }
    }
    return api;
});