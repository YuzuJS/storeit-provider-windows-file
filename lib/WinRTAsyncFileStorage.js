"use strict";
var Q = require("q");
var base64 = require("base64it");

var NS_SEPARATOR_CHAR = "#";
var DATA_FOLDER = "data";
var DATA_FILE_EXT = ".dat";

// Promises are WinJS promises which does not have `catch` API. So instead we use `then(null, errorHandler)`.

module.exports = function WinRTAsyncFileStorage() {
    var that = this;
    var namespace = null;
    var applicationData = global.Windows.Storage.ApplicationData.current;
    var localFolder = applicationData.localFolder;
    var dataFolder = null;
    var namespaceFolder = null;

    function isNamespaceOnlyKey(key) {
        return (key.indexOf(NS_SEPARATOR_CHAR) !== -1 || key.indexOf(":") !== -1) ? false : true;
    }

    function isIndexKey(key) {
        return (key.indexOf(NS_SEPARATOR_CHAR) !== -1 &&
                key.indexOf("index") !== -1 &&
                key.indexOf(":primary") !== -1) ? true : false;
    }

    function keyToFileName(key) {
        return base64.urlSafeEncode(key) + DATA_FILE_EXT;
    }

    function fileNameToKey(fileName) {
        return base64.decode(fileName.substring(0, fileName.length - DATA_FILE_EXT.length));
    }


    function throwCanNotCreateFolder(subfolderName) {
        return function (error) {
            throw new Error("WinRTAsyncFileStorage Error: Unable to create folder:" +
                subfolderName + " Eorror Message:" + error);
        };
    }

    function getOrCreateSubfolder(storageFolder, subfolderName) {
        return storageFolder.getFolderAsync(subfolderName).then(
            null,
            function () {
                return storageFolder.createFolderAsync(subfolderName)
                    .then(null, throwCanNotCreateFolder(subfolderName));
            }
        );
    }

    function getOrCreateDataFolder () {
        dataFolder = null;
        return getOrCreateSubfolder(localFolder, DATA_FOLDER).then(function (folder) {
            dataFolder = folder;
        });
    }

    function getOrCreateNamespaceFolder() {
        namespaceFolder = null;
        return getOrCreateSubfolder(dataFolder, namespace).then(function (folder) {
            namespaceFolder = folder;
        });
    }

    function deleteFolder(folder) {
        if (folder) {
            return folder.deleteAsync();
        } else {
            return Q.resolve();
        }
    }

    function deleteNamespaceFolder() {
        return deleteFolder(namespaceFolder);
    }

    function getFolderFiles(folder) {
        return folder.createFileQuery().getFilesAsync();
    }

    function loadNamespaceData() {
        var result = {};

        function appendFiledata(file) {
            return global.Windows.Storage.FileIO.readTextAsync(file).then(function (fileContent) {
                result[fileNameToKey(file.name)] = fileContent;
            });
        }

        return getFolderFiles(namespaceFolder).then(function (namespaceFiles) {
            var promises = namespaceFiles.map(function(file) {
                return appendFiledata(file);
            });
            return Q.all(promises).then(function () {
                return result;
            });
        });
    }

    function deleteFile(fileName) {
        return namespaceFolder.getFileAsync(fileName).then(function (file) {
            return file.deleteAsync();
        });
    }

    function saveToFile(fileName, data) {
        var storagefile = null;
        return namespaceFolder.getFileAsync(fileName)
            .then(
                function (file) {
                    storagefile = file;
                },
                function () {
                    return namespaceFolder.createFileAsync(fileName).then(function (file) {
                        storagefile = file;
                    });
                })
            .then(
                function(error) {
                    if (storagefile) {
                        return global.Windows.Storage.FileIO.writeTextAsync(storagefile, data);
                    } else {
                        throw new Error("WinRTAsyncFileStorage Error: Unable to store data for Key:" +
                            fileNameToKey(fileName) + " Error Message=" + error);
                    }
                }
            );
    }

    function readFromFile(fileName) {
        return namespaceFolder.getFileAsync(fileName).then(function (file) {
            if (file) {
                return global.Windows.Storage.FileIO.readTextAsync(file);
            }
        });
    }

    that.removeItem = function (key) {
        if (isIndexKey(key) || isNamespaceOnlyKey(key)) {
            return;
        }
        return deleteFile(keyToFileName(key));
    };

    that.setItem = function(key, value) {
        if (isIndexKey(key) || isNamespaceOnlyKey(key)) {
            return;
        }
        return saveToFile(keyToFileName(key), value);
    };

    that.getItem = function(key) {
        if (isIndexKey(key)) {
            return [];
        } else if (isNamespaceOnlyKey(key)) {
            return "";
        }
        return readFromFile(keyToFileName(key));
    };

    that.load = function(namespaceToLoad) {
        namespace = namespaceToLoad;
        return getOrCreateDataFolder()
            .then(getOrCreateNamespaceFolder)
            .then(loadNamespaceData);
    };

    that.clear = function(namespaceToClear) {
        namespace = namespaceToClear;
        return deleteNamespaceFolder().then(function () {
            namespaceFolder = null;
            return getOrCreateDataFolder()
                .then(getOrCreateNamespaceFolder);
        });
    };
};
