import { promises } from "fs"
import { MatchingEngine } from "./src/new/MatchingEngine.js"
import path from "path"
import { fileURLToPath } from "url"

const repoDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "test", "knowledge-base")

async function exportDatafieldsJsonLd () {
    let me = new MatchingEngine(await promises.readFile(`${repoDir}/datafields.ttl`, "utf8"), "", [])
    let def = await me.getDatafieldDefinitions()
    await promises.writeFile("datafields.json", JSON.stringify(def, null, 2), "utf8")
}

await exportDatafieldsJsonLd()
