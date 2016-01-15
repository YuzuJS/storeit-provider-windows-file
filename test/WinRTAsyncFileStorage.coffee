WinRTAsyncFileStorage = require("../lib/WinRTAsyncFileStorage")

global.Windows = { Storage: { ApplicationData: { current: {} } } }
asyncFileStorage = null

describe "Test that the WinRTAsyncFileStorage ...", ->

    beforeEach ->
        asyncFileStorage = new WinRTAsyncFileStorage

    it "implements the correct interface", ->
        asyncFileStorage.should.respondTo("removeItem")
