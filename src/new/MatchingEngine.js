import { buildValidator, extractFirstIndividualUriFromTurtle, storeFromTurtles, turtleToDataset, datasetToTurtle } from "sem-ops-utils"

export class MatchingEngine {

    constructor(datafieldsTurtle, materializationTurtle, requirementProfilesTurtles) {
        this.buildKnowledgeBaseStore(datafieldsTurtle, materializationTurtle)
        this.buildRequirementProfileStore(requirementProfilesTurtles)
        this.buildValidators(requirementProfilesTurtles)
    }

    buildKnowledgeBaseStore(df, mat) {
        this.knowledgeBaseStore = storeFromTurtles([df, mat])
    }

    buildRequirementProfileStore(rps) {
        this.requirementProfilesStore = storeFromTurtles(rps)
    }

    buildValidators(rps) {
        this.validators = {}
        for (let rpStr of rps) {
            let rpUri = extractFirstIndividualUriFromTurtle(rpStr, "ff:RequirementProfile")
            if (rpUri) this.validators[rpUri] = buildValidator(rpStr)
        }
    }

    async validateOne(up, rp) {
        let dataset = turtleToDataset(up)
        let report = await this.validators[rp].validate({ dataset })
        return datasetToTurtle(report.dataset)
    }
}
