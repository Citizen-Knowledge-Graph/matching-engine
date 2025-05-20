import { existsSync, promises } from "fs"
import simpleGit from "simple-git"
import { MatchingEngine } from "../../src/new/MatchingEngine.js"
import { FORMAT } from "../../src/new/queries.js"

before(async function () {
    const repoDir = "test/fixtures/knowledge-base"
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
    global.matchingEngine = await new MatchingEngine(
        await promises.readFile(`${repoDir}/datafields.ttl`, "utf8"),
        await promises.readFile(`${repoDir}/materialization.ttl`, "utf8"),
        await promises.readFile(`${repoDir}/consistency.ttl`, "utf8"),
        rps,
        "en",
        FORMAT.JSON_LD
    ).init()
})
