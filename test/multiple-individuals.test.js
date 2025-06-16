import "./fixtures/common.js"
import { describe } from "mocha"
import { strictEqual } from "node:assert"
import { expand, sparqlAsk, sparqlSelect } from "@foerderfunke/sem-ops-utils"
import { FORMAT, MATCHING_MODE } from "../src/new/queries.js"
import { inspect } from "util"

describe("multiple individuals tests", function () {
    let matchingEngine

    let shacl1 = `
            @prefix ff: <https://foerderfunke.org/default#> .
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            ff:shacl1 a ff:RequirementProfile ;
                ff:hasMainShape ff:shacl1MainShape .
            ff:shacl1MainShape a sh:NodeShape ;
                sh:targetClass ff:Citizen ;
                sh:property [
                    sh:path ff:hasChild ;
                    sh:node ff:ChildShape ;
                    sh:minCount 1 ;
                ] .
            ff:ChildShape a sh:NodeShape ;
                sh:targetClass ff:Child ;
                sh:property [
                    sh:path ff:hasAge ;
                    sh:minInclusive 10 ;
                    sh:minCount 1 ;
                ] .`
    let shacl2 = `
            @prefix ff: <https://foerderfunke.org/default#> .
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            ff:shacl2 a ff:RequirementProfile ;
                ff:hasMainShape ff:shacl2MainShape .
            ff:shacl2MainShape a sh:NodeShape ;
                sh:targetClass ff:Citizen ;
                sh:property [
                    sh:path ff:hasChild ;
                    sh:qualifiedValueShape ff:ChildShape ;
                    sh:qualifiedMinCount 1 ;
                ] .
            ff:ChildShape a sh:NodeShape ;
                sh:targetClass ff:Child ;
                sh:property [
                    sh:path ff:hasAge ;
                    sh:minInclusive 10 ;
                    sh:minCount 1 ;
                ] .`
    const userProfile1 = `
            @prefix ff: <https://foerderfunke.org/default#> .        
            ff:mainPerson a ff:Citizen ;
                ff:hasChild ff:child0, ff:child1 .
            ff:child0 a ff:Child ;
                ff:hasAge 14 .
            ff:child1 a ff:Child .`

    before(async function () {
        matchingEngine = globalThis.matchingEngine
        matchingEngine.addValidator(shacl1)
        matchingEngine.addValidator(shacl2)
        await matchingEngine.init()
    })

    it("should lead to class of children individuals", async function () {
        const up = `
            @prefix ff: <https://foerderfunke.org/default#> .        
            ff:mainPerson a ff:Citizen .`
        let reportStore = await matchingEngine.matching(up, [expand("ff:shacl1")], MATCHING_MODE.QUIZ, FORMAT.STORE, true)
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            PREFIX sh: <http://www.w3.org/ns/shacl#>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            SELECT * WHERE {
                ?report ff:hasMostMissedDatafield ?dfIdentifier .
                ?dfIdentifier rdf:predicate ?df .
                ?df ff:hasShaclShape ?shape .
                ?shape sh:property ?property .
                OPTIONAL { ?property sh:class ?class }            
            }`
        let rows = await sparqlSelect(query, [reportStore, matchingEngine.dfMatStore])
        strictEqual(rows[0].class, expand("ff:Child"), "ff:hasChild as missing datafield should lead to ff:Child class")
    })

    it("missing datafields in simple multi-individual case", async function () {
        let reportStore = await matchingEngine.matching(userProfile1, [expand("ff:shacl1")], MATCHING_MODE.QUIZ, FORMAT.STORE, true)
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            ASK { ?report ff:hasMostMissedDatafield ff:child1_hasAge . }`
        strictEqual(await sparqlAsk(query, [reportStore]), true, "The most missing datafield is not the expected one")
    })

    it("signal more missing datafields when already overall conforming if sh:qualifiedValueShape is present", async function () {
        const continueMissingDataDespiteConforming = false
        let reportStore = await matchingEngine.matching(userProfile1, [expand("ff:shacl2")], MATCHING_MODE.QUIZ, FORMAT.STORE, true, continueMissingDataDespiteConforming)
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            ASK { ?report ff:hasMissingDataDespiteConformingFor ff:rpEvalRes_shacl2 . }`
        strictEqual(await sparqlAsk(query, [reportStore]), true, "The report does not signal missing data despite conforming overall")
    })

    it("should show missing datafield despite overall conforming when passing flag", async function () {
        const continueMissingDataDespiteConforming = true
        let reportStore = await matchingEngine.matching(userProfile1, [expand("ff:shacl2")], MATCHING_MODE.QUIZ, FORMAT.STORE, true, continueMissingDataDespiteConforming)
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            ASK { ?report ff:hasNumberOfMissingDatafields 1 . }`
        strictEqual(await sparqlAsk(query, [reportStore]), true, "The report does not contain the missing data field even so the flat should cause it to show it despite overall conforming")
    })

    it("should build correct rule graph for multi-class shape", async function () {
        let ruleGraph = await matchingEngine.buildRuleGraph(shacl2)
        let actual = inspect(ruleGraph, { depth: null, compact: true })
        const expected = `
Graph {
  root:
   NodeROOT {
     children:
      [ NodeCLASS {
          children:
           [ NodeDATAFIELD {
               children: [ NodeRULE { type: 'sh:MinInclusiveConstraintComponent', value: 10 } ],
               path: 'ff:hasAge' } ],
          shapeId: 'ff:ChildShape',
          targetClass: 'ff:Child' },
        NodeCLASS {
          children:
           [ NodeDATAFIELD {
               children: [ NodeRULE { type: 'sh:qualifiedValueShape', value: 'ff:ChildShape' } ],
               path: 'ff:hasChild' } ],
          shapeId: 'ff:shacl2MainShape',
          targetClass: 'ff:Citizen',
          isMainShape: true } ] } }`
        strictEqual(actual, expected.trim(), "The serialized multi-class rule graph does not match the expected one")
    })
})
