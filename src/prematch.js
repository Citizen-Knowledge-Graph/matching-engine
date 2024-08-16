import { convertReqProfilesStrArrToMap, rdfStringsToStore, runSparqlSelectQueryOnStore } from "./utils.js"
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

export async function getPrioritizedMissingDataFieldsJson(selectedBenefitCategories = [], selectedBenefits = [], userProfileStr, datafieldsStr, reqProfileStrArr, materializationStr, lang = "de") {
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
    for (let [, df] of sorted) usedInCounts[df.dfUri] = df.usedIn.length
    let sortedUris = sorted.map(df => df[1].dfUri)
    let sortedUrisShortened = sorted.map(df => shortenUri(df[1].dfUri))

    let fieldsMap = {}

    // Query 1: get info about data fields and their datatype
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        PREFIX sh: <http://www.w3.org/ns/shacl#>
        SELECT * WHERE {
            ?df a ff:DataField .
            # ff:pensionable will also show up here but is not in datafields.ttl
            VALUES ?df { ${sortedUrisShortened.join(" ")} }
            ?df rdfs:label ?title .
            ?df schema:question ?question .
            FILTER (lang(?title) = "${lang}")
            FILTER (lang(?question) = "${lang}")
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
            "datafield": shortenUri(row.df),
            "title": row.title,
            "question": row.question,
            "usedIn": usedInCounts[row.df]
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
            VALUES ?df { ${sortedUrisShortened.join(" ")} }
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

    return {
        validationReport: report,
        prioritizedMissingDataFields: {
            "id": "quick-check-profile",
            "title": "About you",
            "fields": sortedUris.filter(uri => uri in fieldsMap).map(uri => fieldsMap[uri])
        }
    }
}
