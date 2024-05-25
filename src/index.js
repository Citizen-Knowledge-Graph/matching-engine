import {
    addRdfStringToStore,
    extractRpUriFromRpString,
    printDatasetAsTurtle,
    printStoreAsTurtle,
    quadToSpo,
    storeContainsTriple,
    runSparqlAskQueryOnStore,
    runSparqlConstructQueryOnStore,
    runSparqlDeleteQueryOnStore,
    runSparqlSelectQueryOnStore,
    runValidationOnStore
} from "./utils.js"
import { Store } from "n3"

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

    return {
        conforms: report.conforms,
        violations: collectViolations(report, false)
    }
}

export async function checkUserProfileForMaterializations(userProfileStr, materializationStr) {
    let store = new Store()
    await addRdfStringToStore(userProfileStr, store)
    await addRdfStringToStore(materializationStr, store)
    return await applyMaterializationRules(store)
}

export async function inferNewUserDataFromCompliedRPs(userProfileStr, requirementProfileStr) {
    let store = new Store()
    await addRdfStringToStore(userProfileStr, store)
    await addRdfStringToStore(requirementProfileStr, store)
    // this is super limited for now, must support a lot more SHACL patterns TODO
    let query= `
        PREFIX ff: <https://foerderfunke.org/default#>
        PREFIX sh: <http://www.w3.org/ns/shacl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        SELECT * WHERE {
            ?mainPersonShape sh:targetClass ff:Citizen . # TODO: support other targetClasses
            ?mainPersonShape sh:property ?propertyShape .
            ?propertyShape sh:path ?predicate .
            OPTIONAL {
                ?propertyShape sh:in ?shIn .
                ?shIn rdf:rest*/rdf:first ?value . # TODO: support multiple values
            }
        }`
    let rows = await runSparqlSelectQueryOnStore(query, store)
    let report = {
        inferred: []
    }
    for (let row of rows) {
        let triple = {
            subject: "https://foerderfunke.org/default#mainPerson",
            predicate: row.predicate,
            object: row.value
        }
        if (!storeContainsTriple(store, triple)) report.inferred.push(triple)
    }
    return report
}

export async function validateAll(userProfileStr, requirementProfiles, datafieldsStr, materializationStr, debug = false) {
    let map = {
        reports: [],
        missingUserInputsAggregated: {}
    }
    for (let reqProfileStr of Object.values(requirementProfiles)) {
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
    await addRdfStringToStore(datafieldsStr, store) // this is not needed anymore? could be useful for materializations using similarTo/sameAs-datafields

    // ----- first validation to identify violations  -----
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
            materializationReport: {}
        }
    }

    // ----- collect missing data points -----
    let missingList = {}
    for (let result of firstReport.results) {
        const comp = result.constraintComponent.value.split("#")[1]
        if (comp === "MinCountConstraintComponent" || comp === "QualifiedMinCountConstraintComponent") {
            let missingPredicate = result.path[0].predicates[0].id // can these two arrays be bigger than 1?
            let fromSubject = result.focusNode.value
            let message = result.message[0].value // can the arrays be bigger than 1?
            // can there be more than one per s_p, and it should be an array then?
            missingList[fromSubject + "_" + missingPredicate] = {
                subject: fromSubject,
                dfUri: missingPredicate, // predicate
                optional: message.toLowerCase().includes("[optional]") // a better way to check for this?
            }
        }
    }

    // ----- apply materialization rules again and again until none applies anymore -----
    // some missing data points can maybe be materialized without asking the user
    // materialization rules can come from the requirement profile, or from the materialization.ttl that has common materialization rules (a bit like utils functions)
    // only add those to the store, that are actually missing as identified above
    let materializationReport = await applyMaterializationRules(store, missingList)

    missingList = Object.values(missingList)
    let optionals = missingList.filter(missing => missing.optional)
    let blockers = missingList.filter(missing => !missing.optional)

    // ----- missing data points that are optional, don't stop the workflow -----
    if (debug && optionals.length > 0)
        console.log("Optional data points missing:", optionals)

    // ----- mandatory missing data points stop the workflow, it makes no sense to continue -----
    if (blockers.length > 0) {
        if (debug) console.log("Mandatory data points missing:", blockers)
        return {
            result: ValidationResult.UNDETERMINABLE,
            violations: [],
            missingUserInput: missingList,
            materializationReport: materializationReport
        }
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
        console.log("Third validation report:")
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
        missingUserInput: missingList,
        materializationReport: materializationReport
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

async function applyMaterializationRules(store, missingList = null) {
    let materializationRules = await runSparqlSelectQueryOnStore(`
        PREFIX ff: <https://foerderfunke.org/default#>
        SELECT * WHERE {
            ?uri ff:sparqlConstructQuery ?query .
            OPTIONAL { ?uri ff:input ?input . }
            OPTIONAL { ?uri ff:output ?output . }
        }`, store)

    let materializationReport = { rounds: [] }
    let rulesAppliedCount = 1
    let spPairs = []
    while (rulesAppliedCount > 0) {
        let rulesApplied = {} // rules applied this round
        for (let rule of materializationRules) {
            let constructedQuads = await runSparqlConstructQueryOnStore(rule.query, store)
            for (let quad of constructedQuads) {
                let spo = quadToSpo(quad)
                let spPair = spo.s + "_" + spo.p
                if ((missingList && !missingList[spPair]) || store.has(quad)) continue
                store.getQuads(quad.subject, quad.predicate, null).forEach(q => {
                    store.delete(q)
                    if (!spo.overwrote) spo.overwrote = []
                    spo.overwrote.push(quadToSpo(q))
                })
                if (!rulesApplied[rule.uri]) rulesApplied[rule.uri] = []
                store.addQuad(quad)
                rulesApplied[rule.uri].push(spo)
                if (rule.input) rulesApplied[rule.uri].input = rule.input
                if (rule.output) rulesApplied[rule.uri].output = rule.output
                spPairs.push(spPair)
            }
        }
        rulesAppliedCount = Object.keys(rulesApplied).length
        if (rulesAppliedCount > 0) materializationReport.rounds.push(rulesApplied)
    }
    if (missingList) {
        for (let spPair of spPairs) delete missingList[spPair]
    }
    return materializationReport
}
