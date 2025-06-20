import "./fixtures/common.js"
import { describe } from "mocha"
import { expand } from "@foerderfunke/sem-ops-utils"
import { inspect } from "util"
import { strictEqual } from "node:assert"
import { ruleGraphToMermaid } from "../src/new/rule-graph/export/toMermaid.js"
import { addRpsFromKnowledgeBase } from "./fixtures/common.js"

describe("rule graph", function () {
    let matchingEngine
    let shacl1 = `
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
    let shacl2 = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ff: <https://foerderfunke.org/default#> .
        @prefix shn: <https://schemas.link/shacl-next#>.
        
        ff:uebergangsgeldDev a ff:RequirementProfile .
        ff:uebergangsgeldDevShape a sh:NodeShape ;
            sh:targetClass ff:Citizen ;

            sh:property [ sh:path ff:has_disability ; sh:in (true) ] ;
            sh:property [ sh:path ff:rehabilitation_provider ; sh:in (ff:rehabilitation_provider-bundesagentur-fuer-arbeit) ] ;
            sh:property [
                sh:or (
                    [ sh:property [ sh:path ff:berufsausbildungsabschluss ; sh:in (true) ] ]
                    [ 
                        sh:property [ sh:path ff:berufsausbildungsabschluss ; sh:in (false) ] ;
                        sh:or (
                            [ 
                                sh:property [ sh:path ff:berufsrueckkehrer ; sh:in (false) ] ;
                                sh:or (
                                    [ sh:property [ sh:path ff:sozialversichert12in3 ; sh:in (true) ] ]
                                    [ sh:property [ sh:path ff:anspruchAlgIn3 ; sh:in (true) ] ]
                                    [ sh:property [ sh:path ff:anspruchSoldatenIn3 ; sh:in (true) ] ]
                                )
                            ]
                            [ 
                                sh:property [ sh:path ff:berufsrueckkehrer ; sh:in (true) ] ;
                                sh:or (
                                    [ sh:property [ sh:path ff:sozialversichert12 ; sh:in (true) ] ]
                                    [ sh:property [ sh:path ff:anspruchAlg ; sh:in (true) ] ]
                                    [ sh:property [ sh:path ff:anspruchSoldaten ; sh:in (true) ] ]
                                )
                            ]
                        )
                    ]
                )
            ] .`
    let shacl3 = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ff: <https://foerderfunke.org/default#> .
        ff:simpleRp a ff:RequirementProfile .
        ff:simpleRpShape a sh:NodeShape ;
            sh:targetNode ff:mainPerson ;
            sh:property [
                sh:path ff:hasAge ;
                sh:minInclusive 18 ;
            ] ;
            sh:property [
                sh:path ff:hasResidence ;
                sh:in ("Berlin") ;
            ] .`
    const up = `
        @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
            ff:foo 7 ;
            ff:bar ff:green ;
            ff:dings true ;
            ff:hey true .`

    before(async function () {
        matchingEngine = globalThis.matchingEngine
        matchingEngine.addValidator(shacl1)
        matchingEngine.addValidator(shacl2)
        matchingEngine.addValidator(shacl3)
        await addRpsFromKnowledgeBase([expand("ff:wohngeld"), expand("ff:uebergangsgeld")])
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
      [ NodeCLASS {
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
                         path: 'ff:testy' } ] } ] } ],
          shapeId: 'ff:devShape',
          targetClass: 'ff:Citizen' } ] } }`
        strictEqual(actual, expected.trim(), "The serialized rule graph does not match the expected one")
    })

    it("build mermaid syntax from plain rule graph",async function () {
        let ruleGraph = await matchingEngine.buildRuleGraph(shacl1)
        let actual = ruleGraphToMermaid(ruleGraph, false)
        const expected = `
flowchart TD
    N1("ROOT")
    N2("AND")
    N1 --> N2
    N3("NOT")
    N2 --> N3
    N4["<b>ff:foo</b>"]
    N3 --> N4
    N5["MinInclusive<br/>15"]
    N4 --> N5
    N6["MaxExclusive<br/>36"]
    N4 --> N6
    N7["<b>ff:bar</b>"]
    N2 --> N7
    N8["In<br/>ff:blau | ff:red"]
    N7 --> N8
    N9("OR")
    N2 --> N9
    N10("AND")
    N9 --> N10
    N11["<b>ff:dings</b>"]
    N10 --> N11
    N12["In<br/>true"]
    N11 --> N12
    N13["<b>ff:hey</b>"]
    N10 --> N13
    N14["In<br/>true"]
    N13 --> N14
    N15["<b>ff:jo</b>"]
    N9 --> N15
    N16["In<br/>false"]
    N15 --> N16
    N17["<b>ff:testy</b>"]
    N9 --> N17
    N18["HasValue<br/>ff:something"]
    N17 --> N18`
        strictEqual(actual, expected.trim(), "The mermaid syntax from rule graph does not match the expected one")
    })

    it("map validation results into rule graph",async function () {
        let graph = await matchingEngine.detailedSingleRequirementProfileValidation(up, expand("ff:ruleGraphDev"))
        let actual = inspect(graph, { depth: null, compact: true })
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
                     [ NodeRULE {
                         type: 'sh:MinInclusiveConstraintComponent',
                         value: 15,
                         shaclEval:
                          { status: 'violation',
                            reason:
                             'Value is not greater than or equal to "15"^^<http://www.w3.org/2001/XMLSchema#integer>',
                            actualValue: '7' } },
                       NodeRULE {
                         type: 'sh:MaxExclusiveConstraintComponent',
                         value: 36,
                         shaclEval: { status: 'ok', actualValue: '7' } } ],
                    path: 'ff:foo',
                    status: 'violation' } ],
               status: 'ok' },
             NodeDATAFIELD {
               children:
                [ NodeRULE {
                    type: 'sh:InConstraintComponent',
                    value: [ 'ff:blau', 'ff:red' ],
                    shaclEval:
                     { status: 'violation',
                       reason:
                        'Value is not in https://foerderfunke.org/default#blau, https://foerderfunke.org/default#red',
                       actualValue: 'https://foerderfunke.org/default#green' } } ],
               path: 'ff:bar',
               status: 'violation' },
             NodeOR {
               children:
                [ NodeAND {
                    children:
                     [ NodeDATAFIELD {
                         children:
                          [ NodeRULE {
                              type: 'sh:InConstraintComponent',
                              value: [ true ],
                              shaclEval: { status: 'ok', actualValue: 'true' } } ],
                         path: 'ff:dings',
                         status: 'ok' },
                       NodeDATAFIELD {
                         children:
                          [ NodeRULE {
                              type: 'sh:InConstraintComponent',
                              value: [ true ],
                              shaclEval: { status: 'ok', actualValue: 'true' } } ],
                         path: 'ff:hey',
                         status: 'ok' } ],
                    status: 'ok' },
                  NodeDATAFIELD {
                    children:
                     [ NodeRULE {
                         type: 'sh:InConstraintComponent',
                         value: [ false ],
                         shaclEval: { status: 'missing' } } ],
                    path: 'ff:jo',
                    status: 'missing' },
                  NodeDATAFIELD {
                    children:
                     [ NodeRULE {
                         type: 'sh:HasValueConstraintComponent',
                         value: 'ff:something',
                         shaclEval:
                          { status: 'violation',
                            reason: 'Missing expected value <https://foerderfunke.org/default#something>' } } ],
                    path: 'ff:testy',
                    status: 'violation' } ],
               status: 'ok' } ],
          status: 'violation' } ],
     status: 'violation' },
  conforms: false }`
        strictEqual(actual, expected.trim(), "The serialized rule graph with validation results does not match the expected one")
    })

    it("build mermaid syntax from rule graph with validation results",async function () {
        let graph = await matchingEngine.detailedSingleRequirementProfileValidation(up, expand("ff:ruleGraphDev"))
        let actual = ruleGraphToMermaid(graph, true)
        const expected = `
flowchart TD
    N1("ROOT")
    N2("AND")
    N1 --> N2
    N3("NOT")
    N2 --> N3
    N4["<b>ff:foo</b>"]
    N3 --> N4
    N5["MinInclusive<br/>15<br/><span style="font-size:0.8em;color:#555">(actual: 7)</span>"]
    N4 --> N5
    N6["MaxExclusive<br/>36"]
    N4 --> N6
    N7["<b>ff:bar</b>"]
    N2 --> N7
    N8["In<br/>ff:blau | ff:red<br/><span style="font-size:0.8em;color:#555">(actual: ff:green)</span>"]
    N7 --> N8
    N9("OR")
    N2 --> N9
    N10("AND")
    N9 --> N10
    N11["<b>ff:dings</b>"]
    N10 --> N11
    N12["In<br/>true"]
    N11 --> N12
    N13["<b>ff:hey</b>"]
    N10 --> N13
    N14["In<br/>true"]
    N13 --> N14
    N15["<b>ff:jo</b>"]
    N9 --> N15
    N16["In<br/>false<br/><span style="font-size:0.8em;color:#555">(missing)</span>"]
    N15 --> N16
    N17["<b>ff:testy</b>"]
    N9 --> N17
    N18["HasValue<br/>ff:something"]
    N17 --> N18
classDef ok        fill:#2ecc71,stroke:#0e8046,stroke-width:2px
classDef violation fill:#ff4136,stroke:#ad0e05,stroke-width:2px
classDef missing   fill:#d9d9d9,stroke:#6e6e6e,stroke-width:2px
class N1 violation
class N2 violation
class N3 ok
class N4 violation
class N5 violation
class N6 ok
class N7 violation
class N8 violation
class N9 ok
class N10 ok
class N11 ok
class N12 ok
class N13 ok
class N14 ok
class N15 missing
class N16 missing
class N17 violation
class N18 violation`
        strictEqual(actual, expected.trim(), "The mermaid syntax from rule graph with validation results does not match the expected one")
    })

    it("flatten rule graph validation results",async function () {
        let graph = await matchingEngine.detailedSingleRequirementProfileValidation(up, expand("ff:ruleGraphDev"))
        let actual = inspect(graph.flatten(), { depth: null, compact: true })
        const expected = `
[ NodeROOT { status: 'violation', depth: 0 },
  NodeAND { status: 'violation', depth: 1 },
  NodeNOT { status: 'ok', depth: 2 },
  NodeDATAFIELD { path: 'ff:foo', status: 'violation', depth: 3 },
  NodeRULE {
    type: 'sh:MinInclusiveConstraintComponent',
    value: 15,
    shaclEval:
     { status: 'violation',
       reason:
        'Value is not greater than or equal to "15"^^<http://www.w3.org/2001/XMLSchema#integer>',
       actualValue: '7' },
    depth: 4 },
  NodeRULE {
    type: 'sh:MaxExclusiveConstraintComponent',
    value: 36,
    shaclEval: { status: 'ok', actualValue: '7' },
    depth: 4 },
  NodeDATAFIELD { path: 'ff:bar', status: 'violation', depth: 2 },
  NodeRULE {
    type: 'sh:InConstraintComponent',
    value: [ 'ff:blau', 'ff:red' ],
    shaclEval:
     { status: 'violation',
       reason:
        'Value is not in https://foerderfunke.org/default#blau, https://foerderfunke.org/default#red',
       actualValue: 'https://foerderfunke.org/default#green' },
    depth: 3 },
  NodeOR { status: 'ok', depth: 2 },
  NodeAND { status: 'ok', depth: 3 },
  NodeDATAFIELD { path: 'ff:dings', status: 'ok', depth: 4 },
  NodeRULE {
    type: 'sh:InConstraintComponent',
    value: [ true ],
    shaclEval: { status: 'ok', actualValue: 'true' },
    depth: 5 },
  NodeDATAFIELD { path: 'ff:hey', status: 'ok', depth: 4 },
  NodeRULE {
    type: 'sh:InConstraintComponent',
    value: [ true ],
    shaclEval: { status: 'ok', actualValue: 'true' },
    depth: 5 },
  NodeDATAFIELD { path: 'ff:jo', status: 'missing', depth: 3 },
  NodeRULE {
    type: 'sh:InConstraintComponent',
    value: [ false ],
    shaclEval: { status: 'missing' },
    depth: 4 },
  NodeDATAFIELD { path: 'ff:testy', status: 'violation', depth: 3 },
  NodeRULE {
    type: 'sh:HasValueConstraintComponent',
    value: 'ff:something',
    shaclEval:
     { status: 'violation',
       reason: 'Missing expected value <https://foerderfunke.org/default#something>' },
    depth: 4 } ]`

/*
The above translates into this structure, depth applied as tabs:

ROOT
    AND
        NOT
            ff:foo
                >= 15 (violated)
                <= 36 (ok)
        ff:bar
            = ff:blau | ff:red (violated)
        OR
            AND
                ff:dings
                    = true (ok)
                ff:hey
                    = true (ok)
            ff:jo
                = false (missing)
            ff:testy
                hasValue ff:something (violated)
*/
        strictEqual(actual, expected.trim(), "The flattened rule graph with validation results does not match the expected one")
    })

    it("build rule graph with validation results from uebergangsgeld example SHACL shape",async function () {
        const upSimple = `
        @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
                ff:has_disability true ;
                ff:berufsrueckkehrer true .`
        let graph = await matchingEngine.detailedSingleRequirementProfileValidation(upSimple, expand("ff:uebergangsgeldDev"))
        let mermaid = ruleGraphToMermaid(graph, true)
        // console.log(mermaid)
        // TODO
    })

    it("build rule graph with validation results from simple example SHACL shape",async function () {
        const upSimple = `
        @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
                ff:hasAge 17 .`
        let graph = await matchingEngine.detailedSingleRequirementProfileValidation(upSimple, expand("ff:simpleRp"))
        let mermaid = ruleGraphToMermaid(graph, true)
        // console.log(mermaid)
        // TODO
    })

    it("Wohngeld example should show up as conforming in rule graph", async function () {
        const up = `
            @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
            @prefix ff: <https://foerderfunke.org/default#>.
            ff:quick-check-user a ff:Citizen ;
                ff:aufenthaltsort ff:aufenthaltsort-ao-innerhalb ;
                ff:bezogene_leistungen ff:bezogene_leistungen-keine ;
                ff:geburtsdatum "1991-06-09"^^xsd:date ;
                ff:beruf_neu ff:beruf_neu-ao-soz ;
                ff:experience_financial_difficulties true ;
                ff:household_members 4 ;
                ff:vermoegen 10000 .`
        let graph = await matchingEngine.detailedSingleRequirementProfileValidation(up, expand("ff:wohngeld"))
        strictEqual(graph.conforms, true, "The Wohngeld example should show up as overall conforming in the rule graph")
    })

    it("Übergangsgeld example as rule graph", async function () {
        const up = `
            @prefix ff: <https://foerderfunke.org/default#>.
            ff:mainPerson a ff:Citizen .`
        let graph = await matchingEngine.detailedSingleRequirementProfileValidation(up, expand("ff:uebergangsgeld"))
        // TODO
    })
})
