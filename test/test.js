import { describe } from "mocha"
import { strictEqual, deepStrictEqual } from "node:assert"
import { existsSync, promises } from "fs"
import simpleGit from "simple-git"
import { MatchingEngine } from "../src/new/MatchingEngine.js"
import { expandShortenedUri, isomorphicTurtles } from "sem-ops-utils"
import lodash from "lodash"
import { FORMAT, MATCHING_MODE } from "../src/new/queries.js"

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
        matchingEngine = new MatchingEngine(
            await promises.readFile(`${repoDir}/datafields.ttl`, "utf8"),
            await promises.readFile(`${repoDir}/materialization.ttl`, "utf8"),
            rps
        )
    })

    it("matchingEngine object should have correct keys", function () {
        deepStrictEqual(
            Object.keys(matchingEngine), ["dfMatStore", "datafieldsValidator", "requirementProfilesStore", "validators", "matQueries"],
            "The matchingEngine object does not have the expected keys")
    })

    describe("testing profile validation and materialization functions on the matchingEngine object", function () {
        const SIMPLE_UP = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
                ff:staatsbuergerschaft ff:staatsbuergerschaft-ao-eu .`

        it("should validate simple profile against datafield shapes", async function () {
            let report = await matchingEngine.validateAgainstDatafieldShapes(SIMPLE_UP)
            strictEqual(report.conforms, true, "Simple profile did not pass datafields validation")
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
            let report = await matchingEngine.basicValidation(user, expandShortenedUri(SIMPLE_RP1))
            strictEqual(report.conforms, true, "The validation report does not conform, even so it should")
        })

        it("should validate non-conforming for basic case", async function () {
            let user = `
                @prefix ff: <https://foerderfunke.org/default#> .
                ff:mainPerson a ff:Citizen ; ff:hasAge 16 .`
            let report = await matchingEngine.basicValidation(user, expandShortenedUri(SIMPLE_RP1))
            strictEqual(report.conforms, false, "The validation report conforms, even so it shouldn't")
        })

        // test hasValue fix TODO
        // test sh:deactivated TODO

        it("should generate correct quiz matching report", async function () {
            let user = `
                @prefix ff: <https://foerderfunke.org/default#> .
                ff:mainPerson a ff:Citizen ; ff:hasAge 16 .`

            // Turtle
            let quizReportTurtle = await matchingEngine.matching(user, [expandShortenedUri(SIMPLE_RP1), expandShortenedUri(SIMPLE_RP2)], MATCHING_MODE.QUIZ, FORMAT.TURTLE)
            const expectedTurtle = `
                @prefix ff: <https://foerderfunke.org/default#>.
                @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
                @prefix sh: <http://www.w3.org/ns/shacl#>.
                
                ff:devRp1
                  ff:hasEligibilityStatus ff:ineligible.
                
                ff:devRp2
                  ff:hasEligibilityStatus ff:missingData.
                
                ff:mostMissedDatafield
                  rdf:predicate ff:hasIncome;
                  rdf:subject ff:mainPerson.
                
                ff:this
                  ff:numberOfMissingDatafields 1.
                
                ff:UserProfile
                  sh:conforms "true".`
            strictEqual(isomorphicTurtles(quizReportTurtle, expectedTurtle), true, "The report in Turtle format does not match the expected one")

            // JSON-lD
            let quizReportJsonLd = await matchingEngine.matching(user, [expandShortenedUri(SIMPLE_RP1), expandShortenedUri(SIMPLE_RP2)], MATCHING_MODE.QUIZ, FORMAT.JSON_LD)
            const expectedJsonLd = {
                '@context': {
                    ff: 'https://foerderfunke.org/default#',
                    sh: 'http://www.w3.org/ns/shacl#',
                    xsd: 'http://www.w3.org/2001/XMLSchema#',
                    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
                },
                '@graph': [
                    { '@id': 'ff:UserProfile', 'sh:conforms': 'true' },
                    {
                        '@id': 'ff:devRp1',
                        'ff:hasEligibilityStatus': { '@id': 'ff:ineligible' }
                    },
                    {
                        '@id': 'ff:devRp2',
                        'ff:hasEligibilityStatus': { '@id': 'ff:missingData' }
                    },
                    {
                        '@id': 'ff:mostMissedDatafield',
                        'rdf:predicate': { '@id': 'ff:hasIncome' },
                        'rdf:subject': { '@id': 'ff:mainPerson' }
                    },
                    {
                        '@id': 'ff:this',
                        'ff:numberOfMissingDatafields': { '@type': 'xsd:integer', '@value': '1' }
                    }
                ]
            }
            strictEqual(lodash.isEqual(quizReportJsonLd, expectedJsonLd), true, "The report in JSON-LD format does not match the expected one")
        })

        it("should generate correct full matching report", async function () {
            let user = `
                @prefix ff: <https://foerderfunke.org/default#> .
                ff:mainPerson a ff:Citizen ; ff:hasAge 16 .`

            // Turtle
            let quizReportTurtle = await matchingEngine.matching(user, [expandShortenedUri(SIMPLE_RP1), expandShortenedUri(SIMPLE_RP2)], MATCHING_MODE.FULL, FORMAT.TURTLE)
            const expectedTurtle = `
                @prefix ff: <https://foerderfunke.org/default#>.
                @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
                @prefix sh: <http://www.w3.org/ns/shacl#>.
                
                ff:devRp1
                  ff:hasEligibilityStatus ff:ineligible;
                  ff:hasViolatingDatafield ff:devRp1_mainPerson_hasAge.
                
                ff:devRp1_mainPerson_hasAge
                  rdf:predicate ff:hasAge;
                  rdf:subject ff:mainPerson;
                  ff:hasMessage 'Value is not greater than or equal to "18"^^<http://www.w3.org/2001/XMLSchema#integer>';
                  ff:hasValue 16;
                  ff:hasViolationType sh:MinInclusiveConstraintComponent.
                
                ff:devRp2
                  ff:hasEligibilityStatus ff:missingData.
                
                ff:mainPerson_hasIncome
                  rdf:predicate ff:hasIncome;
                  rdf:subject ff:mainPerson;
                  ff:isMissedBy ff:devRp2.
                
                ff:materializationQueryResult_0 a ff:MaterializationQueryResult;
                  ff:fromMaterializationRule ff:InterestedInBuildingActivatorRule;
                  ff:hasTriple ff:materializedTriple_0.
                
                ff:materializedTriple_0 a rdf:Statement;
                  rdf:object false;
                  rdf:predicate ff:interested_in_building_renovation_FLAG;
                  rdf:subject ff:mainPerson.
                
                ff:mostMissedDatafield
                  rdf:predicate ff:hasIncome;
                  rdf:subject ff:mainPerson.
                
                ff:this
                  ff:numberOfMissingDatafields 1.
                
                ff:UserProfile
                  sh:conforms "true".`
            strictEqual(isomorphicTurtles(quizReportTurtle, expectedTurtle), true, "The report in Turtle format does not match the expected one")

            // JSON-lD
            let quizReportJsonLd = await matchingEngine.matching(user, [expandShortenedUri(SIMPLE_RP1), expandShortenedUri(SIMPLE_RP2)], MATCHING_MODE.FULL, FORMAT.JSON_LD)
            const expectedJsonLd = {
                '@context': {
                    ff: 'https://foerderfunke.org/default#',
                    sh: 'http://www.w3.org/ns/shacl#',
                    xsd: 'http://www.w3.org/2001/XMLSchema#',
                    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
                },
                '@graph': [
                    { '@id': 'ff:UserProfile', 'sh:conforms': 'true' },
                    {
                        '@id': 'ff:devRp1',
                        'ff:hasEligibilityStatus': { '@id': 'ff:ineligible' },
                        'ff:hasViolatingDatafield': { '@id': 'ff:devRp1_mainPerson_hasAge' }
                    },
                    {
                        '@id': 'ff:devRp1_mainPerson_hasAge',
                        'rdf:predicate': { '@id': 'ff:hasAge' },
                        'rdf:subject': { '@id': 'ff:mainPerson' },
                        'ff:hasMessage': 'Value is not greater than or equal to "18"^^<http://www.w3.org/2001/XMLSchema#integer>',
                        'ff:hasValue': { '@type': 'xsd:integer', '@value': '16' },
                        'ff:hasViolationType': { '@id': 'sh:MinInclusiveConstraintComponent' }
                    },
                    {
                        '@id': 'ff:devRp2',
                        'ff:hasEligibilityStatus': { '@id': 'ff:missingData' }
                    },
                    {
                        '@id': 'ff:mainPerson_hasIncome',
                        'rdf:predicate': { '@id': 'ff:hasIncome' },
                        'rdf:subject': { '@id': 'ff:mainPerson' },
                        'ff:isMissedBy': { '@id': 'ff:devRp2' }
                    },
                    {
                        '@id': 'ff:materializationQueryResult_0',
                        '@type': 'ff:MaterializationQueryResult',
                        'ff:fromMaterializationRule': { '@id': 'ff:InterestedInBuildingActivatorRule' },
                        'ff:hasTriple': { '@id': 'ff:materializedTriple_0' }
                    },
                    {
                        '@id': 'ff:materializedTriple_0',
                        '@type': 'rdf:Statement',
                        'rdf:object': { '@type': 'xsd:boolean', '@value': 'false' },
                        'rdf:predicate': { '@id': 'ff:interested_in_building_renovation_FLAG' },
                        'rdf:subject': { '@id': 'ff:mainPerson' }
                    },
                    {
                        '@id': 'ff:mostMissedDatafield',
                        'rdf:predicate': { '@id': 'ff:hasIncome' },
                        'rdf:subject': { '@id': 'ff:mainPerson' }
                    },
                    {
                        '@id': 'ff:this',
                        'ff:numberOfMissingDatafields': { '@type': 'xsd:integer', '@value': '1' }
                    }
                ]
            }
            strictEqual(lodash.isEqual(quizReportJsonLd, expectedJsonLd), true, "The report in JSON-LD format does not match the expected one")
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
            let quizReportTurtle = await matchingEngine.matching(user, [expandShortenedUri(SUBINDIV_RP3)], MATCHING_MODE.FULL, FORMAT.TURTLE)
            // console.log(quizReportTurtle)

            // const expectedTurtle = ``
            // strictEqual(isomorphicTurtles(quizReportTurtle, expectedTurtle), true, "The report in Turtle format does not match the expected one")
        })
    })
})
