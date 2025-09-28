import "./fixtures/common.js"
import { describe } from "mocha"
import { writeFileSync, mkdirSync } from "fs"
import { dirname } from "path"
import { addAllRpsFromKnowledgeBase } from "./fixtures/common.js"
import { FORMAT } from "../src/queries.js"

describe("testing metadata functionality", function () {
    this.timeout(10000)
    let matchingEngine

    before(async function () {
        matchingEngine = globalThis.matchingEngine
        await addAllRpsFromKnowledgeBase()
        await matchingEngine.init("de_es", FORMAT.TURTLE)
    })

    it("should generate the correct metadata", async function () {
        // console.log(util.inspect(matchingEngine.metadata, false, null, true))
        //const json  = JSON.stringify(matchingEngine.metadata, null, 2)
        let path = "./test/output/metadata.ttl"
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, matchingEngine.metadata, "utf8")
        console.log(`Wrote ${path}`)
    })
})
