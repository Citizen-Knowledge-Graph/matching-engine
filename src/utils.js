import { Store, Parser as N3Parser, Writer as N3Writer } from "n3"
import SparqlParser from "sparqljs"
import Validator from "shacl-engine/Validator.js"
import rdf from "rdf-ext"

/**
 * @param {string} rdfStr
 * @returns {Promise<Store>}
 */
export function rdfStringToStore(rdfStr) {
    let store = new Store()
    return addRdfStringToStore(rdfStr, store)
}

export function addRdfStringToStore(rdfStr, store) {
    return new Promise((resolve, reject) => {
        const parser = new N3Parser()
        parser.parse(rdfStr, (error, quad, prefixes) => {
            if (error) {
                console.error(error)
                reject(error)
            }
            if (quad) {
                store.add(quad)
            } else {
                resolve(store)
            }
        })
    })
}

/**
 * @param {string} rdfStr
 * @returns {Promise<Dataset>}
 */
export async function rdfStringToDataset(rdfStr) {
    const store = await rdfStringToStore(rdfStr)
    return rdf.dataset(store.getQuads())
}

/**
 * @param {string} query
 * @returns {SparqlQuery}
 */
export function parseSparqlQuery(query) {
    const queryParser = new SparqlParser.Parser()
    return queryParser.parse(query)
}

export function printDatasetAsTurtle(dataset) {
    const writer = new N3Writer({ prefixes: {
        sh: "http://www.w3.org/ns/shacl#",
        ff: "https://foerderfunke.org/default#",
        foaf: "http://xmlns.com/foaf/0.1/"
    }})
    dataset.forEach(quad => writer.addQuad(quad))
    writer.end((error, result) => console.log(result))
}

export async function runValidationOnStore(store) {
    let dataset = rdf.dataset(store.getQuads())
    let validator = new Validator(dataset, { factory: rdf, debug: false })
    return await validator.validate({ dataset: dataset })
}
