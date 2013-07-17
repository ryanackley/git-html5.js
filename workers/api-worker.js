define(['api', 'utils/errors', 'workers/worker_messages'], function(GitLite, errutils){

    self.requestFileSystem = self.requestFileSystem || self.webkitRequestFileSystem;

    var convertToDirEntry = function(dir, success, error){
        self.requestFileSystem(PERSISTENT, 5 * 1024 * 1024 * 1024, function(fs){
            fs.root.getDirectory(dir, {create: false}, success, error);
        }, error);
    };

    return function(){
        onmessage = function(evt){
            var msg = evt.data;
            var id = evt.data.id;
            var scrubArgs = function(args){
                for (var i = 0; i < args.length; i++){
                    args[i] = args[i].fullPath || args[i];
                }
            }
            var successCallback = function(){
                var args = Array.prototype.slice.call(arguments);
                scrubArgs(args);
                postMessage({id: id, type: GitLiteWorkerMessages.SUCCESS, args: args});
                //self.close();
            }

            var errCallback = function(e){
                postMessage({id: id, type: GitLiteWorkerMessages.ERROR, error:e});
                //self.close();
            }
            var progressCallback;
            if (msg.options.progress){
                progressCallback = function(){
                    var args = Array.prototype.slice.call(arguments);
                    postMessage({id: id, type: GitLiteWorkerMessages.PROGRESS, args: args});
                }
                msg.options.progress = progressCallback;
            }
            var ferror = errutils.fileErrorFunc(errCallback);

            var doApiCall = function(func){
                convertToDirEntry(msg.options.dir, function(dirEntry){
                    msg.options.dir = dirEntry;
                    func.call(null, msg.options, successCallback, errCallback);
                }, ferror);
            }

            switch(msg.type){
                
                case GitLiteWorkerMessages.API_CALL_CLONE:
                    doApiCall(GitLite.clone);
                    break;
                case GitLiteWorkerMessages.API_CALL_COMMIT:
                    doApiCall(GitLite.commit);
                    break;
                case GitLiteWorkerMessages.API_CALL_PULL:
                    doApiCall(GitLite.pull);
                    break;
                case GitLiteWorkerMessages.API_CALL_PUSH:
                    doApiCall(GitLite.push);
                    break;
                case GitLiteWorkerMessages.API_CALL_BRANCH:
                    doApiCall(GitLite.branch);
                    break;
                case GitLiteWorkerMessages.API_CALL_CHECKOUT:
                    doApiCall(GitLite.checkout);
                    break;
                case GitLiteWorkerMessages.API_CALL_UNCOMMITTED:
                    doApiCall(GitLite.checkForUncommittedChanges);
                    break;
                case GitLiteWorkerMessages.API_CALL_CURRENT_BRANCH:
                    doApiCall(GitLite.getCurrentBranch);
                    break;
                case GitLiteWorkerMessages.API_CALL_LOCAL_BRANCHES:
                    doApiCall(GitLite.getLocalBranches);
                    break;
                case GitLiteWorkerMessages.API_CALL_REMOTE_BRANCHES:
                    doApiCall(GitLite.getRemoteBranches);
                    break;
            }
        }
    }
});