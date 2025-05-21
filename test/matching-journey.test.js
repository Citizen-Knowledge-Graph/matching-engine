import "./fixtures/common.js"
import { describe } from "mocha"

describe("testing matching functionality via journey calls", function () {
    let matchingEngine

    before(function () {
        matchingEngine = globalThis.matchingEngine
        matchingEngine.init()
    })

    // TODO
})
