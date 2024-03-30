import {
    addRdfStringToStore,
    printDatasetAsTurtle,
    printStoreAsTurtle,
    runSparqlAskQueryOnStore,
    runSparqlConstructQueryOnStore,
    runSparqlDeleteQueryOnStore,
    runSparqlSelectQueryOnStore,
    runValidationOnStore
} from "./utils.js"
import { Store } from "n3"
import toposort from "toposort"

export async function validateUserProfile(userProfile, datafieldsStr) {
    let store = new Store()
    await addRdfStringToStore(userProfile, store)
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        ASK { ff:mainPerson a ff:Citizen . }
    `
    // otherwise, a completely empty user profile would be valid
    if (!await runSparqlAskQueryOnStore(query, store))
        return "User profile does not contain the base triple of <<ff:mainPerson a ff:Citizen>>"

    await addRdfStringToStore(datafieldsStr, store)

    let report = await runValidationOnStore(store)

    printDatasetAsTurtle(report.dataset)
    return report.conforms
}

export async function validateAll(userProfile, requirementProfiles, datafieldsStr, materializationStr, debug = false) {
    let report = []
    for (let [filename, profile] of Object.entries(requirementProfiles)) {
        let validation = await validateOne(userProfile, profile, datafieldsStr, materializationStr, debug)
        report.push({ filename: filename, validation: validation })
    }
    return report
}

export async function validateOne(userProfile, requirementProfile, datafieldsStr, materializationStr, debug = false) {

    // ----- build up store -----
    let store = new Store()
    await addRdfStringToStore(userProfile, store)
    await addRdfStringToStore(requirementProfile, store)
    await addRdfStringToStore(materializationStr, store)
    await addRdfStringToStore(datafieldsStr, store)

    // ----- first validation to identify missing data points  -----
    let firstReport = await runValidationOnStore(store)
    if (debug) {
        console.log("First validation report:")
        printDatasetAsTurtle(firstReport.dataset)
    }

    let missingList = []
    for (let result of firstReport.results) {
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

    // ----- which of the missing data points can we materialize ourselves without asking the user -----
    // materialization rules can come from the requirement profile, or from the materialization.ttl that has common materialization rules (a bit like utils functions)
    let materializableDataPointsMap = {}
    materializableDataPointsMap["root"] = { rule: "root" }

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
        let resultLine = (await runSparqlSelectQueryOnStore(query, store))[0]
        if (resultLine) materializableDataPointsMap[resultLine.rule] = resultLine
    }

    let materializableDataPoints = Object.values(materializableDataPointsMap)
    let askUserForDataPoints = []

    // ----- for the ones we can't materialize we need user input -----
    for (let missing of missingList) {
        if (materializableDataPoints.find(n => n.output === missing.predicate)) continue
        askUserForDataPoints.push(missing)
    }

    // ----- enrich the ones we'll ask for with labels -----
    for (let dataPoint of askUserForDataPoints) {
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT * WHERE {
                ?predicate a ff:DataField .
                FILTER(?predicate = <${dataPoint.predicate}>) .
                ?predicate rdfs:label ?label .
            }
        `
        let resultLine = (await runSparqlSelectQueryOnStore(query, store))[0]
        if (resultLine) dataPoint.label = resultLine.label
    }

    let optionals = askUserForDataPoints.filter(missing => missing.optional)
    let blockers = askUserForDataPoints.filter(missing => !missing.optional)

    // ----- missing data points that are optional, don't stop the workflow -----
    if (optionals.length > 0 && debug)
        console.log("Optional data points missing:", optionals)

    // ----- mandatory missing data points stop the workflow, it makes no sense to continue -----
    if (blockers.length > 0) {
        return {
            conforms: false,
            report: firstReport,
            blockers: blockers,
            optionals: optionals
        }
    }

    // ----- use the input/output declarations of the materialization rules to determine a correct materialization order -----
    // extracting input/output could potentially be done automatically by parsing the SPARQL query and extracting the variables?
    let edges = []
    for (let node of materializableDataPoints) {
        let requiresInputFromThis = materializableDataPoints.find(n => node !== n && n.output === node.input)
        if (requiresInputFromThis) {
            edges.push([requiresInputFromThis.rule, node.rule])
        } else if (node.rule !== "root") {
            edges.push(["root", node.rule])
        }
    }

    const sorted = toposort(edges) // topological sort to get legal execution order
    if (debug) console.log("Topologically sorted materialization rules", sorted)

    // ----- apply the materialization rules in the correct order -----
    for (let rule of sorted.slice(1)) {
        let query = materializableDataPointsMap[rule].query
        let constructed = await runSparqlConstructQueryOnStore(query, store)
        store.addQuads(constructed)
    }

    // ----- remove the minCount constraint from optional conditions so that they won't cause the validation to fail again -----
    for (let optional of optionals) {
        let query = `
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

    if (debug) {
        console.log("Store after applying materialization rules and removing sh:minCount from optionals:")
        printStoreAsTurtle(store)
    }

    // ----- no more missing mandatory data points: re-run the validation -----
    // now the existence of the mandatory data points is guaranteed - "only" their values can now cause the validation to fail
    let secondReport = await runValidationOnStore(store)
    if (debug) {
        console.log("Second validation report:")
        printDatasetAsTurtle(secondReport.dataset)
    }

    // render list of conditions
    // use debug SHACL or SPARQL for a summary in the end with reasoning/calculations?
    // rdf-star for timestamping triples?
    // versioning?
    // ask user about suggestPermanentMaterialization

    return {
        conforms: secondReport.conforms,
        report: secondReport
    }
}
