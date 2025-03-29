import { describe } from "mocha"
import { strictEqual } from "node:assert"
import { existsSync } from "fs"
import simpleGit from "simple-git"

describe("matching-engine tests", function () {

    before(async function () {
        const repoDir = "test/requirement-profiles"
        const repoUrl = "https://github.com/Citizen-Knowledge-Graph/requirement-profiles"
        if (existsSync(repoDir)) {
            await simpleGit(repoDir).pull()
        } else {
            await simpleGit().clone(repoUrl, repoDir)
        }
    })

    it("dev", function () {
        strictEqual(true, true, "dev")
    })
})
