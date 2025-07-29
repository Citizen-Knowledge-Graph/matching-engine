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
        profile.addEntry("ff:user", "ff:hasName", "John")
        profile.addEntry("ff:user", "ff:hasAge", 30)
        profile.changeEntry("ff:user", "ff:hasAge", 30, 40)
        profile.removeEntry("ff:user", "ff:hasName", "John")
        profile.addIndividual("ff:Child")
        let actualTurtle = await profile.toTurtle()
        let expectedTurtle = `
            @prefix ff: <https://foerderfunke.org/default#>.
            ff:user a ff:Citizen ; ff:hasAge 40 .
            ff:child1 a ff:Child .`
        strictEqual(isomorphicTurtles(actualTurtle, expectedTurtle), true, "The turtles are not the same")
    })
})
