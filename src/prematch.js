import { rdfStringsToStore, runSparqlSelectQueryOnStore } from "./utils.js"

function shortenUri(uri, shorten) {
    return shorten ? "ff:" + uri.split("#")[1] : uri
}

export async function getBenefitCategories(datafieldsStr, reqProfilesStrArr, doShortenUri = false) {
    let store = await rdfStringsToStore([datafieldsStr, ...reqProfilesStrArr])
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
