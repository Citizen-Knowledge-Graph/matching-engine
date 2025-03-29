import { buildValidator, extractFirstIndividualUriFromTurtle, storeFromTurtles, turtleToDataset, newStore, addTurtleToStore, storeFromDataset, sparqlConstruct, storeToTurtle } from "sem-ops-utils"
import { QUERY_ELIGIBILITY_STATUS } from "./queries.js"

export class MatchingEngine {

    constructor(datafieldsTurtle, materializationTurtle, requirementProfilesTurtles) {
        this.knowledgeBaseStore = storeFromTurtles([datafieldsTurtle, materializationTurtle])
        this.requirementProfilesStore = newStore()
        this.validators = {}
        for (let rpTurtle of requirementProfilesTurtles) this.addValidator(rpTurtle)
    }

    addValidator(rpTurtle) {
        addTurtleToStore(this.requirementProfilesStore, rpTurtle)
        let rpUri = extractFirstIndividualUriFromTurtle(rpTurtle, "ff:RequirementProfile")
        if (rpUri) this.validators[rpUri] = buildValidator(rpTurtle)
    }

    async basicValidation(upTurtle, rpUri) {
        let dataset = turtleToDataset(upTurtle)
        return await this.validators[rpUri].validate({ dataset })
    }

    async matching(upTurtle, rpUris) {
        let upDataset = turtleToDataset(upTurtle)
        let targetStore = newStore()

        for (let rpUri of rpUris) {
            let report = await this.validators[rpUri].validate({ dataset: upDataset })
            let sourceStore = storeFromDataset(report.dataset)
            await sparqlConstruct(QUERY_ELIGIBILITY_STATUS(rpUri), sourceStore, targetStore)

            // TODO
        }

        console.log(await storeToTurtle(targetStore))
    }
}
