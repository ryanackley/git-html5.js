(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define(factory);
    } else {
        //Browser globals case. Just assign the
        //result to a property on the global.
        root.PackParser = factory();
    }
}(this, function () {
/**
 * almond 0.2.5 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("thirdparty/almond", function(){});

define('objectstore/delta',[],function() {
    var applyDelta = (function() {
        var matchLength = function(stream) {
            var data = stream.data
            var offset = stream.offset
            var result = 0
            var currentShift = 0
            var _byte = 128
            var maskedByte, shiftedByte

            while ((_byte & 128) != 0) {
                _byte = data[offset]
                offset += 1
                maskedByte = _byte & 0x7f
                shiftedByte = maskedByte << currentShift
                result += shiftedByte
                currentShift += 7
            }
            stream.offset = offset
            return result
        }

        return function(baseData, delta) {
            //var baseData = Git.stringToBytes(baseDataString)
            var stream = {
                data: delta,
                offset: 0,
                length: delta.length
            }
            var bb = [];
            var baseLength = matchLength(stream)
            if (baseLength != baseData.length) {
                throw (Error("Delta Error: base length not equal to length of given base data"))
            }

            var resultLength = matchLength(stream)
            var resultData = new Uint8Array(resultLength);
            var resultOffset = 0;

            var copyOffset
            var copyLength
            var opcode
            var copyFromResult
            while (stream.offset < stream.length) {
                opcode = stream.data[stream.offset]
                stream.offset += 1
                copyOffset = 0
                copyLength = 0
                if (opcode == 0) {
                    throw (Error("Don't know what to do with a delta opcode 0"))
                } else if ((opcode & 0x80) != 0) {
                    var value
                    var shift = 0
                    _(4).times(function() {
                        if ((opcode & 0x01) != 0) {
                            value = stream.data[stream.offset]
                            stream.offset += 1
                            copyOffset += (value << shift)
                        }
                        opcode >>= 1
                        shift += 8
                    })
                    shift = 0
                    _(2).times(function() {
                        if ((opcode & 0x01) != 0) {
                            value = stream.data[stream.offset]
                            stream.offset += 1
                            copyLength += (value << shift)
                        }
                        opcode >>= 1
                        shift += 8
                    })
                    if (copyLength == 0) {
                        copyLength = (1 << 16)
                    }

                    // TODO: check if this is a version 2 packfile and apply copyFromResult if so
                    copyFromResult = (opcode & 0x01)
                    var subarray = baseData.subarray(copyOffset, copyOffset + copyLength);
                    resultData.set(subarray, resultOffset);
                    resultOffset += subarray.length;

                } else if ((opcode & 0x80) == 0) {
                    var subarray = stream.data.subarray(stream.offset, stream.offset + opcode);
                    resultData.set(subarray, resultOffset);
                    resultOffset += subarray.length;
                    stream.offset += opcode
                }
            }
            return resultData.buffer;
            
        }
    }());

    return applyDelta;
});
define('utils/misc_utils',[],function(){
    /* Main object */
    var utils = {
      
      // Print an error either to the console if in node, or to div#jsgit-errors
      // if in the client.
      handleError: function(message) {
        if (jsGitInNode) {
          console.log(message)
        }
        else {
          $('#jsgit-errors').append(message)
        }
      },
      
      // Turn an array of bytes into a String
      bytesToString: function(bytes) {
        var result = "";
        var i;
        for (i = 0; i < bytes.length; i++) {
          result = result.concat(String.fromCharCode(bytes[i]));
        }
        return result;
      },
      
      stringToBytes: function(string) {
        var bytes = []; 
        var i; 
        for(i = 0; i < string.length; i++) {
          bytes.push(string.charCodeAt(i) & 0xff);
        }
        return bytes;
      },
        
      toBinaryString: function(binary) {
        if (Array.isArray(binary)) {
          return Git.bytesToString(binary)
        }
        else {
          return binary
        }
      },
        
      // returns the next pkt-line
      nextPktLine: function(data) {
        var length = parseInt(data.substring(0, 4), 16);
        return data.substring(4, length);
      },
      
      // zlib files contain a two byte header. (RFC 1950)
      stripZlibHeader: function(zlib) {
        return zlib.subarray(2)
      },
      
      escapeHTML: function(s) {
        return s
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      },
        convertShaToBytes: function(sha){
            var bytes = new Uint8Array(sha.length/2);
            for (var i = 0; i < sha.length; i+=2)
            {
                bytes[i/2] = parseInt('0x' + sha.substr(i, 2));
            }
            return bytes;   
        },
        convertBytesToSha : function(bytes){
            var shaChars = [];
            for (var i = 0; i < bytes.length; i++){
                var next = (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
                shaChars.push(next);
            }
            return shaChars.join('');
        },
        compareShas : function(sha1, sha2){
            for (var i = 1; i < 20; i++){
                if (sha1[i] != sha2[i]){
                    return sha1[i] - sha2[i];
                }
            }
            return 0;
        },
        inflate: function(data){
            var inflate = new Zlib.Inflate(data);
            inflate.verify = true;
            var out = inflate.decompress();
            out.compressedLength = inflate.ip;
            return out;
        },
        deflate: function(data){
            var deflate = new Zlib.Deflate(data);
            var out = deflate.compress();
            return out;
        },
        trimBuffer: function(data){
            var buffer = data.buffer;
            if (data.byteOffset != 0 || data.byteLength != data.buffer.byteLength){
                buffer = data.buffer.slice(data.byteOffset, data.byteLength + data.byteOffset);
            }
            return buffer;
        }
    }

    return utils;

});

define('utils/file_utils',['utils/misc_utils'], function(utils){
	Array.prototype.asyncEach = function(func, callback){
		if (this.length == 0){
			callback();
			return;
		}
		var list = this,
		    counter = {x:0, end:list.length};
		
		var finish = function(){
			counter.x += 1;
			if (counter.x == counter.end){
				callback();
			}
		}
		
		for (var i = 0; i < list.length; i++){
			func.call(list, list[i], finish, i);
		}
	}

	var FileUtils = (function(){
		
		var toArray = function(list) {
			return Array.prototype.slice.call(list || [], 0);
		}
		
		var makeFile = function(root, filename, contents, callback, error){
			root.getFile(filename, {create:true}, function(fileEntry){
				fileEntry.createWriter(function(writer){
					writer.onwriteend = function(){
						if (callback)
							callback(fileEntry);
					}
					if (contents instanceof ArrayBuffer){
						contents = new Uint8Array(contents);
					}
					writer.write(new Blob([contents]));
				}, error);
			}, error);
		}
		
		var makeDir = function(root, dirname, callback, error){
			root.getDirectory(dirname, {create:true},callback, error);
		}
		
		return {
			mkdirs : function(root, dirname, callback, error){
				var pathParts;
				if (dirname instanceof Array){
					pathParts = dirname;
				}
				else{
					pathParts = dirname.split('/');
				}
				
				var makeDirCallback = function(dir){
					if (pathParts.length){
						makeDir(dir, pathParts.shift(), makeDirCallback, error);
					}
					else{
						if (callback)
							callback(dir);
					}
				}
				makeDirCallback(root);
			},
			rmDir : function (root, dirname, callback){
				root.getDirectory(dirname, {create:true}, function(dirEntry){
					dirEntry.removeRecursively(callback, utils.errorHandler);
				});
			},
			rmFile : function(root, filename, callback){
				root.getFile(filename, {create:true}, function(fileEntry){
					fileEntry.remove(callback, utils.errorHandler);
				});
			},
			mkfile : function(root, filename, contents, callback, error){
				if (filename.charAt(0) == '/'){
					filename = filename.substring(1);
				}
				var pathParts = filename.split('/');
				if (pathParts.length > 1){
					FileUtils.mkdirs(root, pathParts.slice(0, pathParts.length - 1), function(dir){
						makeFile(dir, pathParts[pathParts.length - 1], contents, callback, error);
					}, error);
				}
				else{
					makeFile(root, filename, contents, callback, error);
				}
			},
			ls: function(dir, callback, error){
				var reader = dir.createReader();
				var entries = [];
				
				var readEntries = function() {
					reader.readEntries (function(results) {
						if (!results.length) {
							callback(entries);
						} else {
							entries = entries.concat(toArray(results));
							readEntries();
						}
					}, error);
				}
				readEntries();
				
			},
			readBlob: function(blob, dataType, callback){
				var reader = new FileReader();
				reader.onloadend = function(e){
					callback(reader.result);
				}
				reader["readAs" + dataType](blob);
			},
			readFileEntry : function(fileEntry, dataType, callback){
				fileEntry.file(function(file){
					FileUtils.readBlob(file, dataType, callback);
				});
			},
			readFile : function(root, file, dataType, callback, error) {
				
				root.getFile(file, {create:false}, function(fileEntry){
					FileUtils.readFileEntry(fileEntry, dataType, callback, error);
				}, error);
			}
		
		};
	}
	)();

	return FileUtils; 
});
define('formats/pack',['objectstore/delta', 'utils/misc_utils', 'utils/file_utils'], function(applyDelta, utils, fileutils) {

    String.prototype.rjust = function(width, padding) {
        padding = padding || " ";
        padding = padding.substr(0, 1);
        if (this.length < width)
            return padding.repeat(width - this.length) + this;
        else
            return this.toString();
    }
    String.prototype.repeat = function(num) {
        for (var i = 0, buf = ""; i < num; i++) buf += this;
        return buf;
    }

    var Pack = function(binary, store) {
        //var binaryString = Git.toBinaryString(binary)
        var data;
        if (binary.constructor == String)
            data = new Uint8Array(utils.stringToBytes(binary)); //new BinaryFile(binaryString)
        else
            data = new Uint8Array(binary); //new BinaryFile(binaryString)
        var offset = 0
        var objects = null

        //var lastObjectData = null;
        //var chainCache = {};
        this.getData = function() {
            return data;
        }

        //if (typeof require === "undefined") {
        var myDebug = function(obj) {
            console.log(obj)
        }
        //}
        //else {
        //  var myDebug = require('util').debug
        //}

        var peek = function(length) {
            return data.subarray(offset, offset + length)
        }

        var rest = function() {
            return data.subarray(offset)
        }

        var advance = function(length) {
            offset += length
        }

        var matchPrefix = function() {
            if (utils.bytesToString(peek(4)) === "PACK") {
                advance(4)
            } else {
                throw (Error("couldn't match PACK"))
            }
        }

        var matchVersion = function(expectedVersion) {
            var actualVersion = peek(4)[3]
            advance(4)
            if (actualVersion !== expectedVersion) {
                throw ("expected packfile version " + expectedVersion + ", but got " + actualVersion)
            }
        }

        var matchNumberOfObjects = function() {
            var num = 0
            _(peek(4)).each(function(b) {
                num = num << 8
                num += b
            })
            advance(4);
            return num;
        }

        var PackedTypes = {
            COMMIT: 1,
            TREE: 2,
            BLOB: 3,
            TAG: 4,
            OFS_DELTA: 6,
            REF_DELTA: 7
        }
        var typeArray = [null, "commit", "tree", "blob", "tag", null, "ofs_delta", "ref_delta"];
        var getTypeStr = function(type) {
            return typeArray[type];
        }

        var matchObjectHeader = function() {
            var objectStartOffset = offset;
            var headByte = data[offset++];
            var type = (0x70 & headByte) >>> 4;
            var needMore = (0x80 & headByte) > 0;

            var size = headByte & 0xf;
            var bitsToShift = 4;

            while (needMore) {
                headByte = data[offset++];
                needMore = (0x80 & headByte) > 0;
                size = size | ((headByte & 0x7f) << bitsToShift);
                bitsToShift += 7;
            }

            return {
                size: size,
                type: type,
                offset: objectStartOffset
            }
           
        }

        var objectHash = function(type, content) {
            var contentData = new Uint8Array(content);
            var data = utils.stringToBytes(getTypeStr(type) + " " + contentData.byteLength + "\0");
            var buf = new ArrayBuffer(data.length + contentData.byteLength);
            var fullContent = new Uint8Array(buf);
            fullContent.set(data);
            fullContent.set(contentData, data.length);
            // return new SHA1(data).hexdigest()
            return Crypto.SHA1(fullContent, {
                asBytes: true
            });
        }

        var findDeltaBaseOffset = function(header) {
            var offsetBytes = []
            var hintAndOffsetBits = peek(1)[0].toString(2).rjust(8, "0")
            var needMore = (hintAndOffsetBits[0] == "1")

            offsetBytes.push(hintAndOffsetBits.slice(1, 8))
            advance(1)

            while (needMore) {
                hintAndOffsetBits = peek(1)[0].toString(2).rjust(8, "0")
                needMore = (hintAndOffsetBits[0] == "1")
                offsetBytes.push(hintAndOffsetBits.slice(1, 8))
                advance(1)
            }

            var longOffsetString = _(offsetBytes).reduce(function(memo, byteString) {
                return memo + byteString
            }, "")

            var offsetDelta = parseInt(longOffsetString, 2)
            var n = 1
            _(offsetBytes.length - 1).times(function() {
                offsetDelta += Math.pow(2, 7 * n)
                n += 1
            })
            var desiredOffset = header.offset - offsetDelta
            return desiredOffset;
        }

        
        var expandDeltifiedObject = function(object, callback) {

            var doExpand = function(baseObject, deltaObject) {
                deltaObject.type = baseObject.type;
                deltaObject.data = applyDelta(new Uint8Array(baseObject.data), new Uint8Array(deltaObject.data));
                deltaObject.sha = objectHash(deltaObject.type, deltaObject.data);
                return deltaObject;
            }

            if (object.type == PackedTypes.OFS_DELTA) {
                var baseObject = matchObjectAtOffset(object.desiredOffset);
                switch (baseObject.type) {
                    case PackedTypes.OFS_DELTA:
                    case PackedTypes.REF_DELTA:
                        expandDeltifiedObject(baseObject, function(expandedObject) {
                            var newObject = doExpand(expandedObject, object);
                            callback(newObject);
                        });
                        break;
                    default:
                        var newObject = doExpand(baseObject, object);
                        callback(newObject);
                }

            } else {
                store._retrieveRawObject(object.baseSha, 'ArrayBuffer', function(baseObject) {
                    baseObject.sha = object.baseSha;
                    var newObject = doExpand(baseObject, object);
                    callback(newObject);
                });
            }
        }
        var uncompressObject = function(objOffset) {
            var deflated = data.subarray(objOffset);
            var out = utils.inflate(deflated);

            return {
                buf: utils.trimBuffer(out),
                compressedLength: out.compressedLength
            };
        }

        var matchObjectData = function(header) {

            var object = {
                offset: header.offset,
                //dataOffset: dataOffset,
                //crc: crc32.crc(data.subarray(header.offset, offset)),
                type: header.type,
                //sha: objectHash(header.type, buf),
                // data: objData.buf
            }
            switch (header.type) {
                case PackedTypes.OFS_DELTA:
                    object.desiredOffset = findDeltaBaseOffset(header);
                    break;
                case PackedTypes.REF_DELTA:
                    var shaBytes = peek(20)
                    advance(20)
                    object.baseSha = _(shaBytes).map(function(b) {
                        return b.toString(16).rjust(2, "0")
                    }).join("")
                    break;
                default:
                    break;

            }
            var objData = uncompressObject(offset);
            object.data = objData.buf;

            //var checksum = adler32(buf)
            advance(objData.compressedLength);
            //matchBytes(intToBytes(checksum, 4))

            return object;
        }

        var matchObjectAtOffset = function(startOffset) {
            offset = startOffset
            var header = matchObjectHeader()
            return matchObjectData(header);
        }

        // slightly different code path from the original parser used for building the index
        // I'm doing it seperately because I needed to solve a call stack overflow caused by
        // synchronouse execution of callbacks for the case of non deltified objects in the
        // pack.
        var matchAndExpandObjectAtOffset = function(startOffset, dataType, callback) {
            var reverseMap = [null, "commit", "tree", "blob"]

            var object = matchObjectAtOffset(startOffset);

            var convertToDataType = function(object) {
                object.type = reverseMap[object.type];
                if (dataType != 'ArrayBuffer') {
                    var reader = new FileReader();

                    reader.onloadend = function() {
                        var buf = reader.result;
                        object.data = buf;
                        callback(object);
                    }
                    reader['readAs' + dataType](new Blob([object.data]));
                }
                else{
                    callback(object);
                }
            }
            switch (object.type) {
                case PackedTypes.OFS_DELTA:
                case PackedTypes.REF_DELTA:
                    expandDeltifiedObject(object, function(expandedObject){
                        convertToDataType(expandedObject);
                    });
                    break;
                default:
                    convertToDataType(object);
                    break;
            }
        };
        this.matchAndExpandObjectAtOffset = matchAndExpandObjectAtOffset;

        var stripOffsetsFromObjects = function() {
            _(objects).each(function(object) {
                delete object.offset
            })
        }

        var objectAtOffset = function(offset) {
            return _(objects).detect(function(obj) {
                return obj.offset == offset
            })
        }

        this.matchObjectAtOffset = matchObjectAtOffset;

        this.parseAll = function(success, progress) {
            try {
                var numObjects;
                var i;
                var deferredObjects = [];
                objects = [];


                matchPrefix()
                matchVersion(2)
                numObjects = matchNumberOfObjects();

                if (progress){
                    var tracker = 0;
                    var trackProgress = function(){
                        progress({at: ++tracker, total: numObjects});
                    }
                }
                else{
                    var trackProgress = function(){};
                }
                for (i = 0; i < numObjects; i++) {
                    var object = matchObjectAtOffset(offset);

                    object.crc = crc32.crc(data.subarray(object.offset, offset));

                    // hold on to the data for delta style objects.
                    switch (object.type) {
                        case PackedTypes.OFS_DELTA:
                        case PackedTypes.REF_DELTA:
                            {
                                deferredObjects.push(object);
                                break;
                            }
                        default:
                            object.sha = objectHash(object.type, object.data);
                            delete object.data;
                            trackProgress();
                            break;
                    }
                    objects.push(object);
                }

                deferredObjects.asyncEach(function(obj, done) {
                    expandDeltifiedObject(obj, function(obj){
                        delete obj.data;
                        trackProgress();
                        done();
                    });
                },
                    success);

            } catch (e) {
                //console.log("Error caught in pack file parsing data") // + Git.stringToBytes(data.getRawData()))
                throw (e)
            }
            return this
        }

        this.getObjects = function() {
            return objects
        }

        // this.getObjectAtOffset = getObjectAtOffset
    }

    Pack.buildPack = function(commits, repo, callback) {
        var visited = {};
        var counter = {
            x: 0,
            numObjects: 0
        };
        var packed = []; //new BlobBuilder();

        var map = {
            "commit": 1,
            "tree": 2,
            "blob": 3
        };

        var packTypeSizeBits = function(type, size) {
            var typeBits = map[type];
            var shifter = size;
            var bytes = [];
            var idx = 0;

            bytes[idx] = typeBits << 4 | (shifter & 0xf);
            shifter = shifter >>> 4;

            while (shifter != 0) {
                bytes[idx] = bytes[idx] | 0x80;
                bytes[++idx] = shifter & 0x7f;
                shifter = shifter >>> 7;
            }
            return new Uint8Array(bytes);
        }

        var packIt = function(object) {
            var compressed;
            var size;
            var type = object.type;

            if (object.compressedData) {
                size = object.size;
                // clone the data since it may be sub view of a larger buffer;
                compressed = new Uint8Array(compressedData).buffer;
            } else {
                var buf = object.data;
                var data;
                if (buf instanceof ArrayBuffer) {
                    data = new Uint8Array(buf);
                } else if (buf instanceof Uint8Array) {
                    data = buf;
                } else {
                    // assume it's a string
                    data = utils.stringToBytes(buf);
                }

                compressed = utils.deflate(data);
                size = data.length;
            }
            packed.push(packTypeSizeBits(type, size));
            packed.push(compressed);
            counter.numObjects++;
        }

        var finishPack = function() {
            var packedObjects = []; //new BlobBuilder();

            var buf = new ArrayBuffer(12);
            var dv = new DataView(buf);

            // 'PACK'
            dv.setUint32(0, 0x5041434b, false);
            // version
            dv.setUint32(4, 2, false);
            //number of packed objects
            dv.setUint32(8, counter.numObjects, false);

            //finalPack.append(buf);
            //finalPack.append(packedObjects);
            packedObjects.push(dv);
            //packed.reverse();
            for (var i = 0; i < packed.length; i++) {
                packedObjects.push(packed[i]);
            }
            //packed.getBlob();
            fileutils.readBlob(new Blob(packedObjects), 'ArrayBuffer', function(dataBuf) {
                packed = null;
                var dataBufArray = new Uint8Array(dataBuf);
                var sha = Crypto.SHA1(dataBufArray, {
                    asBytes: true
                });

                var finalPack = []; //new BlobBuilder();
                finalPack.push(dataBufArray);
                finalPack.push(new Uint8Array(sha));

                fileutils.readBlob(new Blob(finalPack), 'ArrayBuffer', callback);
            });

        }

        var walkTree = function(treeSha, callback) {
            if (visited[treeSha]) {
                callback();
                return;
            } else {
                visited[treeSha] = true;
            }

            repo._retrieveObject(treeSha, 'Tree', function(tree, rawObj) {
                var childCount = {
                    x: 0
                };
                var handleCallback = function() {
                    childCount.x++;
                    if (childCount.x == tree.entries.length) {
                        packIt(rawObj);
                        callback();
                    }
                }

                for (var i = 0; i < tree.entries.length; i++) {
                    var nextSha = utils.convertBytesToSha(tree.entries[i].sha);
                    if (tree.entries[i].isBlob) {
                        if (visited[nextSha]) {
                            handleCallback();
                        } else {
                            visited[nextSha] = true;
                            repo._retrieveRawObject(nextSha, 'Raw', function(object) {
                                packIt(object);
                                handleCallback();
                            });
                        }
                    } else {
                        walkTree(nextSha, function() {
                            handleCallback();
                        });
                    }
                }
            });
        }


        commits.forEach(function(commitObj) {
            //repo._retrieveObject(commitShas[i], 'Commit', function(commit, rawObj){
            var commit = commitObj.commit;
            packIt(commitObj.raw);
            walkTree(commit.tree, function() {
                if (++counter.x == commits.length) {
                    finishPack();
                }
            });
            //});
        });

    }
    return Pack;
});
define('formats/upload_pack_parser',['formats/pack', 'utils/misc_utils'], function(Pack, utils) {
    var parse = function(arraybuffer, repo, success, progress) {
        var data = new Uint8Array(arraybuffer); //new BinaryFile(binaryString);
        var offset = 0;
        var remoteLines = null;
        var objects = null;

        var peek = function(length) {
            return Array.prototype.slice.call(data, offset, offset + length);
        };

        var advance = function(length) {
            offset += length;
        };

        // A pkt-line is defined in http://git-scm.com/gitserver.txt
        var nextPktLine = function(isShallow) {
            var pktLine = null;
            var length;
            length = parseInt(utils.bytesToString(peek(4)), 16);
            advance(4);
            if (length == 0) {
                if (isShallow) {
                    return nextPktLine()
                }
            } else {
                pktLine = peek(length - 4);
                advance(length - 4);
            }
            return pktLine;
        };

        //console.log("Parsing upload pack of  " + arraybuffer.byteLength + " bytes")
        var startTime = new Date()
        var pktLine = nextPktLine()
        var packFileParser
        var remoteLine = ""
        var packData = ""
        var gotAckOrNak = false
        var ackRegex = /ACK ([0-9a-fA-F]{40}) common/;
        var common = [];

        var pktLineStr = utils.bytesToString(pktLine);
        while (pktLineStr.slice(0, 7) === "shallow") {
            pktLine = nextPktLine(true);
            pktLineStr = utils.bytesToString(pktLine);
        }

        while (pktLineStr === "NAK\n" ||
            pktLineStr.slice(0, 3) === "ACK") {
            var matches = ackRegex.exec(pktLineStr);
            if (matches) {
                common.push(matches[1]);
            }
            pktLine = nextPktLine();
            pktLineStr = utils.bytesToString(pktLine);
            gotAckOrNak = true;
        }

        if (!gotAckOrNak) {
            throw (Error("got neither ACK nor NAK in upload pack response"))
        }

        while (pktLine !== null) {
            // sideband format. "2" indicates progress messages, "1" pack data
            if (pktLine[0] == 2) {
                var lineString = utils.bytesToString(pktLine)
                lineString = lineString.slice(1, lineString.length)
                remoteLine += lineString
            } else if (pktLine[0] == 1) {
                packData += utils.bytesToString(pktLine.slice(1))
            } else if (pktLine[0] == 3) {
                throw (Error("fatal error in packet line"))
            }
            pktLine = nextPktLine()
        }

        packFileParser = new Pack(packData, repo)
        packData = null;
        data = null;
        binaryString = null;
        packFileParser.parseAll(function() {
            objects = packFileParser.getObjects()

           // console.log("took " + (new Date().getTime() - startTime.getTime()) + "ms")
            success(objects, packFileParser.getData(), common);
        }, progress);

    };
    return {
        parse: parse
    };
});    //The modules for your project will be inlined above
    //this snippet. Ask almond to synchronously require the
    //module value for 'main' here and return it as the
    //value to use for the public API for the built file.
    return require('formats/upload_pack_parser');
}));