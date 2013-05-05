if (! window.RawDeflate) RawDeflate = {};
RawDeflate.deflate = function(data){
    var deflate = new Zlib.Deflate(data);
    var out = deflate.compress();
    return new Blob([out]);
}

if (! window.RawDeflate) RawDeflate = {};
RawDeflate.inflate = function(data){
    var inflate = new Zlib.Inflate(data);
    inflate.verify = true;
    var out = inflate.decompress();
    var b = new Blob([out]);
    b.compressedLength = inflate.ip;
    return b;
}