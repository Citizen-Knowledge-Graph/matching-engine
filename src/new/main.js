import { runValidation, storeToDataset } from "./basics.js"

export async function runMatching(profileStore, validatorsMap) {
    // materialization TODO

    const profileDataset = storeToDataset(profileStore)

    for (let [rp, validator] of Object.entries(validatorsMap)) {
        const report = await runValidation(validator, profileDataset)
        console.log(rp, report.conforms)
    }
}
