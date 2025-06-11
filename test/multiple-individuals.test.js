import "./fixtures/common.js"
import { describe } from "mocha"
import { strictEqual } from "node:assert"
import { expand, sparqlAsk } from "@foerderfunke/sem-ops-utils"
import { FORMAT, MATCHING_MODE } from "../src/new/queries.js"

describe("multiple individuals tests", function () {
    let matchingEngine

    before(async function () {
        matchingEngine = globalThis.matchingEngine
        let shacl1 = `
            @prefix ff: <https://foerderfunke.org/default#> .
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            ff:shacl1 a ff:RequirementProfile .
            ff:shacl1shape a sh:NodeShape ;
                sh:targetClass ff:Citizen ;
                sh:property [
                    sh:path ff:hasChild ;
                    sh:node ff:ChildShape ;
                    sh:minCount 1 ;
                ] .
            ff:ChildShape
                a sh:NodeShape ;
                sh:property [
                    sh:path ff:hasAge ;
                    sh:minInclusive 10 ;
                    sh:minCount 1 ;
                ] .`
        matchingEngine.addValidator(shacl1)
        await matchingEngine.init()
    })

    it("missing datafields in simple multi-individual case", async function () {
        const up = `
            @prefix ff: <https://foerderfunke.org/default#> .        
            ff:mainPerson a ff:Citizen ;
                ff:hasChild ff:child0, ff:child1 .
            ff:child0 a ff:Child ; ff:hasAge 14 .
            ff:child1 a ff:Child .`
        let reportStore = await matchingEngine.matching(up, [expand("ff:shacl1")], MATCHING_MODE.QUIZ, FORMAT.STORE, true)
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            ASK { ?report ff:hasMostMissedDatafield ff:child1_hasAge . }`
        strictEqual(await sparqlAsk(query, [reportStore]), true, "The most missing datafield is not the expected one")
    })
})
