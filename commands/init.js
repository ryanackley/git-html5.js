define(function(){
    var init = function(options, success, error){
        var objectStore = options.objectStore;
        objectStore.init(success, error);
    }
    return init; 
});