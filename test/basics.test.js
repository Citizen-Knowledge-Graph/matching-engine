import "./fixtures/common.js"
import { describe } from "mocha"
import { deepStrictEqual } from "node:assert"

describe("basic tests", function () {
    let matchingEngine

    before(async function () {
        matchingEngine = globalThis.matchingEngine
        await matchingEngine.init()
    })

    it("matchingEngine object should have correct keys", function () {
        const expectedKeys = [
            "defStore",
            "datafieldsValidator",
            "consistencyValidator",
            "requirementProfilesStore",
            "requirementProfileTurtles",
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
