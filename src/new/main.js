import { buildValidator, extractFirstIndividualUriFromTurtle, storeFromTurtles } from "sem-ops-utils"

export function buildInMemoryObject(datafieldsTurtle, materializationTurtle, requirementProfilesTurtles) {
    let obj = {}
    obj.dfMatStore = storeFromTurtles([datafieldsTurtle, materializationTurtle])
    obj.rpStore = storeFromTurtles(requirementProfilesTurtles)
    obj.validators = {}
    for (let rpStr of requirementProfilesTurtles) {
        let rpUri = extractFirstIndividualUriFromTurtle(rpStr, "ff:RequirementProfile")
        if (rpUri) obj.validators[rpUri] = buildValidator(rpStr)
    }
    return obj
}
