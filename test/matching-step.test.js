import "./fixtures/common.js"
import { describe } from "mocha"
import { strictEqual } from "node:assert"
import { expand, isomorphicTurtles, sparqlSelect, storeFromTurtles, storeToTurtle } from "@foerderfunke/sem-ops-utils"
import lodash from "lodash"
import { FORMAT, MATCHING_MODE } from "../src/queries.js"

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
        matchingEngine.addValidator(shacl)
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
        matchingEngine.addValidator(shacl)
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
        matchingEngine.addValidator(shacl)
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
        matchingEngine.addValidator(shacl)
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

    it("should validate sh:or for missing data correctly", async function () {
        // this requires the details flag to be activated in the SHACL validator
        let user = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
                ff:orBranchAdf1 true ;
                ff:orBranchBdf2 4 .`
        let report = await matchingEngine.matching(user, [expand(OR_RP4)], MATCHING_MODE.FULL, FORMAT.TURTLE, true)
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

    it("should generate correct quiz matching report", async function () {
        let user = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ; ff:hasAge 16 .`

        // Turtle
        let quizReportTurtle = await matchingEngine.matching(user, [expand(SIMPLE_RP1), expand(SIMPLE_RP2)], MATCHING_MODE.QUIZ, FORMAT.TURTLE, true)
        // console.log(quizReportTurtle)
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
                ff:hasMode ff:quiz;
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
        strictEqual(isomorphicTurtles(quizReportTurtle, expectedTurtle), true, "The report in Turtle format does not match the expected one")

        // JSON-lD
        let quizReportJsonLd = await matchingEngine.matching(user, [expand(SIMPLE_RP1), expand(SIMPLE_RP2)], MATCHING_MODE.QUIZ, FORMAT.JSON_LD, true)
        // console.log(util.inspect(quizReportJsonLd, false, null, true))
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
            'ff:hasMode': { '@id': 'ff:quiz' },
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
        strictEqual(lodash.isEqual(quizReportJsonLd, expectedJsonLd), true, "The report in JSON-LD format does not match the expected one")
    })

    it("should generate correct full matching report", async function () {
        let user = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ; ff:hasAge 16 .`

        // Turtle
        let fullReportTurtle = await matchingEngine.matching(user, [expand(SIMPLE_RP1), expand(SIMPLE_RP2)], MATCHING_MODE.FULL, FORMAT.TURTLE, true)
        // console.log(fullReportTurtle)
        const expectedTurtle = `
            @prefix ff: <https://foerderfunke.org/default#>.
            @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
            @prefix sh: <http://www.w3.org/ns/shacl#>.
            
            ff:mainPerson_hasIncome
                rdf:predicate ff:hasIncome;
                rdf:subject ff:mainPerson;
                ff:isMissedBy ff:rpEvalRes_devRp2.
            
            ff:matchingReport_STATIC_TEST_URI a ff:MatchingReport;
                ff:hasEvaluatedRequirementProfile
                    ff:rpEvalRes_devRp1,
                    ff:rpEvalRes_devRp2;
                ff:hasMaterializationResult
                    ff:matRes0,
                    ff:matRes1;
                ff:hasMissingDatafield ff:mainPerson_hasIncome;
                ff:hasMode ff:full;
                ff:hasMostMissedDatafield ff:mainPerson_hasIncome;
                ff:hasNumberOfMissingDatafields 1;
                ff:hasTimestamp "STATIC_TEST_VALUE";
                ff:materializedTriples 4;
                ff:upPassesLogicalConsistencyCheck true;
                ff:upPassesPlausibilityCheck true.
            
            ff:matRes0
                ff:fromRule ff:InterestedInBuildingActivatorRule;
                ff:hasTriple ff:matRes0triple0.
            
            ff:matRes0triple0
                rdf:object false;
                rdf:predicate ff:interested_in_building_renovation_FLAG;
                rdf:subject ff:mainPerson.
            
            ff:matRes1
                ff:fromRule ff:UebergangsGeldAgenturFuerArbeit;
                ff:hasTriple
                    ff:matRes1triple0,
                    ff:matRes1triple1,
                    ff:matRes1triple2.
            
            ff:matRes1triple0
                rdf:object true;
                rdf:predicate ff:vocational_returnee_deactivated;
                rdf:subject ff:mainPerson.
            
            ff:matRes1triple1
                rdf:object true;
                rdf:predicate ff:vocationalReturneeShape_deactivated;
                rdf:subject ff:mainPerson.
            
            ff:matRes1triple2
                rdf:object true;
                rdf:predicate ff:nonVocationalReturneeShape_deactivated;
                rdf:subject ff:mainPerson.
            
            ff:rpEvalRes_devRp1
                ff:hasEligibilityStatus ff:ineligible;
                ff:hasRpUri ff:devRp1;
                ff:hasValidationReport ff:SubjectSpecificViolationsReport_devRp1.
            
            ff:rpEvalRes_devRp2
                ff:hasEligibilityStatus ff:missingData;
                ff:hasRpUri ff:devRp2.
            
            ff:SubjectSpecificViolationsReport_devRp1 a sh:ValidationReport;
                sh:conforms false;
                sh:result [ a sh:ValidationResult;
                    sh:focusNode ff:mainPerson;
                    sh:resultMessage "Value is not greater than or equal to \\"18\\"^^<http://www.w3.org/2001/XMLSchema#integer>";
                    sh:resultPath ff:hasAge;
                    sh:resultSeverity sh:Violation;
                    sh:sourceConstraintComponent sh:MinInclusiveConstraintComponent;
                    sh:sourceShape [];
                    sh:value 16
                ].`
        strictEqual(isomorphicTurtles(fullReportTurtle, expectedTurtle), true, "The report in Turtle format does not match the expected one")

        // JSON-lD
        let fullReportJsonLd = await matchingEngine.matching(user, [expand(SIMPLE_RP1), expand(SIMPLE_RP2)], MATCHING_MODE.FULL, FORMAT.JSON_LD, true)
        // console.log(util.inspect(fullReportJsonLd, false, null, true))
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
            'ff:hasEvaluatedRequirementProfile': [
                {
                    '@id': 'ff:rpEvalRes_devRp1',
                    'ff:hasEligibilityStatus': { '@id': 'ff:ineligible' },
                    'ff:hasRpUri': { '@id': 'ff:devRp1' },
                    'ff:hasValidationReport': {
                        '@id': 'ff:SubjectSpecificViolationsReport_devRp1',
                        '@type': 'sh:ValidationReport',
                        'sh:conforms': { '@type': 'xsd:boolean', '@value': 'false' },
                        'sh:result': {
                            '@type': 'sh:ValidationResult',
                            'sh:focusNode': { '@id': 'ff:mainPerson' },
                            'sh:resultMessage': 'Value is not greater than or equal to "18"^^<http://www.w3.org/2001/XMLSchema#integer>',
                            'sh:resultPath': { '@id': 'ff:hasAge' },
                            'sh:resultSeverity': { '@id': 'sh:Violation' },
                            'sh:sourceConstraintComponent': { '@id': 'sh:MinInclusiveConstraintComponent' },
                            'sh:sourceShape': {},
                            'sh:value': { '@type': 'xsd:integer', '@value': '16' }
                        }
                    }
                },
                {
                    '@id': 'ff:rpEvalRes_devRp2',
                    'ff:hasEligibilityStatus': { '@id': 'ff:missingData' },
                    'ff:hasRpUri': { '@id': 'ff:devRp2' }
                }
            ],
            'ff:hasMaterializationResult': [
                {
                    '@id': 'ff:matRes0',
                    'ff:fromRule': { '@id': 'ff:InterestedInBuildingActivatorRule' },
                    'ff:hasTriple': {
                        '@id': 'ff:matRes0triple0',
                        'rdf:object': { '@type': 'xsd:boolean', '@value': 'false' },
                        'rdf:predicate': { '@id': 'ff:interested_in_building_renovation_FLAG' },
                        'rdf:subject': { '@id': 'ff:mainPerson' }
                    }
                },
                {
                    '@id': 'ff:matRes1',
                    'ff:fromRule': { '@id': 'ff:UebergangsGeldAgenturFuerArbeit' },
                    'ff:hasTriple': [
                        {
                            '@id': 'ff:matRes1triple0',
                            'rdf:object': { '@type': 'xsd:boolean', '@value': 'true' },
                            'rdf:predicate': { '@id': 'ff:vocational_returnee_deactivated' },
                            'rdf:subject': { '@id': 'ff:mainPerson' }
                        },
                        {
                            '@id': 'ff:matRes1triple1',
                            'rdf:object': { '@type': 'xsd:boolean', '@value': 'true' },
                            'rdf:predicate': { '@id': 'ff:vocationalReturneeShape_deactivated' },
                            'rdf:subject': { '@id': 'ff:mainPerson' }
                        },
                        {
                            '@id': 'ff:matRes1triple2',
                            'rdf:object': { '@type': 'xsd:boolean', '@value': 'true' },
                            'rdf:predicate': { '@id': 'ff:nonVocationalReturneeShape_deactivated' },
                            'rdf:subject': { '@id': 'ff:mainPerson' }
                        }
                    ]
                }
            ],
            'ff:hasMissingDatafield': {
                '@id': 'ff:mainPerson_hasIncome',
                'rdf:predicate': { '@id': 'ff:hasIncome' },
                'rdf:subject': { '@id': 'ff:mainPerson' },
                'ff:isMissedBy': { '@id': 'ff:rpEvalRes_devRp2' }
            },
            'ff:hasMode': { '@id': 'ff:full' },
            'ff:hasMostMissedDatafield': { '@id': 'ff:mainPerson_hasIncome' },
            'ff:hasNumberOfMissingDatafields': { '@type': 'xsd:integer', '@value': '1' },
            'ff:hasTimestamp': 'STATIC_TEST_VALUE',
            'ff:materializedTriples': { '@type': 'xsd:integer', '@value': '4' },
            'ff:upPassesLogicalConsistencyCheck': { '@type': 'xsd:boolean', '@value': 'true' },
            'ff:upPassesPlausibilityCheck': { '@type': 'xsd:boolean', '@value': 'true' }
        }
        strictEqual(lodash.isEqual(fullReportJsonLd, expectedJsonLd), true, "The report in JSON-LD format does not match the expected one")
    })

    it("should behave correctly when no more missing data", async function () {
        let up = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ; ff:hasAge 20 .`
        let quizReportStore = await matchingEngine.matching(up, [expand(SIMPLE_RP1)], MATCHING_MODE.QUIZ, FORMAT.STORE, true)
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            SELECT * WHERE { ?matchingReport ff:hasNumberOfMissingDatafields ?numb . } `
        let rows = await sparqlSelect(query, [quizReportStore])
        strictEqual(rows[0].numb, "0", "The number of missing datafields is not 0 as expected")
    })

    // test sh:alternativePath TODO
    // test hasValue fix TODO
    // test sh:deactivated TODO
})
