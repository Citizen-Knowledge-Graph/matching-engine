import {
    ValidationResult,
    validateUserProfile,
    validateAll,
    checkUserProfileForMaterializations,
    inferNewUserDataFromCompliedRPs
} from "./src/index.js"

import {
    extractRequirementProfilesMetadata,
    extractDatafieldsMetadata,
    convertUserProfileToTurtle
} from "./src/utils.js";

window.MatchingEngine = {
    ValidationResult,
    validateUserProfile,
    validateAll,
    extractRequirementProfilesMetadata,
    extractDatafieldsMetadata,
    convertUserProfileToTurtle,
    checkUserProfileForMaterializations,
    inferNewUserDataFromCompliedRPs
}
