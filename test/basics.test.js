import "./fixtures/common.js"
import { describe } from "mocha"
import { deepStrictEqual } from "node:assert"

describe("basic tests", function () {
    let matchingEngine

    before(function () {
        matchingEngine = globalThis.matchingEngine
        matchingEngine.init()
    })

    it("matchingEngine object should have correct keys", function () {
        const expectedKeys = [
            "datafieldsTurtle",
            "dfMatStore",
            "datafieldsValidator",
            "consistencyValidator",
            "requirementProfilesStore",
            "validators",
            "matQueries",
            "metadata",
            "lang",
            "metadataFormat"
        ]
        deepStrictEqual(
            Object.keys(matchingEngine), expectedKeys, "The matchingEngine object does not have the expected keys")
    })
})
