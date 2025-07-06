import "./fixtures/common.js"
import { describe } from "mocha"
import { expand } from "@foerderfunke/sem-ops-utils"
import { inspect } from "util"
import { strictEqual } from "node:assert"
import { addRpsFromKnowledgeBase } from "./fixtures/common.js"

describe.skip("rule graph", function () {
    let matchingEngine
    let shacl0 = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ff: <https://foerderfunke.org/default#> .
        ff:miniDev a ff:RequirementProfile ;
            ff:hasMainShape ff:miniShape1 .
        ff:miniShape1 a sh:NodeShape ;
            sh:targetClass ff:Citizen ;
            sh:property [
                sh:path ff:foo ;
                sh:minInclusive 10 ;
            ] .
        ff:miniShape2 a sh:NodeShape ;
            sh:targetClass ff:Child ;
            sh:property [
                sh:path ff:bar ;
                sh:in (ff:eins ff:zwei) ;
            ] .`
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
    let shacl4 = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ff: <https://foerderfunke.org/default#> .
        
        ff:newRuleGraphDev a ff:RequirementProfile ;
            ff:hasMainShape ff:devShape1 .
        
        ff:devShape1 a sh:NodeShape ;
            sh:targetClass ff:Citizen ;
            sh:property [ sh:path ff:foo ; sh:not [ sh:minInclusive 15 ; sh:maxExclusive 36  ] ; sh:minCount 1 ] ;
            sh:or (
                [ sh:and (
                    [ sh:property [ sh:path ff:dings ; sh:in (ff:eins ff:zwei) ] ]
                    [ sh:property [ sh:path ff:hey ; sh:minExclusive 3 ] ]
                ) ]
                [ sh:path ff:testy ; sh:hasValue ff:something ]
            ) .
        
        ff:devShape2 a sh:NodeShape ;
            sh:targetClass ff:Child ;
            sh:property [
                sh:path ff:bar ;
                sh:in (true) ;
                sh:minCount 1 ;
            ] ;
            sh:property [
                sh:path ff:bla ;
                sh:or (
                    [ sh:in (true) ]
                    [ sh:minInclusive 10 ]
                )
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
        matchingEngine.addValidator(shacl0)
        matchingEngine.addValidator(shacl1)
        matchingEngine.addValidator(shacl2)
        matchingEngine.addValidator(shacl3)
        matchingEngine.addValidator(shacl4)
        await addRpsFromKnowledgeBase([expand("ff:wohngeld"), expand("ff:uebergangsgeld"), expand("ff:bafoeg")])
        await matchingEngine.init()
    })

    it("build rule graph from SHACL",async function () {
        let ruleGraph = await matchingEngine.buildRuleGraph(shacl1)
        let actual = inspect(ruleGraph, { depth: null, compact: true })
        const expected = `` // TODO
        strictEqual(actual, expected.trim(), "The serialized rule graph does not match the expected one")
    })

    it("build mermaid syntax from plain rule graph",async function () {
        let ruleGraph = await matchingEngine.buildRuleGraph(shacl1)
        let actual = ""
        const expected = `` // TODO
        strictEqual(actual, expected.trim(), "The mermaid syntax from rule graph does not match the expected one")
    })

    it("map validation results into rule graph",async function () {
        let graph = await matchingEngine.buildEvaluationGraph(up, expand("ff:ruleGraphDev"))
        let actual = inspect(graph, { depth: null, compact: true })
        const expected = `` // TODO
        strictEqual(actual, expected.trim(), "The serialized rule graph with validation results does not match the expected one")
    })

    it("build mermaid syntax from rule graph with validation results",async function () {
        let graph = await matchingEngine.buildEvaluationGraph(up, expand("ff:ruleGraphDev"))
        let actual = ""
        const expected = `` // TODO
        strictEqual(actual, expected.trim(), "The mermaid syntax from rule graph with validation results does not match the expected one")
    })

    it("build rule graph with validation results from uebergangsgeld example SHACL shape",async function () {
        const upSimple = `
        @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
                ff:has_disability true ;
                ff:berufsrueckkehrer true .`
        let graph = await matchingEngine.buildEvaluationGraph(upSimple, expand("ff:uebergangsgeldDev"))
        // TODO
    })

    it("build rule graph with validation results from simple example SHACL shape",async function () {
        const upSimple = `
        @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
                ff:hasAge 17 .`
        let graph = await matchingEngine.buildEvaluationGraph(upSimple, expand("ff:simpleRp"))
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
        let graph = await matchingEngine.buildEvaluationGraph(up, expand("ff:wohngeld"))
        strictEqual(graph.conforms, true, "The Wohngeld example should show up as overall conforming in the rule graph")
    })

    it("Übergangsgeld example as rule graph", async function () {
        const up = `
            @prefix ff: <https://foerderfunke.org/default#>.
            ff:mainPerson a ff:Citizen .`
        let graph = await matchingEngine.buildEvaluationGraph(up, expand("ff:uebergangsgeld"))
        // TODO
    })

    it("build new rule graph", async function () {
        let ruleGraph = await matchingEngine.buildRuleGraph(expand("ff:newRuleGraphDev"))
        console.log(ruleGraph.toMermaid())
        // TODO
    })

    it("build new eval graph", async function () {
        const up = `
            @prefix ff: <https://foerderfunke.org/default#>.
            ff:mainPerson a ff:Citizen ;
                ff:foo 7 .
            ff:child0 a ff:Child ;
                ff:bar true .
            ff:child1 a ff:Child .`
        let evalGraph = await matchingEngine.buildEvaluationGraph(up, expand("ff:newRuleGraphDev"))
        console.log(evalGraph.toMermaid())
        // TODO
    })

    it("should build eval graph for Bafög", async function () {
        const up = `
            @prefix ff: <https://foerderfunke.org/default#>.
            ff:mainPerson a ff:Citizen .`
        let evalGraph = await matchingEngine.buildEvaluationGraph(up, expand("ff:bafoeg"))
        console.log(evalGraph.toMermaid())
    })
})
