import { buildValidator, extractFirstIndividualUriFromTurtle, storeFromTurtles, turtleToDataset, newStore, addTurtleToStore } from "sem-ops-utils"

export class MatchingEngine {

    constructor(datafieldsTurtle, materializationTurtle, requirementProfilesTurtles) {
        this.knowledgeBaseStore = storeFromTurtles([datafieldsTurtle, materializationTurtle])
        this.requirementProfilesStore = newStore()
        this.validators = {}
        for (let rp of requirementProfilesTurtles) this.addValidator(rp)
    }

    addValidator(rp) {
        addTurtleToStore(this.requirementProfilesStore, rp)
        let rpUri = extractFirstIndividualUriFromTurtle(rp, "ff:RequirementProfile")
        if (rpUri) this.validators[rpUri] = buildValidator(rp)
    }

    async validateOne(up, rp) {
        let dataset = turtleToDataset(up)
        return await this.validators[rp].validate({ dataset })
    }
}
