import Validator from "shacl-engine/Validator.js"
import { validations } from "shacl-engine/sparql.js"
import { Parser, Store } from "n3"
import rdf from "rdf-ext"
import formatsPretty from "@rdfjs/formats/pretty.js"

const parser = new Parser({ factory: rdf })
rdf.formats.import(formatsPretty)

export const prefixes = {
    ff: "https://foerderfunke.org/default#",
    sh: "http://www.w3.org/ns/shacl#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    foaf: "http://xmlns.com/foaf/0.1/",
}

const prefixesArr = Object.entries(prefixes).map(
    ([prefix, iri]) => [prefix, rdf.namedNode(iri)]
)

export async function datasetToTurtle(dataset) {
    return await rdf.io.dataset.toText("text/turtle", dataset, { prefixes: prefixesArr })
}

export function buildValidators(idToShaclStrMap) {
    const validators = {}
    for (const [id, shaclStr] of Object.entries(idToShaclStrMap)) {
        validators[id] = buildValidator(shaclStr)
    }
    return validators
}

export function buildValidator(shaclStr) {
    const dataset = rdf.dataset(parser.parse(shaclStr))
    return new Validator(dataset, { factory: rdf, validations })
}

export async function runValidation(validator, dataset) {
    return await validator.validate({ dataset })
}

export function storeFromTurtle(turtleStr) {
    const store = new Store({ factory: rdf })
    store.addQuads(parser.parse(turtleStr))
    return store
}

export function storeToDataset(store) {
    return rdf.dataset(store.getQuads())
}

export function turtleToDataset(turtleStr) {
    return rdf.dataset(parser.parse(turtleStr))
}

export function extractRpUriFromRpStr(rpStr) {
    const match = rpStr.match(/(.*?)\s+a ff:RequirementProfile/)
    if (match) return expandPrefixedStr(match[1])
    console.error("Could not extract identifier from requirement profile string: " + rpStr)
    return ""
}

export function expandPrefixedStr(str) {
    for (let prefix of Object.keys(prefixes)) {
        if (str.startsWith(prefix + ":")) {
            return prefixes[prefix] + str.slice(prefix.length + 1)
        }
    }
    return str
}
