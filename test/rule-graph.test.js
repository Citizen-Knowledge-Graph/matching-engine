import "./fixtures/common.js"
import { describe } from "mocha"
import { expand } from "@foerderfunke/sem-ops-utils"
import { inspect } from "util"
import { strictEqual } from "node:assert"

describe("rule graph", function () {
    let matchingEngine, shacl1

    before(async function () {
        matchingEngine = globalThis.matchingEngine
        shacl1 = `
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            @prefix ff: <https://foerderfunke.org/default#> .

            ff:ruleGraphDev a ff:RequirementProfile .
            ff:devShape a sh:NodeShape ;
            sh:targetClass ff:Citizen ;
            
            sh:property [ sh:path ff:foo ; sh:not [ sh:minInclusive 15 ; sh:maxExclusive 36  ] ] ;
            sh:property [ sh:path ff:bar ; sh:in (ff:blau ff:red) ] ;
            sh:property [
                sh:or (
                    [ sh:and (
                        [ sh:property [ sh:path ff:dings ; sh:in (true) ] ]
                        [ sh:property [ sh:path ff:hey ; sh:in (true) ] ]
                    ) ]
                    [ sh:property [ sh:path ff:jo ; sh:in (false) ] ]
                    [ sh:property [ sh:path ff:testy ; sh:hasValue ff:something ] ]
                )
            ] .`
        matchingEngine.addValidator(shacl1)
        await matchingEngine.init()
    })

    it("build rule graph from SHACL",async function () {
        let ruleGraph = await matchingEngine.buildRuleGraph(shacl1)
        let actual = inspect(ruleGraph, { depth: null, compact: true })
        const expected = `
Graph {
  root:
   NodeROOT {
     children:
      [ NodeAND {
          children:
           [ NodeNOT {
               children:
                [ NodeDATAFIELD {
                    children:
                     [ NodeRULE { type: 'sh:MinInclusiveConstraintComponent', value: 15 },
                       NodeRULE { type: 'sh:MaxExclusiveConstraintComponent', value: 36 } ],
                    path: 'ff:foo' } ] },
             NodeDATAFIELD {
               children:
                [ NodeRULE { type: 'sh:InConstraintComponent', value: [ 'ff:blau', 'ff:red' ] } ],
               path: 'ff:bar' },
             NodeOR {
               children:
                [ NodeAND {
                    children:
                     [ NodeDATAFIELD {
                         children: [ NodeRULE { type: 'sh:InConstraintComponent', value: [ true ] } ],
                         path: 'ff:dings' },
                       NodeDATAFIELD {
                         children: [ NodeRULE { type: 'sh:InConstraintComponent', value: [ true ] } ],
                         path: 'ff:hey' } ] },
                  NodeDATAFIELD {
                    children: [ NodeRULE { type: 'sh:InConstraintComponent', value: [ false ] } ],
                    path: 'ff:jo' },
                  NodeDATAFIELD {
                    children: [ NodeRULE { type: 'sh:HasValueConstraintComponent', value: 'ff:something' } ],
                    path: 'ff:testy' } ] } ] } ] } }`
        strictEqual(actual, expected.trim(), "The serialized rule graph does not match the expected one")
    })

    it("map validation results into rule graph",async function () {
        let up = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
                ff:foo 7 ;
                ff:bar ff:green ;
                ff:dings true ;
                ff:hey true ;
                ff:jo true .`
        // TODO
        // await matchingEngine.detailedSingleRequirementProfileValidation(up, expand("ff:ruleGraphDev"))
    })
})
