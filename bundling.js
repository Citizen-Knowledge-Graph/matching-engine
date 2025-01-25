import {
    ValidationResult,
    validateUserProfile,
    validateAll,
    checkUserProfileForMaterializations,
    inferNewUserDataFromCompliedRPs
} from "./src/index.js"

import {
    extractRequirementProfilesMetadata,
    extractDatafieldsMetadata
} from "./src/extract-metadata.js";

import {
    getBenefitCategories,
    getPrioritizedMissingDataFieldsJson,
    transformRulesFromRequirementProfile,
    RuleType
} from "./src/prematch.js";

import {
    convertUserProfileToTurtle
} from "./src/profile-conversion.js";

import {
    getAllTriplesContainingUri,
    createStoreWithTempUrisForBlankNodes
} from "./src/uri-resolving.js";


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
