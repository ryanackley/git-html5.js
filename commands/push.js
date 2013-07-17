define(['formats/smart_http_remote', 'formats/pack', 'utils/progress_chunker', 'utils/errors'], function(SmartHttpRemote, Pack, ProgressChunker, errutils){
    var push = function(options, success, error){
        
        var store = options.objectStore,
            username = options.username,
            password = options.password,
            progress = options.progress || function(){};

        var remotePushProgress;
        if (options.progress){
            var chunker = new ProgressChunker(progress);
            remotePushProgress = chunker.getChunk(40, .6);
        }
        else{
            remotePushProgress = function(){};
        }

        store.getConfig(function(config){
            var url = config.url || options.url;

            if (!url){
                error({type: errutils.PUSH_NO_REMOTE, msg: errutils.PUSH_NO_REMOTE_MSG});
                return;
            }

            var remote = new SmartHttpRemote(store, "origin", url, username, password, error);
            progress({pct:0, msg: 'Contacting server...'});
            remote.fetchReceiveRefs(function(refs){
                store._getCommitsForPush(refs, config.remoteHeads, function(commits, ref){
                    progress({pct: 20, msg: 'Building pack...'});
                    Pack.buildPack(commits, store, function(packData){
                        progress({pct: 40, msg: 'Sending pack...'});
                        remote.pushRefs([ref], packData, function(){
                            config.remoteHeads = config.remoteHeads || {};
                            config.remoteHeads[ref.name] = ref.head;
                            config.url = url;
                            store.setConfig(config, success);
                        }, remotePushProgress);
                    });
                }, error);
            });
        });
    }
    return push;
});