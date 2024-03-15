import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import { runSPARQLQueryOnRdfString, validateAll } from "../src/index.js"

const DB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "db")
const SHACL_DIR = `${DB_DIR}/shacl`
const USER_PROFILE = `${DB_DIR}/user-profile.ttl`

function devSPARQLQueryOnRdfString() {
    const query = "SELECT * WHERE { ?s ?p ?o }"
    const rdfStr = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate ex:object .
        ex:sub2 ex:pred2 ex:obj2 .
    `
    runSPARQLQueryOnRdfString(query, rdfStr).then(result => console.log(result))
}
function devValidateAll() {
    fs.readdir(SHACL_DIR, async (err, files) => {
        if (err) { console.error(err); return }

        let userProfile = ""
        let requirementProfiles = []

        let promises = files.map(shaclFile => {
            return new Promise((resolve, reject) => {
                fs.readFile(`${SHACL_DIR}/${shaclFile}`, "utf8", (err, data) => {
                    if (err) { reject(err); return }
                    requirementProfiles.push(data)
                    resolve()
                })
            })
        })
        promises.push(new Promise((resolve, reject) => {
            fs.readFile(USER_PROFILE, "utf8", (err, data) => {
                if (err) { reject(err); return }
                userProfile = data
                resolve()
            })
        }))

        Promise.all(promises)
            .then(() => {
                validateAll(userProfile, requirementProfiles).then(report => console.log(report))
            }).catch(err => console.error(err))
    })
}

// devValidateAll()
devSPARQLQueryOnRdfString()
