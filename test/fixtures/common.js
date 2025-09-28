import path from "path"
import { existsSync, promises } from "fs"
import simpleGit from "simple-git"
import { MatchingEngine } from "../../src/MatchingEngine.js"
import { extractFirstIndividualUriFromTurtle } from "@foerderfunke/sem-ops-utils"
import { ProfileManager } from "../../src/ProfileManager.js"
import { extractSubjectForPredicate } from "../../src/utils.js"

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
    me.addDef(await promises.readFile(`${repoDir}/build/def.built.ttl`, "utf8"))
    globalThis.matchingEngine = me

    /*let pm = new ProfileManager()
    pm.addDatafieldsTurtle(await promises.readFile(`${repoDir}/datafields.ttl`, "utf8"))
    pm.addDatafieldsTurtle(await promises.readFile(`${repoDir}/bielefeld/datafields-bielefeld.ttl`, "utf8"))
    pm.addDefinitionsTurtle(await promises.readFile(`${repoDir}/definitions.ttl`, "utf8"))
    pm.addMaterializationTurtle(await promises.readFile(`${repoDir}/materialization.ttl`, "utf8"))
    pm.addConsistencyTurtle(await promises.readFile(`${repoDir}/consistency.ttl`, "utf8"))
    globalThis.profileManager = pm*/
})

export async function addAllRpsFromKnowledgeBase() {
    await addRpsFromKnowledgeBase(null, true)
}

export async function addRpsFromKnowledgeBase(rpUris, addAll = false) {
    const shaclDir1 = `${repoDir}/shacl`
    const shaclDir2 = `${shaclDir1}/beta`
    const shaclDir3 = `${shaclDir1}/bielefeld`
    let allRpPaths = [
        ...(await promises.readdir(shaclDir1)).filter(f => f.endsWith(".ttl")).map(f => path.join(shaclDir1, f)),
        ...(await promises.readdir(shaclDir2)).filter(f => f.endsWith(".ttl")).map(f => path.join(shaclDir2, f)),
        ...(await promises.readdir(shaclDir3)).filter(f => f.endsWith(".ttl")).map(f => path.join(shaclDir3, f))
    ]
    for (let path of allRpPaths) {
        let turtle = await promises.readFile(path, "utf8")
        if (addAll) {
            globalThis.matchingEngine.addRequirementProfileTurtle(turtle)
            continue
        }
        let rpUri = extractFirstIndividualUriFromTurtle(turtle, "ff:RequirementProfile")
        if (rpUris.includes(rpUri)) globalThis.matchingEngine.addRequirementProfileTurtle(turtle)
    }
    /*let allInfoPagePaths = await pathsInDir(`${repoDir}/bielefeld/info`)
    for (let path of allInfoPagePaths) {
        let turtle = await promises.readFile(path, "utf8")
        let rpUri = extractSubjectForPredicate(turtle, "ff:hasInfoContent")
        if (addAll || rpUris.includes(rpUri)) globalThis.matchingEngine.addInfoPageTurtle(turtle)
    }*/
}
