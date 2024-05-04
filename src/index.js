import {
    addRdfStringToStore, extractRpUriFromRpString,
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

export const ValidationResult = {
    ELIGIBLE: "eligible",
    INELIGIBLE: "ineligible",
    UNDETERMINABLE: "undeterminable"
}

export async function validateUserProfile(userProfile, datafieldsStr, debug = false) {
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

    if (debug) printDatasetAsTurtle(report.dataset)
    return report.conforms
}

export async function validateAll(userProfileStr, requirementProfiles, datafieldsStr, materializationStr, debug = false) {
    let map = {
        reports: [],
        missingUserInputsAggregated: {}
    }
    for (let [filename, reqProfileStr] of Object.entries(requirementProfiles)) {
        let rpUri = await extractRpUriFromRpString(reqProfileStr)
        let report = await validateOne(userProfileStr, reqProfileStr, datafieldsStr, materializationStr, debug)
        report.rpUri = rpUri
        map.reports.push(report)
        for (let userInput of report.missingUserInput) {
            let key = userInput.subject + "_" + userInput.dfUri
            if (!map.missingUserInputsAggregated[key]) {
                map.missingUserInputsAggregated[key] = {
                    subject: userInput.subject,
                    dfUri: userInput.dfUri,
                    usedIn: []
                }
            }
            map.missingUserInputsAggregated[key].usedIn.push({
                rpUri: rpUri,
                optional: userInput.optional,
                isLastMissingUserInput: report.missingUserInput.length === 1
            })
        }
    }
    return map
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

    // ignore HasValueConstraintComponent if they have an equivalent MinCountConstraintComponent?
    // the problem of them both occurring can be avoided by using e.g. "sh:in (true)" instead of "sh:hasValue true", not sure that's the best solution though
    let violations = collectViolations(firstReport, true)
    if (violations.length > 0) {
        return {
            result: ValidationResult.INELIGIBLE,
            violations: violations,
            missingUserInput: [],
            inMemoryMaterializedTriples: []
        }
    }

    let missingList = []
    for (let result of firstReport.results) {
        const comp = result.constraintComponent.value.split("#")[1]
        if (comp === "MinCountConstraintComponent" || comp === "QualifiedMinCountConstraintComponent") {
            let missingPredicate = result.path[0].predicates[0].id // can these two arrays be bigger than 1?
            let fromSubject = result.focusNode.value
            let message = result.message[0].value // can the arrays be bigger than 1?
            missingList.push({
                subject: fromSubject,
                dfUri: missingPredicate, // predicate
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
                FILTER(?output = <${missing.dfUri}>) .
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
    // we should tell the user that for instance either hasAge (rule output) or hasBirthday (rule input) is missing TODO

    // get all predicates directly attached to mainPerson, this is one-dimensional TODO
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        SELECT DISTINCT ?predicate WHERE {
            ff:mainPerson ?predicate ?object .
        }`
    let result = await runSparqlSelectQueryOnStore(query, store)
    let existingMainPersonPredicates = result.map(n => n.predicate)

    for (let missing of missingList) {
        let matchingRule = materializableDataPoints.find(n => n.output === missing.dfUri)
        let otherRuleWithThatInputAsOutput = undefined
        if (matchingRule && matchingRule.input) {
            otherRuleWithThatInputAsOutput = materializableDataPoints.find(n => n.output === matchingRule.input)
        }
        // quite annoying to check all these options, maybe another approach also removing the need for topological sorting? TODO
        // I am thinking of rounds of materialization: in each we look what's possible, and we do it until no rule triggers anymore
        if (matchingRule && (!matchingRule.input || otherRuleWithThatInputAsOutput || existingMainPersonPredicates.includes(matchingRule.input))) continue
        askUserForDataPoints.push(missing)
    }

    let optionals = askUserForDataPoints.filter(missing => missing.optional)
    let blockers = askUserForDataPoints.filter(missing => !missing.optional)

    // ----- missing data points that are optional, don't stop the workflow -----
    if (debug && optionals.length > 0)
        console.log("Optional data points missing:", optionals)

    // ----- mandatory missing data points stop the workflow, it makes no sense to continue -----
    if (blockers.length > 0) {
        if (debug) console.log("Mandatory data points missing:", blockers)
        return {
            result: ValidationResult.UNDETERMINABLE,
            violations: [],
            missingUserInput: askUserForDataPoints,
            inMemoryMaterializedTriples: []
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

    let constructedQuads = []
    for (let rule of sorted.slice(1)) {
        let query = materializableDataPointsMap[rule].query
        constructedQuads = await runSparqlConstructQueryOnStore(query, store)
        store.addQuads(constructedQuads)
    }

    let materializedTriples = [] // include permanent materialization and period check prompt? TODO
    for (let quad of constructedQuads) {
        materializedTriples.push({ s: quad.subject.value, p: quad.predicate.value, o: quad.object.value })
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
                ?propertyShape sh:path <${optional.dfUri}> .
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

    // If we are here, data points can't be missing anymore. But the materialized ones can
    // be having values that are outside the allowed range. These wouldn't have showed up in
    // the first validation report because the data points were not materialized there yet.

    // render list of conditions
    // use debug SHACL or SPARQL for a summary in the end with reasoning/calculations?
    // rdf-star for timestamping triples?
    // versioning?
    // ask user about suggestPermanentMaterialization

    return {
        result: secondReport.conforms ? ValidationResult.ELIGIBLE : ValidationResult.INELIGIBLE,
        violations: collectViolations(secondReport, false),
        missingUserInput: askUserForDataPoints,
        inMemoryMaterializedTriples: materializedTriples
    }
}

function collectViolations(report, skipMinCountAndNode) {
    let violations = []
    for (let result of report.results) {
        const comp = result.constraintComponent.value.split("#")[1]
        if (skipMinCountAndNode && (comp === "MinCountConstraintComponent" || comp === "QualifiedMinCountConstraintComponent" || comp === "NodeConstraintComponent")) continue
        violations.push({
            constraint: result.constraintComponent.value,
            focusNode: result.focusNode?.value ?? "",
            path: result.path?.[0]?.predicates?.[0]?.value ?? "",
            violatingValue: result.args?.hasValue?.id ?? "",
            message: result.message?.[0]?.value ?? ""
        })
    }
    return violations
}
