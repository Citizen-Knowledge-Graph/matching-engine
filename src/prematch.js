import {
    convertReqProfilesStrArrToMap,
    rdfStringsToStore,
    rdfStringToStore,
    runSparqlSelectQueryOnStore
} from "./utils.js"
import { validateAll } from "./index.js";

function shortenUri(uri, shorten = true) {
    if (uri.startsWith("ff:")) return uri
    return shorten ? "ff:" + uri.split("#")[1] : uri
}

function expandUri(uri) {
    return uri.startsWith("ff:") ? "https://foerderfunke.org/default#" + uri.split(":")[1] : uri
}

export async function getBenefitCategories(datafieldsStr, reqProfileStrArr, doShortenUri = false) {
    let store = await rdfStringsToStore([datafieldsStr, ...reqProfileStrArr])
    let categories = {}
    let requirementProfiles = {}
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        SELECT * WHERE {
            ?category a ff:BenefitCategory .
            ?category rdfs:label ?de .
            FILTER (lang(?de) = "de")
            ?category rdfs:label ?en .
            FILTER (lang(?en) = "en")                    
        }`
    let rows = await runSparqlSelectQueryOnStore(query, store)
    for (let row of rows) {
        categories[shortenUri(row.category, doShortenUri)] = {
            de: row.de,
            en: row.en,
            requirementProfiles: []
        }
    }
    query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        SELECT * WHERE {
            ?rp a ff:RequirementProfile .
            ?rp ff:title ?de .
            FILTER (lang(?de) = "de")
            ?rp ff:title ?en .
            FILTER (lang(?en) = "en")
            ?rp ff:category ?category .               
        }`
    rows = await runSparqlSelectQueryOnStore(query, store)
    for (let row of rows) {
        let rpUri = shortenUri(row.rp, doShortenUri)
        let categoryUri = shortenUri(row.category, doShortenUri)
        categories[categoryUri].requirementProfiles.push(rpUri)
        if (!requirementProfiles[rpUri]) {
            requirementProfiles[rpUri] = {
                de: row.de,
                en: row.en,
                categories: []
            }
        }
        requirementProfiles[rpUri].categories.push(categoryUri)
    }
    return {
        "byCategories": categories,
        "byRequirementProfiles": requirementProfiles
    }
}

export async function getPrioritizedMissingDataFieldsJson(selectedBenefitCategories = [], selectedBenefits = [], userProfileStr, datafieldsStr, reqProfileStrArr, materializationStr, lang = "en") {
    let store = await rdfStringsToStore([userProfileStr, datafieldsStr, ...reqProfileStrArr, materializationStr])
    if (!userProfileStr) {
        userProfileStr = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen .`
    }
    let rpIDsInFocus = selectedBenefits.map(id => expandUri(id))
    if (selectedBenefitCategories.length > 0) {
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            SELECT DISTINCT ?rp WHERE {
                ?rp a ff:RequirementProfile .
                ?rp ff:category ?category .
                VALUES ?category { ${selectedBenefitCategories.map(id => shortenUri(id)).join(" ")} }
            }`
        let rows = await runSparqlSelectQueryOnStore(query, store)
        rpIDsInFocus = [...rpIDsInFocus, ...rows.map(row => row.rp)]
    }
    if (rpIDsInFocus.length === 0 && selectedBenefitCategories.length === 0) {
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            SELECT * WHERE { ?rp a ff:RequirementProfile . }`
        let rows = await runSparqlSelectQueryOnStore(query, store)
        rpIDsInFocus = rows.map(row => row.rp)
    }
    // list of requirement profiles is now fully determined

    let rpMapAll = convertReqProfilesStrArrToMap(reqProfileStrArr)
    let rpMapInFocus = {}
    for (let rpId of rpIDsInFocus) {
        rpMapInFocus[rpId] = rpMapAll[rpId]
    }

    let report = await validateAll(userProfileStr, rpMapInFocus, datafieldsStr, materializationStr)
    let sorted = Object.entries(report.missingUserInputsAggregated).sort((a, b) => b[1].usedIn.length - a[1].usedIn.length)
    let usedInCounts = {}
    // add sort option flag: by usedIn, by score, by category (non prioritized) TODO
    // find a way to score ff:kinder higher than kinder_unter_18 and kinder_18_25, because of the NoKidsImpliesNoKidsInAgeRanges rule TODO
    for (let [, df] of sorted) usedInCounts[df.dfUri] = df.usedIn.length
    let sortedUris = sorted.map(df => df[1].dfUri)
    let sortedUrisShortened = sorted.map(df => shortenUri(df[1].dfUri))

    // ff:pensionable will also show up here but is not in datafields.ttl
    let fieldsMap = await getDetailsAboutDfs(sortedUrisShortened, store, lang)
    for (let dfUri of Object.keys(fieldsMap)) {
        fieldsMap[dfUri].usedIn = usedInCounts[dfUri]
    }

    return {
        validationReport: report,
        prioritizedMissingDataFields: {
            "id": "quick-check-profile",
            "title": "About you",
            "fields": sortedUris.filter(uri => uri in fieldsMap).map(uri => fieldsMap[uri])
        }
    }
}

export async function getDetailsAboutDfs(shortenedDfUris = [], store, lang = "en") {
    let fieldsMap = {}
    // Query 1: get info about data fields and their datatype
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        PREFIX sh: <http://www.w3.org/ns/shacl#>
        SELECT * WHERE {
            ?df a ff:DataField .
            ${shortenedDfUris.length === 0 ? "" : "VALUES ?df { " + shortenedDfUris.join(" ") + " }" }
            ?df rdfs:label ?label .
            ?df schema:question ?question .
            FILTER (lang(?label) = "${lang}")
            FILTER (lang(?question) = "${lang}")
            OPTIONAL { 
                ?df rdfs:comment ?comment .
                FILTER (lang(?comment) = "${lang}")
            } .
            ?df ff:objectConstraints ?oConstraints .
            OPTIONAL { ?oConstraints sh:datatype ?datatype . }
            OPTIONAL { 
                ?df ff:usageConstraints ?uConstraints .
                ?uConstraints sh:property ?property .
                ?property sh:maxCount ?maxCount .
            }
        }`
    let rows = await runSparqlSelectQueryOnStore(query, store)
    for (let row of rows) {
        let field = {
            datafield: shortenUri(row.df),
            label: row.label,
            question: row.question,
            comment: row.comment ?? ""
        }
        if (row.datatype) {
            field.datatype = row.datatype.split("#")[1]
        } else {
            field.datatype = row.maxCount ? "selection" : "selection-multiple"
            field.choices = []
        }
        fieldsMap[row.df] = field
    }
    // Query 2: get choices for datafields that have selection as datatype
    query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        PREFIX sh: <http://www.w3.org/ns/shacl#>
        SELECT * WHERE {
            ?df a ff:DataField .
            ${shortenedDfUris.length === 0 ? "" : "VALUES ?df { " + shortenedDfUris.join(" ") + " }" }
            ?df ff:objectConstraints ?constraints .
            ?constraints sh:in/rdf:rest*/rdf:first ?option .
            ?option rdfs:label ?label .
            FILTER (lang(?label) = "${lang}")
        }`
    rows = await runSparqlSelectQueryOnStore(query, store)
    for (let row of rows) {
        fieldsMap[row.df].choices.push({
            "value": shortenUri(row.option),
            "label": row.label
        })
    }
    return fieldsMap
}

export async function transformRulesFromRequirementProfile(reqProfileStr,lang = "en") {
    let store = await rdfStringToStore(reqProfileStr)
    let rules = {
        existence: [],
        valueIn: {},
        valueNotIn: {},
        or: []
    }
    // Existence
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        PREFIX sh: <http://www.w3.org/ns/shacl#>
        SELECT ?path WHERE {
            ff:MainPersonShape sh:property ?property .
            ?property sh:path ?path .
            ?property sh:minCount 1 .
            FILTER NOT EXISTS { ?property sh:in ?in }
            FILTER NOT EXISTS { ?property sh:not ?not }
        }`
    let rows = await runSparqlSelectQueryOnStore(query, store)
    for (let row of rows) {
        rules.existence.push(row.path)
    }
    // In
    query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        PREFIX sh: <http://www.w3.org/ns/shacl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        SELECT * WHERE {
            ff:MainPersonShape sh:property ?property .
            ?property sh:path ?path .
            ?property sh:in/rdf:rest*/rdf:first ?value .
        }`
    rows = await runSparqlSelectQueryOnStore(query, store)
    for (let row of rows) {
        (rules.valueIn[row.path] ??= []).push(row.value);
    }
    // Not In
    query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        PREFIX sh: <http://www.w3.org/ns/shacl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        SELECT ?path ?value WHERE {
            ff:MainPersonShape sh:property ?property .
            ?property sh:path ?path .
            ?property sh:not ?not .
            ?not sh:in/rdf:rest*/rdf:first ?value .
        }`
    rows = await runSparqlSelectQueryOnStore(query, store)
    for (let row of rows) {
        (rules.valueNotIn[row.path] ??= []).push(row.value);
    }

    // Or
    // This has to be properly implemented later on, maybe recursively somehow? TODO
    // - It doesn't work anymore if there is anything else than sh:in in the or-blocks
    // - It can only process one or-block per rp
    query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        PREFIX sh: <http://www.w3.org/ns/shacl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        SELECT ?path ?value WHERE {
            ff:MainPersonShape sh:or/rdf:rest*/rdf:first ?or .
            ?or sh:property ?property .
            ?property sh:path ?path .
            ?property sh:in/rdf:rest*/rdf:first ?value .        
        }`
    rows = await runSparqlSelectQueryOnStore(query, store)
    let oneOrPerRP = [] // TODO
    for (let row of rows) {
        oneOrPerRP.push({
            path: row.path,
            valueIn: [row.value]
        })
    }
    rules.or.push(oneOrPerRP)
    return rules
}
