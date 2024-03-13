import { foo } from "./utils.js"

/**
 * @param {string} userProfile
 * @param {string[]} requirementProfiles
 * @returns {Promise<string>}
 */
export async function validateAll(userProfile, requirementProfiles) {
    console.log(userProfile)
    console.log(requirementProfiles)

    return "report"
}
