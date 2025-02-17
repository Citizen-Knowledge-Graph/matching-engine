import path from "path"
import { fileURLToPath } from "url"
import { promises } from "fs"
import { buildValidator, datasetToTurtle, runValidation, storeFromTurtle, extractRpUriFromRpStr, buildValidators, turtleToDataset } from "../src/new/basics.js"
import { runMatching } from "../src/new/main.js"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "requirement-profiles", "sozialplattform")
const RPs = `${ROOT}/shacl`
const UP = `${ROOT}/user-profile-dev.ttl`
const DFs = `${ROOT}/datafields.ttl`
const MATs = `${ROOT}/materialization.ttl`

async function testValidator() {
    let up = await promises.readFile(UP, "utf8")
    let rp = await promises.readFile(`${RPs}/03-kinderzuschlag.ttl`, "utf8")
    const report = await runValidation(buildValidator(rp), turtleToDataset(up))
    console.log(await datasetToTurtle(report.dataset))
}

async function buildValidatorsMap(includeUp = false) {
    let map = {}
    if (includeUp) map["up"] = await promises.readFile(UP, "utf8")
    for (let file of await promises.readdir(RPs)) {
        let rpStr = await promises.readFile(`${RPs}/${file}`, "utf8")
        let rpUri = extractRpUriFromRpStr(rpStr)
        if (rpUri) map[rpUri] = rpStr
    }
    return buildValidators(map)
}

async function testValidators() {
    console.log(await buildValidatorsMap(true))
}

async function testRunMatching() {
    let up = await promises.readFile(UP, "utf8")
    let profileStore = storeFromTurtle(up)
    let map = await buildValidatorsMap()
    await runMatching(profileStore, map)
}

// await testValidator()
// await testValidators()
await testRunMatching()
