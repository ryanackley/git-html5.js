// requirejs.config({
//     shim: {

//     }
// });

define(['commands/clone', 'commands/commit', 'commands/init', 'commands/pull', 'commands/push', 'objectstore/file_repo', 'thirdparty/2.2.0-sha1', 'thirdparty/crc32', 'thirdparty/deflate.min', 'thirdparty/inflate.min'], function(clone, commit, init, pull, push, FileObjectStore){
    
    var api = {
        init : function(dir, callback){
            var objectStore = new FileObjectStore(dir);
            init(objectStore, callback);
        },
        clone : function(dir, url, callback){
            var objectStore = new FileObjectStore(dir);
            objectStore.init(function(){
                clone(dir, objectStore, url, callback);
            });
        },
        pull : function(dir, url, callback){
            var objectStore = new FileObjectStore(dir);
            objectStore.init(function(){
                pull(dir, objectStore, url, callback);
            });
        },
        commit : function(dir, callback){
            var objectStore = new FileObjectStore(dir);
            objectStore.init(function(){
                commit(dir, objectStore, callback);
            })
            
        },
        push : function(dir, url, callback){
            var objectStore = new FileObjectStore(dir);
            objectStore.init(function(){
                push(objectStore, url, callback);
            });
        }
    }
    return api;
});