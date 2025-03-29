import { describe } from "mocha"
import { strictEqual, deepStrictEqual } from "node:assert"
import { existsSync, promises } from "fs"
import simpleGit from "simple-git"
import { MatchingEngine } from "../src/new/MatchingEngine.js"
import { expandShortenedUri } from "sem-ops-utils"

describe("all matching-engine tests", function () {

    let matchingEngine

    before(async function () {
        const repoDir = "test/requirement-profiles"
        const repoUrl = "https://github.com/Citizen-Knowledge-Graph/requirement-profiles"
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
            Object.keys(matchingEngine), ["knowledgeBaseStore", "requirementProfilesStore", "validators"],
            "The matchingEngine object does not have the expected keys")
    })

    describe("testing functions on the matchingEngine object", function () {
        it("should validate non-conforming for simple profile", async function () {
            let userProfile = `
                @prefix ff: <https://foerderfunke.org/default#> .
                ff:mainPerson a ff:Citizen ; ff:hasAge 50 .`
            let report = await matchingEngine.validateOne(userProfile, expandShortenedUri("ff:kinderzuschlag"))
            strictEqual(report.conforms, false, "The validation report conforms, even so it shouldn't")
        })
    })
})
