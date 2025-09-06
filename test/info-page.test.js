import "./fixtures/common.js"
import { describe } from "mocha"
import { expand } from "@foerderfunke/sem-ops-utils"
import { addRpsFromKnowledgeBase } from "./fixtures/common.js"

describe("info page", function () {
    let matchingEngine

    before(async function () {
        matchingEngine = globalThis.matchingEngine
        await addRpsFromKnowledgeBase([
            expand("ff:arbeitsassistenz")
        ])
        await matchingEngine.init()
    })

    it("should build correct info page for ff:arbeitsassistenz", async function () {
        const up = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
                ff:residence_city ff:residence_city-bielefeld ;
                ff:hasAge 45 .`
        let infoPageReport = await matchingEngine.buildInfoPage(up, expand("ff:arbeitsassistenz"))
        console.log(infoPageReport)
        // TODO
    })
})
