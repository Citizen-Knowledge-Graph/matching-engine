import { getDetailsAboutDfs } from "./prematch.js"
import { rdfStringsToStore, rdfStringToStore, runSparqlSelectQueryOnStore } from "./utils.js"

export async function extractRequirementProfilesMetadata(requirementProfileStrings, lang) {
    let store = await rdfStringsToStore(requirementProfileStrings)
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        SELECT * WHERE {
            ?rpUri a ff:RequirementProfile .
            OPTIONAL { 
                ?rpUri ff:title ?title .
                FILTER (lang(?title) = "${lang}")
            } .
            OPTIONAL { ?rpUri ff:leikaId ?leikaId } .
            OPTIONAL { ?rpUri ff:category ?category } .
            OPTIONAL { ?rpUri rdfs:seeAlso ?seeAlso } .
            OPTIONAL { ?rpUri ff:validationStage ?validationStage } .
            OPTIONAL { 
                ?rpUri ff:benefitInfo ?benefitInfo .
                FILTER (lang(?benefitInfo) = "${lang}")
            } .
            OPTIONAL { 
                ?rpUri ff:ineligibleGeneralExplanation ?ineligibleGeneralExplanation .
                FILTER (lang(?ineligibleGeneralExplanation) = "${lang}")
            } .
        }`
    let metadata = {}
    let rows = await runSparqlSelectQueryOnStore(query, store)
    for (let row of rows) {
        if (!metadata[row.rpUri]) {
            metadata[row.rpUri] = {
                uri: row.rpUri,
                title: row.title ?? "",
                leikaId: row.leikaId ?? "",
                seeAlso: row.seeAlso ?? "",
                validationStage: row.validationStage ?? "",
                benefitInfo: row.benefitInfo ?? "",
                ineligibleGeneralExplanation: row.ineligibleGeneralExplanation ?? "",
                categories: []
            }
        }
        if (row.category) metadata[row.rpUri].categories.push(row.category)
    }
    return metadata
}

export async function extractDatafieldsMetadata(datafieldsStr, lang) {
    let store = await rdfStringToStore(datafieldsStr)
    return await getDetailsAboutDfs([], store, lang)
}
