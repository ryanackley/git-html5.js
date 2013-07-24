
define(['commands/clone', 'commands/commit', 'commands/init', 'commands/pull', 'commands/push', 'commands/branch', 'commands/checkout', 'commands/conditions', 'objectstore/file_repo', 'formats/smart_http_remote', 'utils/errors', 'thirdparty/2.2.0-sha1', 'thirdparty/crc32', 'thirdparty/deflate.min', 'thirdparty/inflate.min', "workers/worker_messages"], function(clone, commit, init, pull, push, branch, checkout, Conditions, FileObjectStore, SmartHttpRemote, errutils){
    
    /** @exports GitApi */
    var api = {

        /** @desc Indicates an unexpected error in the HTML5 file system. */
        FILE_IO_ERROR: errutils.FILE_IO_ERROR,
        /** @desc Indicates an unexpected ajax error when trying to make a request */
        AJAX_ERROR: errutils.AJAX_ERROR, 
        /** @desc trying to clone into a non-empty directory */
        CLONE_DIR_NOT_EMPTY: errutils.CLONE_DIR_NOT_EMPTY,
        /** @desc Trying to clone into directory that contains a .git directory that already contains objects */
        CLONE_GIT_DIR_IN_USE: errutils.CLONE_GIT_DIR_IN_USE,
        /** @desc No branch found with the name given.  */
        REMOTE_BRANCH_NOT_FOUND: errutils.REMOTE_BRANCH_NOT_FOUND,
        /** @desc A pull was attempted that would require a non-fast-forward. The API only supports fast forward merging at the moment. */
        PULL_NON_FAST_FORWARD: errutils.PULL_NON_FAST_FORWARD,
        /** @desc A pull was attempted but the local git repo is up to date */
        PULL_UP_TO_DATE: errutils.PULL_UP_TO_DATE,
        /** @desc A commit was attempted but the local git repo has no new changes to commit */
        COMMIT_NO_CHANGES: errutils.COMMIT_NO_CHANGES,
        /** @desc A push was attempted but the remote repo is up to date. */
        PUSH_NO_CHANGES: errutils.PUSH_NO_CHANGES,
        /** @desc A push was attempted but the remote has new commits that the local repo doesn't know about. 
         * You would normally do a pull and merge remote changes first. Unfortunately, this isn't possible with this API. 
         * As a workaround, you could create and checkout a new branch and then do a push. */
        PUSH_NON_FAST_FORWARD: errutils.PUSH_NON_FAST_FORWARD,
        /** @desc Indicates an unexpected problem retrieving objects */
        OBJECT_STORE_CORRUPTED: errutils.OBJECT_STORE_CORRUPTED,
        /** @desc A pull was attempted with uncommitted changed in the working copy */
        UNCOMMITTED_CHANGES: errutils.UNCOMMITTED_CHANGES,
        /** @desc 401 when attempting to make a request. */
        HTTP_AUTH_ERROR: errutils.HTTP_AUTH_ERROR,

        /** @desc The branch doesn't follow valid git branch naming rules. */
        BRANCH_NAME_NOT_VALID: errutils.BRANCH_NAME_NOT_VALID,
        /** @desc Trying to push a repo without a valid remote. 
         * This can happen if it's a first push to blank repo and a url wasn't specified as one of the options. */
        PUSH_NO_REMOTE: errutils.PUSH_NO_REMOTE,
        
        /**
         * Clones a remote git repo into a local HTML5 DirectoryEntry. It only requests a single branch. This will either
         * be the branch specified or the HEAD at specified url. You can also specify the depth of the clone. It's recommended
         * that a depth of 1 always be given since the api does not currently give a way 
         * to access the commit history of a repo.  
         * 
         * @param {Object} options 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry to clone the repo into
         * @param {String} [options.branch=HEAD] the name of the remote branch to clone.
         * @param {String} options.url the url of the repo to clone from
         * @param {Number} [options.depth] the depth of the clone. Equivalent to the --depth option from git-clone
         * @param {String} [options.username] User name to authenticate with if the repo supports basic auth
         * @param {String} [options.password] password to authenticate with if the repo supports basic auth
         * @param {progressCallback} [options.progress] callback that gets notified of progress events.
         * @param {successCallback} success callback that gets notified after the clone is completed successfully
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
         * @param {Object} options 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry that contains a local git repo to pull updates into
         * @param {String} [options.username] User name to authenticate with if the repo supports basic auth
         * @param {String} [options.password] password to authenticate with if the repo supports basic auth
         * @param {progressCallback} [options.progress] callback that gets notified of progress events.
         * @param {successCallback} success callback that gets notified after the pull is completed successfully.
         * @param {errorCallback} [error] callback that gets notified if there is an error
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
         *  <ul>
         *  <li>This is does an implicit "git add" of all changes including previously untracked files.</li>
         *  <li>A Tree created by this command will only have two file modes: 40000 for folders (subtrees) and 100644 for files (blobs).</li>
         *  <li>Ignores any rules in .gitignore</li>
         *  </ul>
         *
         * @param {Object} options 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry to look for changes and commit them to the .git subdirectory in the same driectory
         * @param {String} options.name The name that will appear in the commit log as the name of the author and committer. 
         * @param {String} options.email The email that will appear in the commit log as the email of the author and committer.
         * @param {String} options.commitMsg The message that will appear in the commit log
         * @param {successCallback} success callback that gets notified after the commit is completed successfully.
         * @param {errorCallback} [error] callback that gets notified if there is an error
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
         * @param {Object} options 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry to push changes from
         * @param {String} [options.url] the remote url to push changes to. This defaults to the url the repo was cloned from. 
         * @param {String} [options.username] User name to authenticate with if the repo supports basic auth
         * @param {String} [options.password] password to authenticate with if the repo supports basic auth
         * @param {progressCallback} [options.progress] callback that gets notified of progress events.
         * @param {successCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} [error] callback that gets notified if there is an error
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
         * @param {Object} options 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry that contains a local git repo
         * @param {String} options.branch Name of the branch to create
         * @param {successCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} [error] callback that gets notified if there is an error
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
         * @param {Object} options 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry that contains a local git repo
         * @param {String} options.branch Name of the branch to checkout
         * @param {successCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} [error] callback that gets notified if there is an error 
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
         * @param {Object} options 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry that contains a local git repo
         * @param {successCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} [error] callback that gets notified if there is an error  
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
         * @param {Object} options 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry that contains a local git repo
         * @param {successCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} [error] callback that gets notified if there is an error  
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
         * @param {Object} options 
         * @param {DirectoryEntry} options.dir an HTML5 DirectoryEntry that contains a local git repo
         * @param {successCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} [error] callback that gets notified if there is an error  
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
         * @param {Object} options 
         * @param {String} options.url url of a remote git repo
         * @param {String} [options.username] User name to authenticate with if the repo supports basic auth
         * @param {String} [options.password] password to authenticate with if the repo supports basic auth
         * @param {successCallback} success callback that gets notified after the push is completed successfully.
         * @param {errorCallback} [error] callback that gets notified if there is an error  
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

        /**
         * error callback that gets notified if there is an error  
         * @callback errorCallback
         * @param {Object} err Error data object
         * @param {Number} err.type The type of error. Should be one of the error constants in the api like {@link FILE_IO_ERROR}
         * @param {String} err.msg An explanation of the error in English. 
         */

         /**
         * progress callback that gets notified of the progress of various operaions  
         * @callback progressCallback
         * @param {Object} progress Progress data object
         * @param {Number} progress.pct a number between 1-100 that indicates the percentage of the operation that is complete.
         * @param {String} progress.msg An description of the current state of the operation in English. 
         */

         /**
          * success callback that gets notified when an operation completes successfully. 
          * @callback successCallback
          */

    }
    return api;
});