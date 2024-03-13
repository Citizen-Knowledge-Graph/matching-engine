import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const DB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "db")
const SHACL_DIR = `${DB_DIR}/shacl`
const USER_PROFILE = `${DB_DIR}/user-profile.ttl`

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
            console.log(requirementProfiles)
            console.log(userProfile)
        }).catch(err => console.error(err))
})
