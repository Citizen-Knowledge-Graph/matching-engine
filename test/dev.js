import path from "path"
import { fileURLToPath } from "url"
import { promises } from "fs"
import { MatchingEngine } from "../src/new/MatchingEngine.js"

const repoDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "knowledge-base")

async function benchmarkOldSetup() {
    // TODO
}

async function benchmarkNewSetup() {
    let rps = []
    for (let file of await promises.readdir(`${repoDir}/shacl`)) {
        rps.push(await promises.readFile(`${repoDir}/shacl/${file}`, "utf8"))
    }
    let matchingEngine = new MatchingEngine(
        await promises.readFile(`${repoDir}/datafields.ttl`, "utf8"),
        await promises.readFile(`${repoDir}/materialization.ttl`, "utf8"),
        rps
    )
    let user = "@prefix ff: <https://foerderfunke.org/default#> . ff:mainPerson a ff:Citizen ."
    let quizReport = await matchingEngine.quizMatching(user, matchingEngine.getAllRpUris(), false)

    console.log(quizReport)
}

benchmarkOldSetup()
benchmarkNewSetup()
