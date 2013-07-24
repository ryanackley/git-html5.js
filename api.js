// requirejs.config({
//     shim: {

//     }
// });

define(['commands/clone', 'commands/commit', 'commands/init', 'commands/pull', 'commands/push', 'commands/branch', 'commands/checkout', 'commands/conditions', 'objectstore/file_repo', 'formats/smart_http_remote', 'utils/errors', 'thirdparty/2.2.0-sha1', 'thirdparty/crc32', 'thirdparty/deflate.min', 'thirdparty/inflate.min', "workers/worker_messages"], function(clone, commit, init, pull, push, branch, checkout, Conditions, FileObjectStore, SmartHttpRemote, errutils){
    
    var api = {

        /** @constant {Number} Indicates an unexpected error in the HTML5 file system. */
        FILE_IO_ERROR: errutils.FILE_IO_ERROR,
        /** @constant {Number} Indicates an unexpected ajax error when trying to make a request */
        AJAX_ERROR: errutils.AJAX_ERROR, 
        /** @constant {Number} trying to clone into a non-empty directory */
        CLONE_DIR_NOT_EMPTY: errutils.CLONE_DIR_NOT_EMPTY,
        /** @constant {Number} Trying to clone into directory that contains a .git directory that already contains objects */
        CLONE_GIT_DIR_IN_USE: errutils.CLONE_GIT_DIR_IN_USE,
        /** @constant {Number} No branch found with the name given.  */
        REMOTE_BRANCH_NOT_FOUND: errutils.REMOTE_BRANCH_NOT_FOUND,
        /** @constant {Number} A pull was attempted that would require a non-fast-forward. The API only supports fast forward merging at the moment. */
        PULL_NON_FAST_FORWARD: errutils.PULL_NON_FAST_FORWARD,
        /** @constant {Number} A pull was attempted but the local git repo is up to date */
        PULL_UP_TO_DATE: errutils.PULL_UP_TO_DATE,
        /** @constant {Number} A commit was attempted but the local git repo has no new changes to commit */
        COMMIT_NO_CHANGES: errutils.COMMIT_NO_CHANGES,
        /** @constant {Number} A push was attempted but the remote repo is up to date. */
        PUSH_NO_CHANGES: errutils.PUSH_NO_CHANGES,
        /** @constant {Number} A push was attempted but the remote has new commits that the local repo doesn't know about. 
         * You would normally do a pull and merge remote changes first. Unfortunately, this isn't possible with this API. 
         * As a workaround, you could create and checkout a new branch and then do a push. */
        PUSH_NON_FAST_FORWARD: errutils.PUSH_NON_FAST_FORWARD,
        /** @constant {Number} Indicates an unexpected problem retrieving objects */
        OBJECT_STORE_CORRUPTED: errutils.OBJECT_STORE_CORRUPTED,
        /** @constant {Number} A pull was attempted with uncommitted changed in the working copy */
        UNCOMMITTED_CHANGES: errutils.UNCOMMITTED_CHANGES,
        /** @constant {Number} 401 when attempting to make a request. */
        HTTP_AUTH_ERROR: errutils.HTTP_AUTH_ERROR,

        /** @constant {Number} The branch doesn't follow valid git branch naming rules. */
        BRANCH_NAME_NOT_VALID: errutils.BRANCH_NAME_NOT_VALID,
        /** @constant {Number} Trying to push a repo without a valid remote. 
         * This can happen if it's a first push to blank repo and a url wasn't specified as one of the options. */
        PUSH_NO_REMOTE: errutils.PUSH_NO_REMOTE,
        
        /**
         * Clones a remote git repo into a local HTML5 DirectoryEntry. It only requests a single branch. This will either
         * be the branch specified or the HEAD at specified url. You can also specify the depth of the clone. It's recommended
         * that a depth of 1 always be given since the api does not currently give a way 
         * to access the commit history of a repo.  
         * 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry to clone the repo into
         * @param {String} [options.branch=HEAD] the name of the remote branch to clone.
         * @param {String} options.url the url of the repo to clone from
         * @param {Number} [options.depth] the depth of the clone. Equivalent to the --depth option from git-clone
         * @param {String} [options.username] User name to authenticate with if the repo supports basic auth
         * @param {String} [options.password] password to authenticate with if the repo supports basic auth
         * @param {progressCallback} [options.progress] callback that gets notified of progress events.
         * @param {cloneSuccessCallback} success callback that gets notified after the clone is completed successfully
         * @param {errorCallback} [error] callback that gets notified if there is an error
         */
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
        /**
         * Does a pull from the url the local repo was cloned from. Will only succeed for fast-forward pulls.
         * If a merge is required, it calls the error callback 
         * 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry that contains a local git repo to pull updates into
         * @param {String} options.username User name to authenticate with if the repo supports basic auth
         * @param {String} options.password password to authenticate with if the repo supports basic auth
         * @param {progressCallback} options.progress callback that gets notified of progress events.
         * @param {pullSuccessCallback} success callback that gets notified after the pull is completed successfully.
         * @param {errorCallback} error callback that gets notified if there is an error
         */
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
        /**
         * Looks for changes in the working directory since the last commit and adds them to the local git repo history. Some caveats
         *  
         *  - This is does an implicit "add" of all changes including previously untracked files. 
         *  - A Tree created by this command will only have two file modes: 40000 for folders (subtrees) and 100644 for files (blobs).
         *  - Ignores any rules in .gitignore
         *  - Will blow-up on a working copy with too many files. On my 2010 Macbook Pro running Chrome 28, it's in the range of 10000 files. 
         * 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry to look for changes and commit them to the .git subdirectory in the same driectory
         * @param {String} options.name The name that will appear in the commit log as the name of the author and committer. 
         * @param {String} options.email The email that will appear in the commit log as the email of the author and committer.
         * @param {String} options.commitMsg The message that will appear in the commit log
         * @param {pullSuccessCallback} success callback that gets notified after the commit is completed successfully.
         * @param {errorCallback} error callback that gets notified if there is an error
         * 
         */
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
        /**
         * Pushes local commits to a remote repo. This is usually the remote repo the local repo was cloned from. It can also be 
         * the initial push to a blank repo.
         * 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry to push changes from
         * @param {String} [options.url] the remote url to push changes to. This defaults to the url the repo was cloned from. 
         * @param {String} options.username User name to authenticate with if the repo supports basic auth
         * @param {String} options.password password to authenticate with if the repo supports basic auth
         * @param {progressCallback} options.progress callback that gets notified of progress events.
         * @param {pushSuccessCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} error callback that gets notified if there is an error
         */
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
        /**
         * Creates a local branch. You will need to call the checkout api command to check it out. 
         * 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry that contains a local git repo
         * @param {String} options.branch Name of the branch to create
         * @param {pushSuccessCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} error callback that gets notified if there is an error
         * 
         */
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
        /**
         * Checks out a local branch. 
         * 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry that contains a local git repo
         * @param {String} options.branch Name of the branch to checkout
         * @param {pushSuccessCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} error callback that gets notified if there is an error 
         */
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

        /**
         * Looks in the working directory for uncommitted changes. This is faster than attempting a 
         * commit and having it fail.
         * 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry that contains a local git repo
         * @param {pushSuccessCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} error callback that gets notified if there is an error  
         */
        checkForUncommittedChanges: function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                Conditions.checkForUncommittedChanges(options.dir, objectStore, success, error);
            }, error);
        },
        /**
         * Retrieves the name of the currently checked out local branch . 
         * 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry that contains a local git repo
         * @param {pushSuccessCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} error callback that gets notified if there is an error  
         */
        getCurrentBranch : function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                objectStore.getHeadRef(function(ref){
                    success(ref.substring('refs/heads/'.length));
                });
            }, error);
        },
        /**
         * Gets a list of all local branches.
         * 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry that contains a local git repo
         * @param {pushSuccessCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} error callback that gets notified if there is an error  
         */
        getLocalBranches : function(options, success, error){
            var objectStore = new FileObjectStore(options.dir);
            objectStore.init(function(){
                objectStore.getAllHeads(success);
            }, error);
        },
        /**
         * Gets a list of all remote branches. 
         * 
         * @param {String} options.url url of a remote git repo
         * @param {String} options.username User name to authenticate with if the repo supports basic auth
         * @param {String} options.password password to authenticate with if the repo supports basic auth
         * @param {pushSuccessCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} error callback that gets notified if there is an error  
         */
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