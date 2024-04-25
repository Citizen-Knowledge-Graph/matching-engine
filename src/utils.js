import { Store, Parser as N3Parser, Writer as N3Writer } from "n3"
import SparqlParser from "sparqljs"
import Validator from "shacl-engine/Validator.js"
import rdf from "rdf-ext"
import { QueryEngine } from "@comunica/query-sparql-rdfjs"

export async function rdfStringsToStore(rdfStrings) {
    let store = new Store()
    for (let rdfString of rdfStrings) {
        await addRdfStringToStore(rdfString, store)
    }
    return store
}

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

export async function rdfStringToDataset(rdfStr) {
    const store = await rdfStringToStore(rdfStr)
    return rdf.dataset(store.getQuads())
}

export function parseSparqlQuery(query) {
    // import util from "util"
    // console.log(util.inspect(queryObj, false, null, true))
    const queryParser = new SparqlParser.Parser()
    return queryParser.parse(query)
}

export function printDatasetAsTurtle(dataset) {
    const writer = getWriter()
    dataset.forEach(quad => writer.addQuad(quad))
    writer.end((error, result) => console.log(result))
}

export function printStoreAsTurtle(store) {
    const writer = getWriter()
    store.getQuads().forEach(quad => writer.addQuad(quad))
    writer.end((error, result) => console.log(result))
}

function getWriter() {
    return new N3Writer({ prefixes: {
        sh: "http://www.w3.org/ns/shacl#",
        ff: "https://foerderfunke.org/default#",
        foaf: "http://xmlns.com/foaf/0.1/"
    }})
}

export async function runValidationOnStore(store) {
    let dataset = rdf.dataset(store.getQuads())
    let validator = new Validator(dataset, { factory: rdf, debug: false })
    return await validator.validate({ dataset: dataset })
}

export async function runSparqlSelectQueryOnRdfString(query, rdfStr) {
    let store = await rdfStringToStore(rdfStr)
    return runSparqlSelectQueryOnStore(query, store)
}

export async function runSparqlAskQueryOnStore(query, store) {
    const queryEngine = new QueryEngine()
    return await queryEngine.queryBoolean(query, { sources: [store] })
}

export async function runSparqlSelectQueryOnStore(query, store) {
    const queryEngine = new QueryEngine()
    let bindingsStream = await queryEngine.queryBindings(query, { sources: [ store ] })
    let bindings = await bindingsStream.toArray()
    let results = []
    bindings.forEach(binding => {
        const variables = Array.from(binding.keys()).map(({ value }) => value)
        let row = {}
        variables.forEach(variable => {
            row[variable] = binding.get(variable).value
        })
        results.push(row)
    })
    return results
}

export async function runSparqlConstructQueryOnRdfString(query, rdfStr) {
    let store = await rdfStringToStore(rdfStr)
    return runSparqlConstructQueryOnStore(query, store)
}

export async function runSparqlConstructQueryOnStore(query, store) {
    const queryEngine = new QueryEngine()
    let quadsStream = await queryEngine.queryQuads(query, { sources: [ store ] })
    return await quadsStream.toArray()
}

export async function runSparqlDeleteQueryOnStore(query, store) {
    const queryEngine = new QueryEngine()
    return await queryEngine.queryVoid(query, { sources: [ store ] })
}
