import path from "path"
import { fileURLToPath } from "url"
import { promises } from "fs"
import { MatchingEngine } from "../src/new/MatchingEngine.js"
import { validateAll } from "../src/index.js"

const repoDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "knowledge-base")
const user = "@prefix ff: <https://foerderfunke.org/default#> . ff:mainPerson a ff:Citizen ."

async function benchmarkOldSetup(fetchFromGitHub = false) {
    console.log("running benchmark on old setup", fetchFromGitHub)
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

let n = 50
let time = 0, slowest = 0, fastest = Infinity

for (let i = 0; i < n; i ++) {
    let t = await benchmarkOldSetup(true)
    time += t
    if (t > slowest) slowest = t
    if (t < fastest) fastest = t
}
let result1 = `Old setup with fetching from GitHub, average over ${n} runs: ` + (time / n) + " ms. Slowest: " + slowest + " ms. Fastest: " + fastest + " ms."
time = 0
slowest = 0
fastest = Infinity

for (let i = 0; i < n; i ++) {
    let t = await benchmarkOldSetup(false)
    time += t
    if (t > slowest) slowest = t
    if (t < fastest) fastest = t
}
let result2 = `Old setup without fetching from GitHub (local instead), average over ${n} runs: ` + (time / n) + " ms. Slowest: " + slowest + " ms. Fastest: " + fastest + " ms."
time = 0
slowest = 0
fastest = Infinity

for (let i = 0; i < n; i ++) {
    let t = await benchmarkNewSetup()
    time += t
    if (t > slowest) slowest = t
    if (t < fastest) fastest = t
}
let result3 = `New setup without the one-time initial setup, average over ${n} runs: ` + (time / n) + " ms. Slowest: " + slowest + " ms. Fastest: " + fastest + " ms."

console.log(result1)
console.log(result2)
console.log(result3)
