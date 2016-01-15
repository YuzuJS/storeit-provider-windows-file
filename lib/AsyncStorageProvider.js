"use strict";
var Q = require("q");
var serializers = {};
var QUEUE_PROCESSING_PERIOD = 500;

module.exports = function AsyncStorageProvider(options) {
    var that = this;
    var queue = [];
    var itemSerializer = null;
    var asyncStorage = options.asyncStorage;

    options.allSerializers.forEach(function (serializer) {
        serializers[serializer.name] = serializer;
    });

    var metadataSerializer = serializers[options.metadataSerializerName];

    function setItemSerializer(value) {
        itemSerializer = serializers[value || options.preferredItemSerializerName];
        that.setItem = setItemAsync.bind(null, itemSerializer);
        that.getItem = getItem.bind(null, itemSerializer);
    }

    Object.defineProperty(that, "name", {
        value: "AsyncStorageProvider",
        enumerable: true
    });

    Object.defineProperty(that, "metadataSerializer", {
        value: options.metadataSerializerName,
        enumerable: true
    });

    Object.defineProperty(that, "itemSerializer", {
        get: function () {
            return itemSerializer ? itemSerializer.name : null;
        },
        set: setItemSerializer
    });

    that.removeItem = function (key) {
        queue.push({ action: "remove", key: key });
    };

    function setItemAsync(serializer, key, value) {
        queue.push({ action: "set", target: "data", key: key,  data: serializer.serialize(value) });
    }

    that.load = function(namespace) {
        return asyncStorage.load(namespace).then(function (data) {
            Object.keys(data).forEach(function (key) {
                var dataKey = key;
                var dataKeyStartPos = key.lastIndexOf(":");
                if (dataKeyStartPos !== -1) {
                    dataKey = key.substring(dataKeyStartPos + 1);
                }
                data[dataKey] = itemSerializer.deserialize(data[key]);
                delete(data[key]);
            });
            return data;
        });
    };

    that.clear = function(namespace) {
        return asyncStorage.clear(namespace);
    };

    function processQueueElement(elem) {
        if (elem.action === "set") {
            return asyncStorage.setItem(elem.key, elem.data);
        } else if (elem.action === "remove") {
            return asyncStorage.removeItem(elem.key);
        }
    }

    function setItem(serializer, key, value) {
        asyncStorage.setItem(key, serializer.serialize(value));
    }

    function getItem(serializer, key) {
        return serializer.deserialize(asyncStorage.getItem(key));
    }

    function delayedProcessQueue() {
        return Q.delay(QUEUE_PROCESSING_PERIOD).then(processQueue);
    }

    function processQueue() {
        return processAndClearQueue().then(delayedProcessQueue);
    }

    function processAndClearQueue() {
        var actions = [];
        var chainPromise = function (prevPromise, nextAction) {
            return prevPromise.then(nextAction);
        };

        queue.forEach(function (elem) {
            actions.push(function () {
                processQueueElement(elem);
            });
        });
        queue = [];
        return actions.reduce(chainPromise, Q.resolve());
    }

    that.setMetadata = setItem.bind(null, metadataSerializer);
    that.getMetadata = getItem.bind(null, metadataSerializer);

    setItemSerializer(null); // Default to using the preferredItemSerializer.
    delayedProcessQueue();
};
