import { describe } from "mocha"
import { strictEqual, deepStrictEqual } from "node:assert"
import { existsSync, promises } from "fs"
import simpleGit from "simple-git"
import { MatchingEngine } from "../src/new/MatchingEngine.js"
import { expandShortenedUri, isomorphicTurtles } from "sem-ops-utils"

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
            Object.keys(matchingEngine), ["dfMatStore", "datafieldsValidator", "requirementProfilesStore", "validators"],
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

        it("should generate correct quiz-matching report", async function () {
            let user = `
                @prefix ff: <https://foerderfunke.org/default#> .
                ff:mainPerson a ff:Citizen ; ff:hasAge 16 .`
            let quizReport = await matchingEngine.quizMatching(user, [expandShortenedUri(SIMPLE_RP1), expandShortenedUri(SIMPLE_RP2)])
            const expected = `
                @prefix ff: <https://foerderfunke.org/default#>.
                ff:devRp1 ff:hasEligibilityStatus ff:ineligible .
                ff:devRp2 ff:hasEligibilityStatus ff:missingData .
                ff:mainPerson_hasIncome
                  ff:hasDatafield ff:hasIncome ;
                  ff:hasIndividual ff:mainPerson ;
                  ff:isMissedBy ff:devRp2 .`
            strictEqual(isomorphicTurtles(quizReport, expected), true, "The report does not match the expected one")
        })
    })
})
