import { rdfStringsToStore, runSparqlSelectQueryOnStore } from "./utils.js"

function uri(uri, shorten) {
    return shorten ? "ff:" + uri.split("#")[1] : uri
}

export async function getBenefitCategories(datafieldsStr, reqProfilesStr, shortenUri = false) {
    let store = await rdfStringsToStore([datafieldsStr, ...reqProfilesStr])
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
        categories[uri(row.category, shortenUri)] = {
            de: row.de,
            en: row.en,
            requirementProfiles: []
        }
    }
    query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        SELECT * WHERE {
            ?rq a ff:RequirementProfile .
            ?rq ff:title ?de .
            FILTER (lang(?de) = "de")
            ?rq ff:title ?en .
            FILTER (lang(?en) = "en")
            ?rq ff:category ?category .               
        }`
    rows = await runSparqlSelectQueryOnStore(query, store)
    console.log(rows)
    for (let row of rows) {
        let rqUri = uri(row.rq, shortenUri)
        let categoryUri = uri(row.category, shortenUri)
        categories[categoryUri].requirementProfiles.push(rqUri)
        if (!requirementProfiles[rqUri]) {
            requirementProfiles[rqUri] = {
                de: row.de,
                en: row.en,
                categories: []
            }
        }
        requirementProfiles[rqUri].categories.push(categoryUri)
    }
    return {
        "byCategories": categories,
        "byRequirementProfiles": requirementProfiles
    }
}
