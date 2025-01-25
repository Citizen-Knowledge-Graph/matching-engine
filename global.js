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
    getAllTriplesContainingUri,
    createStoreWithTempUrisForBlankNodes
} from "./src/utils.js";

import {
    getBenefitCategories,
    getPrioritizedMissingDataFieldsJson,
    transformRulesFromRequirementProfile,
    RuleType
} from "./src/prematch.js";

import {
    convertUserProfileToTurtle
} from "./src/profile-conversion.js";

window.MatchingEngine = {
    ValidationResult,
    validateUserProfile,
    validateAll,
    extractRequirementProfilesMetadata,
    extractDatafieldsMetadata,
    convertUserProfileToTurtle,
    checkUserProfileForMaterializations,
    inferNewUserDataFromCompliedRPs,
    getBenefitCategories,
    getPrioritizedMissingDataFieldsJson,
    transformRulesFromRequirementProfile,
    getAllTriplesContainingUri,
    createStoreWithTempUrisForBlankNodes,
    RuleType
}
