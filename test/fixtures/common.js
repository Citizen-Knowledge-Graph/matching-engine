import path from "path"
import { existsSync, promises } from "fs"
import simpleGit from "simple-git"
import { MatchingEngine } from "../../src/new/MatchingEngine.js"
import { extractFirstIndividualUriFromTurtle } from "@foerderfunke/sem-ops-utils"

const repoDir = "test/fixtures/knowledge-base"

before(async function () {
    const repoUrl = "https://github.com/Citizen-Knowledge-Graph/knowledge-base"
    if (existsSync(repoDir)) {
        await simpleGit(repoDir).pull()
    } else {
        await simpleGit().clone(repoUrl, repoDir)
    }
    globalThis.matchingEngine = await new MatchingEngine(
        await promises.readFile(`${repoDir}/datafields.ttl`, "utf8"),
        await promises.readFile(`${repoDir}/materialization.ttl`, "utf8"),
        await promises.readFile(`${repoDir}/consistency.ttl`, "utf8"),
        []
    )
})

export async function addRpsFromKnowledgeBase(rpUris) {
    const pathsInDir = async (dir) => (await promises.readdir(dir)).map(f => path.join(dir, f))
    let allRpPaths = [...await pathsInDir(`${repoDir}/shacl`), ...await pathsInDir(`${repoDir}/beta`)]
    for (let path of allRpPaths) {
        let rpTurtle = await promises.readFile(path, "utf8")
        let rpUri = extractFirstIndividualUriFromTurtle(rpTurtle, "ff:RequirementProfile")
        if (rpUris.includes(rpUri)) globalThis.matchingEngine.addValidator(rpTurtle)
    }
}
