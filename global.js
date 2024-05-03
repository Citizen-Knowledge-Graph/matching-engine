import {
    ValidationResult,
    validateUserProfile,
    validateOne,
    validateAll,
} from "./src/index.js"

import {
    rdfStringsToStore,
    runSparqlSelectQueryOnStore,
    extractRequirementProfilesMetadata
} from "./src/utils.js";

window.MatchingEngine = {
    ValidationResult,
    validateUserProfile,
    validateOne,
    validateAll,
    rdfStringsToStore,
    runSparqlSelectQueryOnStore,
    extractRequirementProfilesMetadata
}
