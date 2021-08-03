define(['utils/file_utils', 'utils/errors'], function(fileutils, errutils){
    
    var branchRegex = new RegExp("^(?!/|.*([/.]\\.|//|@\\{|\\\\))[^\\x00-\\x20 ~^:?*\\[]+$");
    


    var checkBranchName = function(branchName){
        if (branchName && branchName.length && branchName.match(branchRegex)){
            if (branchName.lastIndexOf('.lock') != branchName.length - '.lock'.length &&
                branchName.charAt(branchName.length - 1) != '.' && 
                branchName.charAt(branchName.length - 1) != '/' &&
                branchName.charAt(0) != '.'){
                return true;
            }
        };
        return false
    }

    var branch = function(options, success, error){
        var store = options.objectStore,
            ferror = errutils.fileErrorFunc(error),
            branchName = options.branch;

        if (!checkBranchName(branchName)){
            error({type: errutils.BRANCH_NAME_NOT_VALID, msg: errutils.BRANCH_NAME_NOT_VALID_MSG});
            return;
        }

        var branchAlreadyExists = function(){
            error({type: errutils.BRANCH_ALREADY_EXISTS, msg: errutils.BRANCH_ALREADY_EXISTS_MSG});
        }

        store._getHeadForRef('refs/heads/' + branchName, branchAlreadyExists, function(e){
            if (e.code == DOMException.NOT_FOUND_ERR){
                store.getHeadRef(function(refName){
                    store._getHeadForRef(refName, function(sha){
                        store.createNewRef('refs/heads/' + branchName, sha, success);
                    }, ferror);
                });
            }
            else{
                ferror(e);
            }
        });
    }
    return branch;
});