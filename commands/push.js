define(['formats/smart_http_remote', 'formats/pack'], function(SmartHttpRemote, Pack){
    var push = function(store, url, success){
        var remote = new SmartHttpRemote(store, "origin", url);
        remote.fetchReceiveRefs(function(refs){
            store._getCommitsForPush(refs, function(commits){
                Pack.buildPack(commits, store, function(packData){
                    remote.pushRefs(refs, packData, success);
                });
            });
        });
    }

    return push;
});