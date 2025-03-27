import path from "path"
import { fileURLToPath } from "url"
import { promises } from "fs"
import { buildInMemoryObject } from "../src/new/main.js"

let inMemoryObject = {}

async function devBuildInMemoryObject() {
    const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "requirement-profiles")
    const rps = []
    for (let file of await promises.readdir(`${ROOT}/shacl`)) {
        rps.push(await promises.readFile(`${ROOT}/shacl/${file}`, "utf8"))
    }
    inMemoryObject = buildInMemoryObject(
        await promises.readFile(`${ROOT}/datafields.ttl`, "utf8"),
        await promises.readFile(`${ROOT}/materialization.ttl`, "utf8"),
        rps
    )
    console.log("inMemoryObject", Object.keys(inMemoryObject))
}

await devBuildInMemoryObject()
