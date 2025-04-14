import path from "path"
import { fileURLToPath } from "url"
import { promises } from "fs"
import { MatchingEngine } from "../src/new/MatchingEngine.js"
import { validateAll } from "../src/index.js"
import Table from "cli-table3"

// requires the knowledge-base to be cloned into this directory ("npm test" will do that automatically)
const repoDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "knowledge-base")
const user = "@prefix ff: <https://foerderfunke.org/default#> . ff:mainPerson a ff:Citizen ."

async function benchmarkOldSetupWithFetching() {
    console.log("running benchmark on old setup with fetching")
    return await benchmarkOldSetup(true)
}

async function benchmarkOldSetupWithoutFetching() {
    console.log("running benchmark on old setup without fetching")
    return await benchmarkOldSetup(false)
}

async function benchmarkOldSetup(fetchFromGitHub) {
    let start = Date.now()
    let rps = {}
    if (fetchFromGitHub) {
        let filenames = [
            "01-hilfe-zum-lebensunterhalt.ttl",
            "02-kindergeld.ttl",
            "03-kinderzuschlag.ttl",
            "04-bafoeg.ttl",
            "05-buergergeld.ttl",
            "06-arbeitslosengeld.ttl",
            "07-berufsausbildungsbeihilfe-bab.ttl",
            "08-wohngeld.ttl",
            "09-grundsicherung-im-alter-und-bei-erwerbsminderung.ttl",
            "10-bildung-und-teilhabe-bei-bezug-von-buergergeld.ttl"
        ]
        for (let file of filenames) {
            const response = await fetch("https://raw.githubusercontent.com/Citizen-Knowledge-Graph/knowledge-base/main/shacl/" + file)
            rps[file] = await response.text()
        }
    } else {
        for (let file of await promises.readdir(`${repoDir}/shacl`)) {
            rps[file] = await promises.readFile(`${repoDir}/shacl/${file}`, "utf8")
        }
    }
    let report = await validateAll(
        user, rps,
        await promises.readFile(`${repoDir}/datafields.ttl`, "utf8"),
        await promises.readFile(`${repoDir}/materialization.ttl`, "utf8"),
        false)
    let end = Date.now()
    return end - start
}

async function benchmarkNewSetup() {
    console.log("running benchmark on new setup")
    // these setup-steps are now done once initially and then kept in memory, that's we don't measure them
    let rps = []
    for (let file of await promises.readdir(`${repoDir}/shacl`)) {
        rps.push(await promises.readFile(`${repoDir}/shacl/${file}`, "utf8"))
    }
    let matchingEngine = new MatchingEngine(
        await promises.readFile(`${repoDir}/datafields.ttl`, "utf8"),
        await promises.readFile(`${repoDir}/materialization.ttl`, "utf8"),
        rps
    )
    let start = Date.now()
    let quizReport = await matchingEngine.quizMatching(user, matchingEngine.getAllRpUris(), false)
    let end = Date.now()
    return end - start
}

const table = new Table({ head: ["method", "average", "slowest", "fastest"] })
let n = 2

async function run(func) {
    let time = 0, slowest = 0, fastest = Infinity
    for (let i = 0; i < n; i++) {
        let t = await func()
        time += t
        if (t > slowest) slowest = t
        if (t < fastest) fastest = t
    }
    table.push([func.name, Math.round(time / n), slowest, fastest])
}

await run(benchmarkOldSetupWithFetching)
await run(benchmarkOldSetupWithoutFetching)
await run(benchmarkNewSetup)

console.log(`Results of running benchmark with ${n} iterations each:`)
console.log(table.toString())
