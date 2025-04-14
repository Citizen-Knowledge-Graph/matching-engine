import path from "path"
import { fileURLToPath } from "url"
import { promises } from "fs"
import Table from "cli-table3"
import { MatchingEngine } from "./src/new/MatchingEngine.js"
import { getPrioritizedMissingDataFieldsJson } from "./src/prematch.js"
import { FORMAT, MATCHING_MODE } from "./src/new/queries.js"

// requires the knowledge-base in the test-directory ("npm test" will clone it there automatically)
const repoDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "test", "knowledge-base")
const user = "@prefix ff: <https://foerderfunke.org/default#> . ff:mainPerson a ff:Citizen ."

async function benchmarkOldMatchingWithFetching() {
    console.log("running benchmark on old matching with fetching")
    return await benchmarkOldSetup(true)
}

async function benchmarkOldMatchingWithoutFetching() {
    console.log("running benchmark on old matching without fetching")
    return await benchmarkOldSetup(false)
}

async function benchmarkOldSetup(fetchFromGitHub) {
    let start = Date.now()
    let rps = []
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
            rps.push(await response.text())
        }
    } else {
        for (let file of await promises.readdir(`${repoDir}/shacl`)) {
            rps.push(await promises.readFile(`${repoDir}/shacl/${file}`, "utf8"))
        }
    }
    let report = await getPrioritizedMissingDataFieldsJson(
        [],
        [],
        user,
        await promises.readFile(`${repoDir}/datafields.ttl`, "utf8"),
        rps,
        await promises.readFile(`${repoDir}/materialization.ttl`, "utf8"),
        "de"
    )
    let end = Date.now()
    return end - start
}

async function newInitialSetup() {
    let rps = []
    for (let file of await promises.readdir(`${repoDir}/shacl`)) {
        rps.push(await promises.readFile(`${repoDir}/shacl/${file}`, "utf8"))
    }
    return new MatchingEngine(
        await promises.readFile(`${repoDir}/datafields.ttl`, "utf8"),
        await promises.readFile(`${repoDir}/materialization.ttl`, "utf8"),
        rps
    )
}

async function benchmarkNewInitialSetup() {
    console.log("running benchmark on new initial setup")
    let start = Date.now()
    let matchingEngine = await newInitialSetup()
    let end = Date.now()
    return end - start
}

async function benchmarkNewQuizMatchingToTurtle() {
    return await newMatching(MATCHING_MODE.QUIZ, FORMAT.TURTLE)
}

async function benchmarkNewQuizMatchingToJsonLd() {
    return await newMatching(MATCHING_MODE.QUIZ, FORMAT.JSON_LD)
}

async function benchmarkNewFullMatchingToTurtle() {
    return await newMatching(MATCHING_MODE.FULL, FORMAT.TURTLE)
}

async function benchmarkNewFullMatchingToJsonLd() {
    return await newMatching(MATCHING_MODE.FULL, FORMAT.JSON_LD)
}

async function newMatching(mode, format) {
    console.log("running benchmark on new matching")
    // the initial setup is done once and then kept in memory, that's we don't measure it here
    let matchingEngine= await newInitialSetup()
    let start = Date.now()
    let quizReport = await matchingEngine.matching(user, matchingEngine.getAllRpUris(), mode, format)
    let end = Date.now()
    return end - start
}

const table = new Table({ head: ["method", "average", "slowest", "fastest"] })
let n = 10

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

await run(benchmarkOldMatchingWithFetching)
await run(benchmarkOldMatchingWithoutFetching)
await run(benchmarkNewInitialSetup)
await run(benchmarkNewQuizMatchingToTurtle)
await run(benchmarkNewQuizMatchingToJsonLd)
await run(benchmarkNewFullMatchingToTurtle)
await run(benchmarkNewFullMatchingToJsonLd)

console.log(`Results of running benchmark with ${n} iterations each:`)
console.log(table.toString())
