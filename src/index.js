import { QueryEngine } from "@comunica/query-sparql-rdfjs"
import { rdfStringToDataset, rdfStringToStore } from "./utils.js"
import Validator from "shacl-engine/Validator.js"
import rdf from "rdf-ext"
import { Writer as N3Writer } from "n3"

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
    rdfStringToDataset(userProfile).then(userProfileDataset => {
        rdfStringToDataset(requirementProfile).then(requirementProfileDataset => {
            const validator = new Validator(requirementProfileDataset, { factory: rdf, debug: true })
            validator.validate({ dataset: userProfileDataset }).then(report => {

                const writer = new N3Writer({ prefixes: { sh: "http://www.w3.org/ns/shacl#", ff: "https://foerderfunke.org/default#" } });
                report.dataset.forEach(quad => writer.addQuad(quad))
                writer.end((error, result) => console.log(result));

                // for (let result of report.results) {}
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
export async function runSPARQLQueryOnRdfString(query, rdfStr) {
    let store = await rdfStringToStore(rdfStr)
    const queryEngine = new QueryEngine();
    await queryEngine.invalidateHttpCache();
    let bindingsStream = await queryEngine.queryBindings(query, { sources: [ store ] })
    let bindings = await bindingsStream.toArray()
    let resultTable = []
    bindings.forEach(binding => {
        const variables = Array.from(binding.keys()).map(({ value }) => value)
        let row = {}
        variables.forEach(variable => {
            row[variable] = binding.get(variable).value
        })
        resultTable.push(row)
    });
    return resultTable
}
