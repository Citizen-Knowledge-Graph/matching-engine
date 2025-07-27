import path from "path"
import { existsSync, promises } from "fs"
import simpleGit from "simple-git"
import { MatchingEngine } from "../../src/MatchingEngine.js"
import { extractFirstIndividualUriFromTurtle } from "@foerderfunke/sem-ops-utils"
import { ProfileManager } from "../../src/ProfileManager.js"

const repoDir = "test/fixtures/knowledge-base"

before(async function () {
    const repoUrl = "https://github.com/Citizen-Knowledge-Graph/knowledge-base"
    try {
        if (existsSync(repoDir)) {
            await simpleGit(repoDir).pull()
        } else {
            await simpleGit().clone(repoUrl, repoDir)
        }
    } catch (err) {
        console.error("common.js: no internet connection, can't pull or clone knowledge-base, continuing though")
    }
    let me = await new MatchingEngine()
    me.addDatafieldsTurtle(await promises.readFile(`${repoDir}/datafields.ttl`, "utf8"))
    me.addDatafieldsTurtle(await promises.readFile(`${repoDir}/bielefeld/datafields-bielefeld.ttl`, "utf8"))
    me.addDefinitionsTurtle(await promises.readFile(`${repoDir}/definitions.ttl`, "utf8"))
    me.addMaterializationTurtle(await promises.readFile(`${repoDir}/materialization.ttl`, "utf8"))
    me.addConsistencyTurtle(await promises.readFile(`${repoDir}/consistency.ttl`, "utf8"))
    globalThis.matchingEngine = me
    globalThis.profileManager = new ProfileManager()
})

export async function addRpsFromKnowledgeBase(rpUris) {
    const pathsInDir = async (dir) => (await promises.readdir(dir)).map(f => path.join(dir, f))
    let allRpPaths = [...await pathsInDir(`${repoDir}/shacl`), ...await pathsInDir(`${repoDir}/beta`), ...await pathsInDir(`${repoDir}/bielefeld/shacl`)]
    for (let path of allRpPaths) {
        let rpTurtle = await promises.readFile(path, "utf8")
        let rpUri = extractFirstIndividualUriFromTurtle(rpTurtle, "ff:RequirementProfile")
        if (rpUris.includes(rpUri)) globalThis.matchingEngine.addRequirementProfileTurtle(rpTurtle)
    }
}
