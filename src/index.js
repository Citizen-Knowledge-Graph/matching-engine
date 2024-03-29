import {
    addRdfStringToStore,
    printDatasetAsTurtle,
    runSparqlAskQueryOnStore,
    runSparqlConstructQueryOnStore,
    runSparqlDeleteQueryOnStore,
    runSparqlSelectQueryOnStore,
    runValidationOnStore
} from "./utils.js"
import { Store } from "n3"
import path from "path"
import { fileURLToPath } from "url"
import { promises as fsPromise } from "fs"
import toposort from "toposort"

const DB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "db")
const DATAFIELDS = `${DB_DIR}/datafields.ttl`
const MATERIALIZATION = `${DB_DIR}/materialization.ttl`

export async function validateUserProfile(userProfile) {
    let store = new Store()
    await addRdfStringToStore(userProfile, store)
    let datafields = await fsPromise.readFile(DATAFIELDS, "utf8")
    await addRdfStringToStore(datafields, store)

    let report = await runValidationOnStore(store)

    printDatasetAsTurtle(report.dataset)
    return report.conforms
}

export async function validateAll(userProfile, requirementProfiles) {
    console.log(userProfile)
    console.log(requirementProfiles)
    return "TODO"
}

export async function validateOne(userProfile, requirementProfile) {
    let store = new Store()
    await addRdfStringToStore(userProfile, store)
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        ASK { ff:mainPerson a ff:Citizen . }
    `
    // otherwise, a completely empty user profile would be valid
    if (!await runSparqlAskQueryOnStore(query, store))
        return "User profile does not contain the base triple of <<ff:mainPerson a ff:Citizen>>"

    await addRdfStringToStore(requirementProfile, store)
    await fsPromise.readFile(MATERIALIZATION, "utf8").then(rdfStr => addRdfStringToStore(rdfStr, store))

    let report = await runValidationOnStore(store)
    printDatasetAsTurtle(report.dataset)

    let missingList = []
    for (let result of report.results) {
        const comp = result.constraintComponent.value.split("#")[1]
        if (comp === "MinCountConstraintComponent") {
            let missingPredicate = result.path[0].predicates[0].id // can these two arrays be bigger than 1?
            let fromSubject = result.focusNode.value
            let message = result.message[0].value // can the arrays be bigger than 1?
            missingList.push({
                subject: fromSubject,
                predicate: missingPredicate,
                optional: message.toLowerCase().includes("[optional]") // a better way to check for this?
            })
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
        if (node) nodesMap[node.rule] = node
    }

    let nodes = Object.values(nodesMap)
    let edges = []

    let blockers = []
    let optionals = []
    for (let missing of missingList) {
        if (nodes.find(n => n.output === missing.predicate)) continue
        if (missing.optional) {
            optionals.push(missing)
        } else {
            blockers.push(missing)
        }
    }

    if (optionals.length > 0)
        console.log("Optional data points missing:", optionals)

    if (blockers.length > 0)
        return "Missing data points: " + JSON.stringify(blockers)

    // handle user flow of asking for missing required and optional data points TODO

    // extracting input/output could potentially be done automatically by parsing the SPARQL query and extracting the variables?

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

    for (let optional of optionals) {
        query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            PREFIX sh: <http://www.w3.org/ns/shacl#>
            DELETE { 
                ?propertyShape sh:minCount ?obj .
            } WHERE {
                ?shape a sh:NodeShape .
                FILTER(?shape = ff:MainPersonShape) .
                ?shape sh:property ?propertyShape .
                ?propertyShape sh:path <${optional.predicate}> .
                ?propertyShape ?pred ?obj .
            }
        ` // can this query be simplified?
        await runSparqlDeleteQueryOnStore(query, store)
    }

    // printDatasetAsTurtle(rdf.dataset(store.getQuads()))

    report = await runValidationOnStore(store)
    printDatasetAsTurtle(report.dataset)

    // render list of conditions
    // use debug SHACL or SPARQL for a summary in the end with reasoning/calculations?
    // rdf-star for timestamping triples?
    // versioning?

    return ""
}
