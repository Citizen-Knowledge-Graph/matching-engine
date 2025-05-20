import "./fixtures/common.js"
import { describe } from "mocha"
import { deepStrictEqual } from "node:assert"

describe("basic tests", function () {
    let matchingEngine

    before(function () {
        matchingEngine = globalThis.matchingEngine
    })

    it("matchingEngine object should have correct keys", function () {
        deepStrictEqual(
            Object.keys(matchingEngine), ["datafieldsTurtle", "dfMatStore", "datafieldsValidator", "consistencyValidator", "requirementProfilesStore", "validators", "matQueries", "metadata", "lang", "metadataFormat"],
            "The matchingEngine object does not have the expected keys")
    })
})
