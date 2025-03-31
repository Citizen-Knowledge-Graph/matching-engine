import { buildValidator, extractFirstIndividualUriFromTurtle, storeFromTurtles, turtleToDataset, newStore, addTurtleToStore, storeFromDataset, sparqlConstruct, storeToTurtle } from "sem-ops-utils"
import { QUERY_ELIGIBILITY_STATUS, QUERY_MISSING_DATAFIELDS, QUERY_VIOLATING_DATAFIELDS } from "./queries.js"

export class MatchingEngine {

    constructor(datafieldsTurtle, materializationTurtle, requirementProfilesTurtles) {
        this.dfMatStore = storeFromTurtles([datafieldsTurtle, materializationTurtle])
        this.datafieldsValidator = buildValidator(datafieldsTurtle)
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
        return await this.validators[rpUri].validate({ dataset: turtleToDataset(upTurtle) })
    }

    async validateAgainstDatafieldShapes(upTurtle) {
        return await this.datafieldsValidator.validate({ dataset: turtleToDataset(upTurtle) })
    }

    async quizMatching(upTurtle, rpUris) {
        let targetStore = await this.matching(upTurtle, rpUris, [
            QUERY_ELIGIBILITY_STATUS,
            QUERY_MISSING_DATAFIELDS
        ])
        return await storeToTurtle(targetStore)
    }

    async detailedMatching(upTurtle, rpUris) {
        let targetStore = await this.matching(upTurtle, rpUris, [
            QUERY_ELIGIBILITY_STATUS,
            QUERY_MISSING_DATAFIELDS,
            QUERY_VIOLATING_DATAFIELDS
        ])
        return await storeToTurtle(targetStore)
    }

    async matching(upTurtle, rpUris, queries) {
        // enrich & validate user profile TODO
        let upDataset = turtleToDataset(upTurtle)
        let targetStore = newStore()
        for (let rpUri of rpUris) {
            let report = await this.validators[rpUri].validate({ dataset: upDataset })
            let sourceStore = storeFromDataset(report.dataset) // store this in class object for reuse until overwritten again?
            for (let query of queries) {
                await sparqlConstruct(query(rpUri), sourceStore, targetStore)
            }
        }
        return targetStore
    }
}
