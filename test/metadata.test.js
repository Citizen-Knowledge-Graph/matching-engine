import "./fixtures/common.js"
import { describe } from "mocha"
import { writeFileSync } from "fs"

describe("testing metadata functionality", function () {
    let matchingEngine

    before(async function () {
        matchingEngine = globalThis.matchingEngine
        await matchingEngine.init()
    })

    it.skip("should generate the correct metadata", async function () {
        // console.log(util.inspect(matchingEngine.metadata, false, null, true))
        const json  = JSON.stringify(matchingEngine.metadata, null, 2)
        writeFileSync("./output.json", json, "utf8")
        console.log("Wrote output.json")
    })
})
