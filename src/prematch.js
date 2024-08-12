import { convertReqProfilesStrArrToMap, rdfStringsToStore, runSparqlSelectQueryOnStore } from "./utils.js"
import { validateAll } from "./index.js";

function shortenUri(uri, shorten = true) {
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

export async function getPrioritizedMissingDataFieldsJson(selectedBenefitCategories = [], selectedBenefits = [], userProfileStr, datafieldsStr, reqProfileStrArr, materializationStr) {
    let store = await rdfStringsToStore([userProfileStr, datafieldsStr, ...reqProfileStrArr, materializationStr])

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
            ?df rdfs:label ?titleDe .
            ?df rdfs:label ?titleEn .
            ?df schema:question ?questionDe .
            ?df schema:question ?questionEn .
            FILTER (lang(?titleDe) = "de")
            FILTER (lang(?titleEn) = "en")
            FILTER (lang(?questionDe) = "de")
            FILTER (lang(?questionEn) = "en")
            ?df ff:objectConstraints ?constraints .
            OPTIONAL { ?constraints sh:datatype ?datatype . }
        }`
    let rows = await runSparqlSelectQueryOnStore(query, store)
    for (let row of rows) {
        fieldsMap[row.df] = {
            "datafield": shortenUri(row.df),
            "titleDe": row.titleDe,
            "titleEn": row.titleEn,
            "questionDe": row.questionDe,
            "questionEn": row.questionEn,
            "datatype": row.datatype ? row.datatype.split("#")[1] : "selection",
        }
        if (!row.datatype) fieldsMap[row.df].choices = []
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
            ?option rdfs:label ?labelDe .
            ?option rdfs:label ?labelEn .
            FILTER (lang(?labelDe) = "de")
            FILTER (lang(?labelEn) = "en")
        }`
    rows = await runSparqlSelectQueryOnStore(query, store)
    for (let row of rows) {
        fieldsMap[row.df].choices.push({
            "value": shortenUri(row.option),
            "labelDe": row.labelDe,
            "labelEn": row.labelEn
        })
    }

    return {
        "id": "quick-check-profile",
        "title": "About you",
        "fields": sortedUris.map(uri => fieldsMap[uri])
    }
}
