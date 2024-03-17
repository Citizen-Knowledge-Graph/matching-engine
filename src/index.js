import { QueryEngine } from "@comunica/query-sparql-rdfjs"
import { rdfStringToDataset, rdfStringToStore } from "./utils.js"
import Validator from "shacl-engine/Validator.js"
import rdf from "rdf-ext"
import { Writer as N3Writer } from "n3"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"

const DB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "db")
const DATAFIELDS = `${DB_DIR}/datafields.ttl`
const MATERIALIZATION = `${DB_DIR}/materialization.ttl`

/**
 * @param {string} userProfile
 * @param {string[]} requirementProfiles
 * @returns {Promise<string>}
 */
export async function validateAll(userProfile, requirementProfiles) {
    console.log(userProfile)
    console.log(requirementProfiles)

    return "report"
}

/**
 * @param {string} userProfile
 * @param {string} requirementProfile
 * @returns {Promise<string>}
 */
export async function validateOne(userProfile, requirementProfile) {
    let userProfileStore = await rdfStringToStore(userProfile)
    let userProfileDataset = rdf.dataset(userProfileStore.getQuads())
    let requirementProfileDataset = await rdfStringToDataset(requirementProfile)

    const validator = new Validator(requirementProfileDataset, { factory: rdf, debug: false })
    validator.validate({ dataset: userProfileDataset }).then(report => {
        let missings = []
        for (let result of report.results) {
            const comp = result.constraintComponent.value.split("#")[1]
            if (comp === "MinCountConstraintComponent") {
                let missingPredicate = result.path[0].predicates[0].id // can these two arrays be bigger than 1? TODO
                let fromSubject = result.focusNode.value
                missings.push({ subject: fromSubject, predicate: missingPredicate })
            }
        }

        const writer = new N3Writer({ prefixes: { sh: "http://www.w3.org/ns/shacl#", ff: "https://foerderfunke.org/default#" } });
        report.dataset.forEach(quad => writer.addQuad(quad))
        writer.end((error, result) => console.log(result));

        if (!missings.length) return

        fs.readFile(MATERIALIZATION, "utf8", (err, data) => {
            rdfStringToStore(data).then(materializationStore => {

                let missing = missings[0] // loop TODO

                let query = `
                    PREFIX ff: <https://foerderfunke.org/default#>
                    SELECT * WHERE {
                        ?rule ff:input ?input .
                        ?rule ff:output <${missing.predicate}> .
                        ?rule ff:sparqlConstructQuery ?query .
                    }
                `
                runSparqlSelectQueryOnStore(query, materializationStore).then(results => {
                    console.log("materialization query results", results)

                    // ...
                })
            })
        })
    })

    return "" // TODO
}

/**
 * @param {string} query
 * @param {string} rdfStr
 * @returns {Promise<Object[]>}
 */
export async function runSparqlSelectQueryOnRdfString(query, rdfStr) {
    let store = await rdfStringToStore(rdfStr)
    return runSparqlSelectQueryOnStore(query, store)
}

export async function runSparqlSelectQueryOnStore(query, store) {
    const queryEngine = new QueryEngine()
    let bindingsStream = await queryEngine.queryBindings(query, { sources: [ store ] })
    let bindings = await bindingsStream.toArray()
    let results = []
    bindings.forEach(binding => {
        const variables = Array.from(binding.keys()).map(({ value }) => value)
        let row = {}
        variables.forEach(variable => {
            row[variable] = binding.get(variable).value
        })
        results.push(row)
    });
    return results
}

export async function runSparqlConstructQueryOnRdfString(query, rdfStr) {
    let store = await rdfStringToStore(rdfStr)
    const queryEngine = new QueryEngine()
    let quadsStream = await queryEngine.queryQuads(query, { sources: [ store ] })
    return await quadsStream.toArray()
}
