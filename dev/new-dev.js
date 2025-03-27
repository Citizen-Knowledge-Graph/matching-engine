import path from "path"
import { fileURLToPath } from "url"
import { promises } from "fs"
import { MatchingEngine } from "../src/new/MatchingEngine.js"
import { expandShortenedUri } from "sem-ops-utils"

let matchingEngine

async function devBuildMatchingEngine() {
    const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "requirement-profiles")
    const rps = []
    for (let file of await promises.readdir(`${ROOT}/shacl`)) {
        rps.push(await promises.readFile(`${ROOT}/shacl/${file}`, "utf8"))
    }
    matchingEngine = new MatchingEngine(
        await promises.readFile(`${ROOT}/datafields.ttl`, "utf8"),
        await promises.readFile(`${ROOT}/materialization.ttl`, "utf8"),
        rps
    )
    // the client keeps this in memory and uses it over the duration of a session
    console.log("matchingEngine", Object.keys(matchingEngine))
}

async function devBasicValidation() {
    let userProfile = `
        @prefix ff: <https://foerderfunke.org/default#> .
        ff:mainPerson a ff:Citizen ;
            ff:hasAge 50 .`
    let report = await matchingEngine.validateOne(userProfile, expandShortenedUri("ff:kinderzuschlag"))
    console.log("Report", report)
}

await devBuildMatchingEngine()
await devBasicValidation()
