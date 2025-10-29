import "./fixtures/common.js"
import { describe } from "mocha"
import { expand } from "@foerderfunke/sem-ops-utils"
import { addRpsFromKnowledgeBase } from "./fixtures/common.js"
import { violationsToText } from "../src/rule-graph/GraphUtils.js"

describe("rule graph utils", function () {
    let matchingEngine

    before(async function () {
        matchingEngine = globalThis.matchingEngine
        await addRpsFromKnowledgeBase([
            expand("ff:wolfenbuettel-stiftung-organisation"),
        ])
        await matchingEngine.init()
    })

    it("should render correct violation strings for ff:wolfenbuettel-stiftung-organisation", async function () {
        const up = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
                ff:associationHeadquarters ff:associationHeadquarters-other ;
                ff:associationActivity ff:associationActivity-social .`
        let evalGraph = await matchingEngine.buildEvaluationGraph(up, expand("ff:wolfenbuettel-stiftung-organisation"))
        // console.log(graphToMermaid(evalGraph, matchingEngine))
        console.log(violationsToText(evalGraph, matchingEngine))
    })
})
