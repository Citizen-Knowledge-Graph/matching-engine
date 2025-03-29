import { buildValidator, extractFirstIndividualUriFromTurtle, storeFromTurtles, turtleToDataset, newStore, addTurtleToStore } from "sem-ops-utils"

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
}
