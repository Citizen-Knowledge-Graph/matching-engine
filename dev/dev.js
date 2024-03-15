import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import { runSPARQLQueryOnRdfString, validateAll } from "../src/index.js"

const DB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "db")
const SHACL_DIR = `${DB_DIR}/shacl`
const USER_PROFILE = `${DB_DIR}/dummy-user-profile.ttl`

function devSPARQLQueryOnRdfString() {
    const query = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        SELECT * WHERE { 
            ?s foaf:birthday ?bday .
            BIND(YEAR(NOW()) - YEAR(?bday) - IF(MONTH(NOW()) < MONTH(?bday) || (MONTH(NOW()) = MONTH(?bday) && DAY(NOW()) < DAY(?bday)), 1, 0) AS ?age) .
        }
    `
    /*const rdfStr = `
        @prefix ex: <http://example.org/> .
        ex:sub1 ex:pred1 ex:obj1 .
        ex:sub2 ex:pred2 ex:obj2 .
    `*/
    fs.readFile(USER_PROFILE, "utf8", (err, data) => {
        runSPARQLQueryOnRdfString(query, data).then(result => console.log(result))
    })
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
