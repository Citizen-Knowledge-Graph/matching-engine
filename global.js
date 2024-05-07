import {
    ValidationResult,
    validateUserProfile,
    validateOne,
    validateAll,
    validateSingleDatafieldValue
} from "./src/index.js"

import {
    rdfStringsToStore,
    runSparqlSelectQueryOnStore,
    extractRequirementProfilesMetadata,
    extractDatafieldsMetadata,
    convertUserProfileToTurtle
} from "./src/utils.js";

window.MatchingEngine = {
    ValidationResult,
    validateUserProfile,
    validateOne,
    validateAll,
    rdfStringsToStore,
    runSparqlSelectQueryOnStore,
    extractRequirementProfilesMetadata,
    extractDatafieldsMetadata,
    convertUserProfileToTurtle,
    validateSingleDatafieldValue
}
