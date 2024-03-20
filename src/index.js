import { QueryEngine } from "@comunica/query-sparql-rdfjs"
import { addRdfStringToStore, printDatasetAsTurtle, rdfStringToStore, runValidationOnStore } from "./utils.js"
import { Store } from "n3"
import path from "path"
import { fileURLToPath } from "url"
import { promises as fsPromise } from "fs"
import toposort from "toposort"


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
    return "TODO"
}

/**
 * @param {string} userProfile
 * @param {string} requirementProfile
 * @returns {Promise<string>}
 */
export async function validateOne(userProfile, requirementProfile) {
    let store = new Store()
    await addRdfStringToStore(userProfile, store)
    await addRdfStringToStore(requirementProfile, store)
    await fsPromise.readFile(MATERIALIZATION, "utf8").then(rdfStr => addRdfStringToStore(rdfStr, store))

    let report = await runValidationOnStore(store)
    printDatasetAsTurtle(report.dataset)

    let missingList = []
    for (let result of report.results) {
        const comp = result.constraintComponent.value.split("#")[1]
        if (comp === "MinCountConstraintComponent") {
            let missingPredicate = result.path[0].predicates[0].id // can these two arrays be bigger than 1? TODO
            let fromSubject = result.focusNode.value
            missingList.push({ subject: fromSubject, predicate: missingPredicate })
        }
    }

    let nodesMap = {}
    nodesMap["root"] = { rule: "root" }

    for (let missing of missingList) {
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            SELECT * WHERE {
                ?rule ff:output ?output .
                FILTER(?output = <${missing.predicate}>) .
                ?rule ff:sparqlConstructQuery ?query .
                OPTIONAL { ?rule ff:input ?input . }
            }
        `
        let node = (await runSparqlSelectQueryOnStore(query, store))[0]
        nodesMap[node.rule] = node
    }

    let nodes = Object.values(nodesMap)
    let edges = []

    for (let node of nodes) {
        let requiresInputFromThis = nodes.find(n => node !== n && n.output === node.input)
        if (requiresInputFromThis) {
            edges.push([requiresInputFromThis.rule, node.rule])
        } else if (node.rule !== "root") {
            edges.push(["root", node.rule])
        }
    }

    const sorted = toposort(edges) // topological sort to get legal execution order
    console.log(sorted)

    for (let rule of sorted.slice(1)) {
        let query = nodesMap[rule].query
        let constructed = await runSparqlConstructQueryOnStore(query, store)
        store.addQuads(constructed)
        // interim-store those that have suggestPermanentMaterialization set to true and ask user at the end TODO
    }

    // printDatasetAsTurtle(rdf.dataset(store.getQuads()))

    report = await runValidationOnStore(store)
    printDatasetAsTurtle(report.dataset)

    return ""
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
    })
    return results
}

export async function runSparqlConstructQueryOnRdfString(query, rdfStr) {
    let store = await rdfStringToStore(rdfStr)
    return runSparqlConstructQueryOnStore(query, store)
}

export async function runSparqlConstructQueryOnStore(query, store) {
    const queryEngine = new QueryEngine()
    let quadsStream = await queryEngine.queryQuads(query, { sources: [ store ] })
    return await quadsStream.toArray()
}
