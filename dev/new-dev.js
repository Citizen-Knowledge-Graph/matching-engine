import path from "path"
import { fileURLToPath } from "url"
import { promises } from "fs"
import { buildValidator, datasetToTurtle, runValidation, storeFromTurtle } from "../src/new/basics.js"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "requirement-profiles", "sozialplattform")
const RPs = `${ROOT}/shacl`
const UP = `${ROOT}/user-profile-dev.ttl`
const DFs = `${ROOT}/datafields.ttl`
const MATs = `${ROOT}/materialization.ttl`

async function testValidator() {
    let up = await promises.readFile(UP, "utf8")
    let rp = await promises.readFile(`${RPs}/03-kinderzuschlag.ttl`, "utf8")
    const report = await runValidation(buildValidator(rp), storeFromTurtle(up))
    console.log(await datasetToTurtle(report.dataset))
}

await testValidator()
