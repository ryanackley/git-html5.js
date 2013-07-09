define(function() {

    var errors = {
        // Indicates an unexpected error in the file system.
        FILE_IO_ERROR: 0,
        // Indicates an unexpected ajax error when trying to make a request
        AJAX_ERROR: 1, 
        
        // trying to clone into a non-empty directory
        CLONE_DIR_NOT_EMPTY: 2,
        CLONE_DIR_NOT_EMPTY_MSG: 'The target directory contains files',
        // No .git directory
        CLONE_DIR_NOT_INTIALIZED: 3,
        CLONE_DIR_NOT_INTIALIZED_MSG: 'The target directory hasn\'t been initialized.',
        // .git directory already contains objects
        CLONE_GIT_DIR_IN_USE: 4,
        CLONE_GIT_DIR_IN_USE_MSG: 'The target directory contains a .git directory already in use.',
        // No branch found with the name given
        REMOTE_BRANCH_NOT_FOUND: 5,
        REMOTE_BRANCH_NOT_FOUND_MSG: 'Can\'t find the branch name in the remote repository',

        // only supports fast forward merging at the moment.
        PULL_NON_FAST_FORWARD: 6,
        PULL_NON_FAST_FORWARD_MSG: 'Pulling from the remote repo requires a merge.',
        // Branch is up to date
        PULL_UP_TO_DATE: 7,
        PULL_UP_TO_DATE_MSG: 'Everything is up to date',

        PULL_UNCOMMITTED_CHANGES: 11,
        PULL_UNCOMMITTED_CHANGES_MSG: 'There are changes in the working directory that haven\'t been committed',

        // Nothing to commit
        COMMIT_NO_CHANGES: 8,
        COMMIT_NO_CHANGES_MSG: 'No changes to commit',

        // The remote repo and the local repo share the same head.
        PUSH_NO_CHANGES: 9,
        PUSH_NO_CHANGES_MSG: 'No new commits to push to the repository',
        // Need to merge remote changes first. 
        PUSH_NON_FAST_FORWARD: 10,
        PUSH_NON_FAST_FORWARD_MSG: 'The remote repo has new commits on your current branch. You need to merge them first.',


        // unexpected problem retrieving objects
        OBJECT_STORE_CORRUPTED: 200,
        OBJECT_STORE_CORRUPTED_MSG: 'Git object store may be corrupted',

        
        fileErrorFunc : function(onError){
            if (!onError){
                return function(){};
            }
            return function(e) {
                var msg = errors.getFileErrorMsg(e);
                onError({type : errors.FILE_IO_ERROR, msg: msg, fe: e.code});
            }
        },

        ajaxErrorFunc : function(onError){
            return function(xhr, status, errorThrown){
                var url = this.url,
                    reqType = this.type;

                onError({type: errors.AJAX_ERROR, url: url, reqType: reqType, status: status, errorThrown: errorThrown});  
            }
        },

        getFileErrorMsg: function(e) {
            var msg = '';

            switch (e.code) {
                case FileError.QUOTA_EXCEEDED_ERR:
                    msg = 'QUOTA_EXCEEDED_ERR';
                    break;
                case FileError.NOT_FOUND_ERR:
                    msg = 'NOT_FOUND_ERR';
                    break;
                case FileError.SECURITY_ERR:
                    msg = 'SECURITY_ERR';
                    break;
                case FileError.INVALID_MODIFICATION_ERR:
                    msg = 'INVALID_MODIFICATION_ERR';
                    break;
                case FileError.INVALID_STATE_ERR:
                    msg = 'INVALID_STATE_ERR';
                    break;
                case FileError.ABORT_ERR:
                    msg = 'ABORT_ERR';
                    break;
                case FileError.ENCODING_ERR:
                    msg = 'ENCODING_ERR';
                    break;
                case FileError.NOT_READABLE_ERR:
                    msg = 'NOT_READABLE_ERR';
                    break;
                case FileError.NO_MODIFICATION_ALLOWED_ERR:
                    msg = 'NO_MODIFICATION_ALLOWED_ERR';
                    break;
                case FileError.PATH_EXISTS_ERR:
                    msg = 'PATH_EXISTS_ERR';
                    break;
                case FileError.SYNTAX_ERR:
                    msg = 'SYNTAX_ERR';
                    break;
                case FileError.TYPE_MISMATCH_ERR:
                    msg = 'TYPE_MISMATCH_ERR';
                    break;
                default:
                    msg = 'Unknown Error ' + e.code;
                    break;
            };
        },
        errorHandler: function(e) {
            msg = utils.getFileErrorMsg(e);
            console.log('Error: ' + msg);
        }
    }
    return errors;

});