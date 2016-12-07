"use strict";

function binString(data, options) {
  // Set default options
  options = options || {};
  if (Array.isArray(data)) {
    data = new Buffer(data);
  } else if (typeof data == 'number') {
    data = new Buffer(data.toString(16), 'hex');
  } else if (typeof data == 'string') {
    if (!options.in) {
      // Quack, quack! Duck-type the input
      if (data.slice(0,2) == '0x') {
        data = new Buffer(data.slice(2), 'hex');
      } else {
        // Binary string
        data = new Buffer(data, 'binary');
      }
    } else {
      data = new Buffer(data, options.in);
    }
  }
  if (!options.out) options.out = 'utf8';
  
  // Convert
  switch (options.out) {
    case 'hex':
    case 'binary':
    case 'utf8':
    case 'base64':
      return data.toString(options.out);
    default:
      throw new Error('Output format "'+options.out+'" not understood');
  }
};

var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var LokiCordovaFSAdapterError = (function (_Error) {
    function LokiCordovaFSAdapterError() {
        _classCallCheck(this, LokiCordovaFSAdapterError);

        if (_Error != null) {
            _Error.apply(this, arguments);
        }
    }

    _inherits(LokiCordovaFSAdapterError, _Error);

    return LokiCordovaFSAdapterError;
})(Error);

var TAG = "[LokiCordovaFSAdapter]";

var LokiCordovaFSAdapter = (function () {
    function LokiCordovaFSAdapter(options) {
        _classCallCheck(this, LokiCordovaFSAdapter);

        this.options = options;
    }

    _createClass(LokiCordovaFSAdapter, {
        saveDatabase: {
            value: function saveDatabase(dbname, dbstring, callback) {
                var _this = this;

                console.log(TAG, "saving database");
                this._getFile(dbname, function (fileEntry) {
                    fileEntry.createWriter(function (fileWriter) {
                        fileWriter.onwriteend = function () {
                            if (fileWriter.length === 0) {
                                var blob = _this._createBlob(dbstring, "text/plain");
                                fileWriter.write(blob);
                                callback();
                            }
                        };
                        fileWriter.truncate(0);
                    }, function (err) {
                        console.error(TAG, "error writing file", err);
                        throw new LokiCordovaFSAdapterError("Unable to write file" + JSON.stringify(err));
                    });
                }, function (err) {
                    console.error(TAG, "error getting file", err);
                    throw new LokiCordovaFSAdapterError("Unable to get file" + JSON.stringify(err));
                });
            }
        },
        loadDatabase: {
            value: function loadDatabase(dbname, callback) {
                console.log(TAG, "loading database");
                this._getFile(dbname, function (fileEntry) {
                    fileEntry.file(function (file) {
                        var reader = new FileReader();
                        reader.onloadend = function (event) {
                            if(event.target.error) {
                                console.warn(TAG, event.target.error)
                                callback(null);
                            }
                            else {
                                // because we read the file as binary string we have to convert it now
                                var contents = binString(event.target.result, {
                                    in: 'binary',
                                    out: 'utf8'
                                });
         
                                if (contents.length === 0) {
                                    console.warn(TAG, "couldn't find database");
                                    callback(null);
                                } else {
                                    var n = contents.indexOf('}{"filename":');
                                    if (n === -1) {
                                        callback(contents);
                                    } else {
                                        var newContents = contents.substring(0, n + 1);
                                        callback(newContents);
                                    }
                                }
                            }
                        };
                        reader.onerror = function(event) {
                            console.warn(TAG, event);
                            callback(null);
                        }
                        // changed from readAsText - this randomly crashed on reading our db with arabic content
                        reader.readAsBinaryString(file);
                    }, function (err) {
                        console.error(TAG, "error reading file", err);
                        callback(new LokiCordovaFSAdapterError("Unable to read file" + err.message));
                    });
                }, function (err) {
                    console.error(TAG, "error getting file", err);
                    callback(new LokiCordovaFSAdapterError("Unable to get file: " + err.message));
                });
            }
        },
        deleteDatabase: {
            value: function deleteDatabase(dbname, callback) {
                var _this = this;
                console.log(TAG, "delete database");
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory, function (dir) {
                    var fileName = _this.options.prefix + "__" + dbname;
                    // Very important to have { create: true }
                    dir.getFile(fileName, { create: true }, function (fileEntry) {
                        fileEntry.remove(function () {
                            callback();
                        }, function (err) {
                            console.error(TAG, "error delete file", err);
                            throw new LokiCordovaFSAdapterError("Unable delete file" + JSON.stringify(err));
                        });
                    }, function (err) {
                        console.error(TAG, "error delete database", err);
                        throw new LokiCordovaFSAdapterError("Unable delete database" + JSON.stringify(err));
                    });
                }, function (err) {
                    throw new LokiCordovaFSAdapterError("Unable to resolve local file system URL" + JSON.stringify(err));
                });
            }
        },
        _getFile: {
            value: function _getFile(name, handleSuccess, handleError) {
                var _this = this;

                window.resolveLocalFileSystemURL(cordova.file.dataDirectory, function (dir) {
                    var fileName = _this.options.prefix + "__" + name;
                    dir.getFile(fileName, { create: true }, handleSuccess, handleError);
                }, function (err) {
                    throw new LokiCordovaFSAdapterError("Unable to resolve local file system URL" + JSON.stringify(err));
                });
            }
        },
        _createBlob: {

            // adapted from http://stackoverflow.com/questions/15293694/blob-constructor-browser-compatibility

            value: function _createBlob(data, datatype) {
                var blob = undefined;

                try {
                    blob = new Blob([data], { type: datatype });
                } catch (err) {
                    window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;

                    if (err.name === "TypeError" && window.BlobBuilder) {
                        var bb = new window.BlobBuilder();
                        bb.append(data);
                        blob = bb.getBlob(datatype);
                    } else if (err.name === "InvalidStateError") {
                        // InvalidStateError (tested on FF13 WinXP)
                        blob = new Blob([data], { type: datatype });
                    } else {
                        // We're screwed, blob constructor unsupported entirely
                        throw new LokiCordovaFSAdapterError("Unable to create blob" + JSON.stringify(err));
                    }
                }
                return blob;
            }
        }
    });

    return LokiCordovaFSAdapter;
})();

module.exports = LokiCordovaFSAdapter;
