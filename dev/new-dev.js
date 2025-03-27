import path from "path"
import { fileURLToPath } from "url"
import { promises } from "fs"
import { MatchingEngine } from "../src/new/MatchingEngine.js"

async function devBuildMatchingEngine() {
    const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "requirement-profiles")
    const rps = []
    for (let file of await promises.readdir(`${ROOT}/shacl`)) {
        rps.push(await promises.readFile(`${ROOT}/shacl/${file}`, "utf8"))
    }
    let matchingEngine = new MatchingEngine(
        await promises.readFile(`${ROOT}/datafields.ttl`, "utf8"),
        await promises.readFile(`${ROOT}/materialization.ttl`, "utf8"),
        rps
    )
    // the client keeps this in memory and uses it over the duration of a session
    console.log("matchingEngine", Object.keys(matchingEngine))
}

await devBuildMatchingEngine()
