import { Writer, DataFactory } from "n3"
import express from "express"
const app = express()
const port = 3000
app.use(express.json())
import jsonProfileLocal from "../dev/opendva-profile-data.json" assert { type: "json" }

app.post("/foerderfunke", async (req, res) => {
    if (Object.keys(req.body).length === 0 || !req.body.jsonProfile) {
        return res.status(400).json({ success: false, message: "Request body is empty" })
    }
    await validateAll(req.body.jsonProfile, res)
})

app.post("/foerderfunke-fallback", async (req, res) => {
    await validateAll(jsonProfileLocal, res)
})

const validateAll = async (jsonProfile, res) => {
    try {
        const turtleProfile = await buildTurtleFromOpenDvaDemoJson(jsonProfile)

        // TODO

        res.json({ success: true, turtleProfile })
    } catch (error) {
        res.status(500).json({ success: false, error: error.message })
    }
}

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`)
})

const ns = {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    sh: "http://www.w3.org/ns/shacl#",
    ff: "https://foerderfunke.org/default#"
}

const mainPerson = DataFactory.namedNode(`${ns.ff}mainPerson`)

const openDvaJsonKeysToFfDataFieldPredicates = {
    "name_xdf-F60000227": "hasFamilyName",
    "vorname_xdf-F60000228": "hasFirstNames",
    "geburtsdatum_xdf-G60000083": "hasBirthday",
    "geschlecht_xdf-F00001750": "hasGender",
    "ort_xdf-F60000247": "hasResidence",
    "selbststandigTatigkeiten_xdf-null": "worksAsFreelancer",
}

const manuallyAddedTriples = [
    [mainPerson, DataFactory.namedNode(`${ns.rdf}type`), DataFactory.namedNode(`${ns.ff}Citizen`)],
    [mainPerson, DataFactory.namedNode(`${ns.ff}eligibleForSocialSupport`), DataFactory.literal(true)],
]

const buildTurtleFromOpenDvaDemoJson = (jsonProfile) => {
    return new Promise((resolve, reject) => {
        const writer = new Writer({ prefixes: ns })

        Object.entries(openDvaJsonKeysToFfDataFieldPredicates).forEach(([key, ffPredicate]) => {
            if (!jsonProfile.hasOwnProperty(key)) return

            let predicate = DataFactory.namedNode(`${ns.ff}${ffPredicate}`)
            let object = DataFactory.literal(jsonProfile[key])

            if (key.includes("geburtsdatum")) {
                const parts = jsonProfile[key].split("/")
                const day = parts[0].padStart(2, "0")
                const month = parts[1].padStart(2, "0")
                const year = parts[2]
                object = DataFactory.literal(`${year}-${month}-${day}`, DataFactory.namedNode("http://www.w3.org/2001/XMLSchema#date"))
            }

            writer.addQuad(mainPerson, predicate, object)
        });

        manuallyAddedTriples.forEach(triple => writer.addQuad(... triple))

        writer.end((error, result) => {
            if (error) {
                reject(error)
            } else {
                resolve(result)
            }
        })
    })
}
