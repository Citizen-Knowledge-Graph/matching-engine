import { describe } from "mocha"
import { strictEqual, deepStrictEqual } from "node:assert"
import { existsSync, promises } from "fs"
import simpleGit from "simple-git"
import { MatchingEngine } from "../src/new/MatchingEngine.js"
import { expand, isomorphicTurtles, storeToTurtle } from "@foerderfunke/sem-ops-utils"
import lodash from "lodash"
import { FORMAT, MATCHING_MODE } from "../src/new/queries.js"
import util from "util"
// import { writeFileSync } from "fs"

describe("all matching-engine tests", function () {
    let matchingEngine

    before(async function () {
        const repoDir = "test/knowledge-base"
        const repoUrl = "https://github.com/Citizen-Knowledge-Graph/knowledge-base"
        if (existsSync(repoDir)) {
            await simpleGit(repoDir).pull()
        } else {
            await simpleGit().clone(repoUrl, repoDir)
        }
        const rps = []
        for (let file of await promises.readdir(`${repoDir}/shacl`)) {
            rps.push(await promises.readFile(`${repoDir}/shacl/${file}`, "utf8"))
        }
        matchingEngine = await new MatchingEngine(
            await promises.readFile(`${repoDir}/datafields.ttl`, "utf8"),
            await promises.readFile(`${repoDir}/materialization.ttl`, "utf8"),
            await promises.readFile(`${repoDir}/consistency.ttl`, "utf8"),
            rps,
            "en",
            FORMAT.JSON_LD
        ).init()
    })

    it("matchingEngine object should have correct keys", function () {
        deepStrictEqual(
            Object.keys(matchingEngine), ["datafieldsTurtle", "dfMatStore", "datafieldsValidator", "consistencyValidator", "requirementProfilesStore", "validators", "matQueries", "metadata", "lang", "metadataFormat"],
            "The matchingEngine object does not have the expected keys")
    })

    describe("testing profile validation and materialization functions on the matchingEngine object", function () {
        const UP = `
            @prefix ff: <https://foerderfunke.org/default#> .
            @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
            ff:mainPerson a ff:Citizen ;
                ff:staatsbuergerschaft ff:staatsbuergerschaft-ao-us ;
                    ff:geburtsdatum "2005-01-02"^^xsd:date ;
                    ff:hasChild ff:child0 .
            ff:child0 a ff:Child ;
                ff:hasAge 25 .`

        it("should validate simple profile", async function () {
            let { upStore, upDataset, reportStore } = await matchingEngine.enrichAndValidateUserProfile(UP)
            let actualTurtle = await storeToTurtle(reportStore)

            const expectedTurtle = `
                @prefix ff: <https://foerderfunke.org/default#>.
                @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
                @prefix sh: <http://www.w3.org/ns/shacl#>.
                
                ff:LogicalConsistencyValidationReport a sh:ValidationReport;
                    sh:conforms false;
                    sh:result [ 
                        a sh:ValidationResult;
                        sh:focusNode ff:mainPerson;
                        sh:resultMessage "A parent must be older than their child.";
                        sh:resultPath (ff:hasChild ff:hasAge);
                        sh:resultSeverity sh:Violation;
                        sh:sourceConstraintComponent sh:LessThanConstraintComponent;
                        sh:sourceShape [];
                        sh:value 25
                    ].
                ff:PlausibilityValidationReport a sh:ValidationReport;
                    sh:conforms false;
                    sh:result [
                        a sh:ValidationResult;
                        sh:focusNode ff:mainPerson;
                        sh:resultMessage "Value is not in https://foerderfunke.org/default#staatsbuergerschaft-ao-ger, https://foerderfunke.org/default#staatsbuergerschaft-ao-eu, https://foerderfunke.org/default#staatsbuergerschaft-ao-3rd";
                        sh:resultPath ff:staatsbuergerschaft;
                        sh:resultSeverity sh:Violation;
                        sh:sourceConstraintComponent sh:InConstraintComponent;
                        sh:sourceShape [];
                        sh:value ff:staatsbuergerschaft-ao-us
                    ].
                ff:userProfileValidationReport
                    ff:hasValidationReport
                        ff:LogicalConsistencyValidationReport,
                        ff:PlausibilityValidationReport;
                    ff:materializedTriples 6;
                    ff:upPassesLogicalConsistencyCheck false;
                    ff:upPassesPlausibilityCheck false.`

            strictEqual(isomorphicTurtles(actualTurtle, expectedTurtle), true, "The report in Turtle format does not match the expected one")
        })
    })

    describe("testing validation functions on the matchingEngine object", function () {
        const SIMPLE_RP1 = "ff:devRp1"
        const SIMPLE_RP2 = "ff:devRp2"
        const SUBINDIV_RP3 = "ff:devRp3"

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
                ff:${SUBINDIV_RP3}Shape a sh:NodeShape ;
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

        // test hasValue fix TODO
        // test sh:deactivated TODO

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

        it("should generate correct matching report with ineligible subindividuals", async function () {
            let user = `
                @prefix ff: <https://foerderfunke.org/default#> .
                @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
                
                ff:mainPerson a ff:Citizen ;
                    ff:hasChild ff:child0, ff:child1 ;
                    ff:hasCar ff:car0 .
                
                ff:child0 a ff:Child ;
                    ff:hasAge 7 ;
                    ff:hasToy ff:toy0 .
                
                ff:child1 a ff:Child ;
                    ff:hasAge 20 ;
                    ff:hasToy ff:toy1 , ff:toy2, ff:toy3 .
                
                ff:toy0 a ff:Toy ; ff:costed 30 .
                ff:toy1 a ff:Toy ; ff:costed 40 .
                ff:toy2 a ff:Toy ; ff:costed 70 .
                ff:toy3 a ff:Toy .
                
                ff:car0 a ff:Car ; ff:engineType ff:diesel .`

            // Turtle
            // let quizReportTurtle = await matchingEngine.matching(user, [expand(SUBINDIV_RP3)], MATCHING_MODE.FULL, FORMAT.TURTLE)
            // console.log(quizReportTurtle)

            // const expectedTurtle = ``
            // strictEqual(isomorphicTurtles(quizReportTurtle, expectedTurtle), true, "The report in Turtle format does not match the expected one")
        })

        it("dummy-test to just have a quick execution thingy", async function () {
            // ...
        })
    })

    describe("testing metadata functions on the matchingEngine object", function () {
        it("should generate the correct requirement profiles metadata", async function () {
            // TODO
            /* console.log(util.inspect(matchingEngine.metadata, false, null, true))
            const json  = JSON.stringify(matchingEngine.metadata, null, 2)
            writeFileSync("./output.json", json, "utf8")
            console.log("Wrote output.json")*/
        })

        it("should generate the correct datafields metadata", async function () {

        })
    })
})
