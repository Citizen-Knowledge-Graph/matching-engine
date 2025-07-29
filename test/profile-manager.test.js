import { describe } from "mocha"
import { strictEqual } from "node:assert"
import { isomorphicTurtles } from "@foerderfunke/sem-ops-utils"

describe("profile manager tests", function () {
    let profileManager

    before(async function () {
        profileManager = globalThis.profileManager
        profileManager.newProfile()
        await profileManager.init()
    })

    it("test basic triple functions", async function () {
        let profile = profileManager.profiles["profile1"]
        profile.addIndividual("ff:Citizen")
        profile.addEntry("ff:citizen1", "ff:hasName", "John")
        profile.addEntry("ff:citizen1", "ff:hasAge", 30)
        profile.changeEntry("ff:citizen1", "ff:hasAge", 30, 40)
        profile.removeEntry("ff:citizen1", "ff:hasName", "John")
        profile.addIndividual("ff:Citizen")
        let actualTurtle = await profile.toTurtle()
        let expectedTurtle = `
            @prefix ff: <https://foerderfunke.org/default#>.
            ff:citizen1 a ff:Citizen ; ff:hasAge 40 .
            ff:citizen2 a ff:Citizen .`
        strictEqual(isomorphicTurtles(actualTurtle, expectedTurtle), true, "The turtles are not the same")
    })
})
