import "./fixtures/common.js"
import { describe } from "mocha"
import { strictEqual } from "node:assert"
import { expand, isomorphicTurtles, sparqlSelect, storeFromTurtles, storeToTurtle } from "@foerderfunke/sem-ops-utils"
import lodash from "lodash"
import { FORMAT } from "../src/queries.js"

describe("testing matching functionality via single calls", function () {
    let matchingEngine

    before(function () {
        matchingEngine = globalThis.matchingEngine
    })

    const SIMPLE_RP1 = "ff:devRp1"
    const SIMPLE_RP2 = "ff:devRp2"
    const SUBINDIV_RP3 = "ff:devRp3"
    const OR_RP4 = "ff:devRp4"

    before(async function () {
        let shacl = `
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            @prefix ff: <https://foerderfunke.org/default#> .
            ${SIMPLE_RP1} a ff:RequirementProfile .
            ${SIMPLE_RP1}Shape a sh:NodeShape ;
                sh:targetNode ff:mainPerson ;
                sh:property [
                    sh:path ff:hasAge ;
                    sh:minInclusive 18 ;
                    sh:minCount 1 ;
                ] .`
        matchingEngine.addRequirementProfileTurtle(shacl)
        shacl = `
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            @prefix ff: <https://foerderfunke.org/default#> .
            ${SIMPLE_RP2} a ff:RequirementProfile .
            ${SIMPLE_RP2}Shape a sh:NodeShape ;
                sh:targetNode ff:mainPerson ;
                sh:property [
                    sh:path ff:hasIncome ;
                    sh:maxInclusive 3000 ;
                    sh:minCount 1 ;
                ] .`
        matchingEngine.addRequirementProfileTurtle(shacl)
        shacl = `
            @prefix ff: <https://foerderfunke.org/default#> .
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            
            ${SUBINDIV_RP3} a ff:RequirementProfile .
            ${SUBINDIV_RP3}Shape a sh:NodeShape ;
                sh:targetClass ff:Citizen ;
                ff:conformanceMode ff:cmAtLeastOne ;
                sh:property [
                    sh:path ff:hasChild ;
                    sh:node ff:ChildShape ;
                    # ff:conformanceMode ff:cmAtLeastOne ;
                    sh:minCount 1 ;
                ] ;
                sh:property [
                    sh:path ff:hasCar ;
                    sh:node ff:CarShape ;
                    ff:conformanceMode ff:cmAll ;
                    sh:minCount 1 ;
                ] .

            ff:ChildShape a sh:NodeShape ;
                sh:targetClass ff:Child ;
                sh:property [
                    sh:path ff:hasAge ;
                    sh:maxInclusive 18 ;
                    sh:minCount 1 ;
                ] ;
                sh:property [
                    sh:path ff:hasToy ;
                    sh:node ff:ToyShape ;
                    ff:conformanceMode ff:cmAll ;
                    sh:minCount 1 ;
                ] .
            
            ff:ToyShape a sh:NodeShape ;
                sh:targetClass ff:Toy ;
                sh:property [
                    sh:path ff:costed ;
                    sh:maxExclusive 50 ;
                    sh:minCount 1 ;     
                ] .

            ff:CarShape a sh:NodeShape ;
                sh:targetClass ff:Car ;
                sh:property [
                    sh:path ff:engineType ;
                    sh:in (ff:electrical) ;
                    sh:minCount 1 ;     
                ] .`
        matchingEngine.addRequirementProfileTurtle(shacl)
        shacl = `
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            @prefix ff: <https://foerderfunke.org/default#> .
            
            ${OR_RP4} a ff:RequirementProfile .
            ${OR_RP4}Shape a sh:NodeShape ;
                sh:targetClass ff:Citizen ;
                sh:property [
                    sh:or (
                        [ 
                            sh:property [
                                sh:path ff:orBranchAdf1 ;
                                sh:in (true) ;
                                sh:minCount 1 ;
                            ] ;
                            sh:property [
                                sh:path ff:orBranchAdf2 ;
                                sh:hasValue "test" ;
                                sh:minCount 1 ;
                            ]
                        ]
                        [ 
                            sh:property [
                                sh:path ff:orBranchBdf1 ;
                                sh:in (true) ;
                                sh:minCount 1 ;
                            ] ;
                            sh:property [
                                sh:path ff:orBranchBdf2 ;
                                sh:minInclusive 3 ;
                                sh:minCount 1 ;
                            ]
                        ]
                    )
                ] .`
        matchingEngine.addRequirementProfileTurtle(shacl)
        shacl = `
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            @prefix ff: <https://foerderfunke.org/default#> .

            ff:hasValueTest a ff:RequirementProfile .

            ff:hasValueTest_logic a sh:NodeShape ;
                sh:targetClass ff:Citizen ;
                sh:property [
                    sh:or (
                        [ sh:path ff:associationActivity ; sh:hasValue ff:associationActivity-youthWork ]
                        [ sh:path ff:associationActivity ; sh:hasValue ff:associationActivity-womenSupport ]
                    ) ;
                ] .

            ff:hasValueTest_flow a sh:NodeShape ;
                sh:targetClass ff:Citizen ;
                sh:property [ sh:path ff:associationActivity ; sh:minCount 1 ] .`
        matchingEngine.addRequirementProfileTurtle(shacl)
        // await addRpsFromKnowledgeBase([expand("ff:wolfenbuettel-stiftung")])
        await matchingEngine.init()
    })

    it("should validate conforming for basic case", async function () {
        let user = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ; ff:hasAge 20 .`
        let report = await matchingEngine.basicValidation(user, expand(SIMPLE_RP1))
        strictEqual(report.conforms, true, "The validation report does not conform, even so it should")
    })

    it("should validate non-conforming for basic case", async function () {
        let user = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ; ff:hasAge 16 .`
        let report = await matchingEngine.basicValidation(user, expand(SIMPLE_RP1))
        strictEqual(report.conforms, false, "The validation report conforms, even so it shouldn't")
    })

    it.skip("should validate sh:or for missing data correctly", async function () {
        // this requires the details flag to be activated in the SHACL validator
        let user = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
                ff:orBranchAdf1 true ;
                ff:orBranchBdf2 4 .`
        // worked with MATCHING_MODE.FULL which is meanwhile removed TODO
        let report = await matchingEngine.matching(user, [expand(OR_RP4)], FORMAT.TURTLE, true)
        // console.log(report)
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            SELECT ?status (COUNT(?df) AS ?count) WHERE {
                ?matchingReport ff:hasMissingDatafield ?df ;
                    ff:hasEvaluatedRequirementProfile ?rp .
                ?rp ff:hasEligibilityStatus ?status .
            } GROUP BY ?status`
        let rows = await sparqlSelect(query, [storeFromTurtles([report])])
        strictEqual(rows[0].status, expand("ff:missingData"), "The status of the requirement profile should be missing data")
        strictEqual(rows[0].count, "2", "The requirement profile should have 2 missing data points")
    })

    it("should generate correct matching report", async function () {
        let user = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ; ff:hasAge 16 .`

        // Turtle
        let reportTurtle = await matchingEngine.matching(user, [expand(SIMPLE_RP1), expand(SIMPLE_RP2)], FORMAT.TURTLE, true)
        // console.log(reportTurtle)
        const expectedTurtle = `
            @prefix ff: <https://foerderfunke.org/default#>.
            @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.

            ff:mainPerson_hasIncome
                rdf:predicate ff:hasIncome;
                rdf:subject ff:mainPerson.

            ff:matchingReport_STATIC_TEST_URI a ff:MatchingReport;
                ff:hasEvaluatedRequirementProfile
                    ff:rpEvalRes_devRp1,
                    ff:rpEvalRes_devRp2;
                ff:hasMostMissedDatafield ff:mainPerson_hasIncome;
                ff:hasNumberOfMissingDatafields 1;
                ff:hasTimestamp "STATIC_TEST_VALUE";
                ff:materializedTriples 4;
                ff:upPassesLogicalConsistencyCheck true;
                ff:upPassesPlausibilityCheck true.

            ff:rpEvalRes_devRp1
                ff:hasEligibilityStatus ff:ineligible;
                ff:hasRpUri ff:devRp1.

            ff:rpEvalRes_devRp2
                ff:hasEligibilityStatus ff:missingData;
                ff:hasRpUri ff:devRp2.`
        strictEqual(isomorphicTurtles(reportTurtle, expectedTurtle), true, "The report in Turtle format does not match the expected one")

        // JSON-lD
        let reportJsonLd = await matchingEngine.matching(user, [expand(SIMPLE_RP1), expand(SIMPLE_RP2)], FORMAT.JSON_LD, true)
        // console.log(util.inspect(reportJsonLd, false, null, true))
        const expectedJsonLd = {
            '@context': {
                ff: 'https://foerderfunke.org/default#',
                sh: 'http://www.w3.org/ns/shacl#',
                xsd: 'http://www.w3.org/2001/XMLSchema#',
                rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
                rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
                schema: 'http://schema.org/'
            },
            '@id': 'ff:matchingReport_STATIC_TEST_URI',
            '@type': 'ff:MatchingReport',
            'ff:upPassesPlausibilityCheck': { '@type': 'xsd:boolean', '@value': 'true' },
            'ff:hasEvaluatedRequirementProfile': [
                {
                    '@id': 'ff:rpEvalRes_devRp1',
                    'ff:hasEligibilityStatus': { '@id': 'ff:ineligible' },
                    'ff:hasRpUri': { '@id': 'ff:devRp1' }
                },
                {
                    '@id': 'ff:rpEvalRes_devRp2',
                    'ff:hasEligibilityStatus': { '@id': 'ff:missingData' },
                    'ff:hasRpUri': { '@id': 'ff:devRp2' }
                }
            ],
            'ff:hasMostMissedDatafield': {
                '@id': 'ff:mainPerson_hasIncome',
                'rdf:predicate': { '@id': 'ff:hasIncome' },
                'rdf:subject': { '@id': 'ff:mainPerson' }
            },
            'ff:hasNumberOfMissingDatafields': { '@type': 'xsd:integer', '@value': '1' },
            'ff:hasTimestamp': 'STATIC_TEST_VALUE',
            'ff:materializedTriples': { '@type': 'xsd:integer', '@value': '4' },
            'ff:upPassesLogicalConsistencyCheck': { '@type': 'xsd:boolean', '@value': 'true' }
        }
        strictEqual(lodash.isEqual(reportJsonLd, expectedJsonLd), true, "The report in JSON-LD format does not match the expected one")
    })

    it("should behave correctly when no more missing data", async function () {
        let up = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ; ff:hasAge 20 .`
        let reportStore = await matchingEngine.matching(up, [expand(SIMPLE_RP1)], FORMAT.STORE, true)
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            SELECT * WHERE { ?matchingReport ff:hasNumberOfMissingDatafields ?numb . } `
        let rows = await sparqlSelect(query, [reportStore])
        strictEqual(rows[0].numb, "0", "The number of missing datafields is not 0 as expected")
    })

    it("should behave correctly with sh:hasValue", async function () {
        let up = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
                ff:associationActivity ff:associationActivity-sports , ff:associationActivity-youthWork .`
        let report = await matchingEngine.matching(up, [expand("ff:hasValueTest")], FORMAT.TURTLE, true)
        console.log(report) // has to be eligible
        // if commenting out everything but "ff:mainPerson a ff:Citizen" it has to be missing data, thanks to QUERY_HASVALUE_FIX
    })

    // test sh:alternativePath TODO
    // test hasValue fix TODO
    // test sh:deactivated TODO
})
