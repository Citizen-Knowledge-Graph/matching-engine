import { QueryEngine } from "@comunica/query-sparql-rdfjs"
import { rdfStringToStore } from "./utils.js"

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
