define(['formats/smart_http_remote', 'formats/pack'], function(SmartHttpRemote, Pack){
    var push = function(options, success, error){
        
        var store = options.objectStore;

        store.getConfig(function(config){
            var url = config.url || options.url;
            var remote = new SmartHttpRemote(store, "origin", url, error);
            remote.fetchReceiveRefs(function(refs){
                store._getCommitsForPush(refs, function(commits, ref){
                    Pack.buildPack(commits, store, function(packData){
                        remote.pushRefs([ref], packData, success);
                    });
                }, error);
            });
        });
    }
    return push;
});