import { buildValidator, extractFirstIndividualUriFromTurtle, storeFromTurtles } from "sem-ops-utils"

export class MatchingEngineObject {
    constructor(datafieldsTurtle, materializationTurtle, requirementProfilesTurtles) {
        this.knowledgeBaseStore = storeFromTurtles([datafieldsTurtle, materializationTurtle])
        this.requirementProfilesStore = storeFromTurtles(requirementProfilesTurtles)
        this.validators = {}
        for (let rpStr of requirementProfilesTurtles) {
            let rpUri = extractFirstIndividualUriFromTurtle(rpStr, "ff:RequirementProfile")
            if (rpUri) this.validators[rpUri] = buildValidator(rpStr)
        }
    }
    func() {}
}
