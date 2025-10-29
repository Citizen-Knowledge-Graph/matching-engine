import "./fixtures/common.js"
import { describe } from "mocha"
import { deepStrictEqual } from "node:assert"
import { addAllRpsFromKnowledgeBase } from "./fixtures/common.js"
import { expand } from "@foerderfunke/sem-ops-utils"

describe("basic tests", function () {
    let matchingEngine

    before(async function () {
        matchingEngine = globalThis.matchingEngine
        await addAllRpsFromKnowledgeBase()
        matchingEngine.turnOnPerformanceLogging()
        await matchingEngine.init()
    })

    it.skip("matchingEngine object should have correct keys", function () {
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

    it("performance logging should work", async function () {
        console.log("^ already done in before()")
    })

    it("should get all datafields", async function () {
        let dfUris = await matchingEngine.getAllDatafieldUris()
        console.log(dfUris, dfUris.length)
    })

    it("should get datafield details", async function () {
        let details = await matchingEngine.getDetailsForDatafield(expand("ff:renovationType"))
        console.log(details)
    })
})
