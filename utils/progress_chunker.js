define(function(){

    var ProgressChunker = function(func){
        this.master = func;
    }

    ProgressChunker.prototype = {
        getChunk : function(start, fraction){
            var self = this;
            return function(data){
                var newPct = start + (data.pct * fraction)
                self.master({pct: newPct, msg: data.msg});
            }
        }
    }

    return ProgressChunker;

})