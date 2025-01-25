import { QueryEngine } from "@comunica/query-sparql-rdfjs"
import { rdfStringsToStore, runSparqlSelectQueryOnStore } from "./utils.js"
import { DataFactory } from "n3"
const { namedNode } = DataFactory

export async function getAllTriplesContainingUri(uri, store) {
    if (uri === null) {
        let allTriples = await runSparqlSelectQueryOnStore("SELECT * WHERE { ?s ?p ?o . }", store)
        return {
            allTriples: allTriples
        }
    }
    let query = `
        SELECT * WHERE {
            <${uri}> ?p ?o .
        }`
    let asSubject = await runSparqlSelectQueryOnStore(query, store)
    query = `
        SELECT * WHERE {
            ?s <${uri}> ?o .
        }`
    let asPredicate = await runSparqlSelectQueryOnStore(query, store)
    query = `
        SELECT * WHERE {
            ?s ?p <${uri}> .
        }`
    let asObject = await runSparqlSelectQueryOnStore(query, store)
    return {
        asSubject: asSubject,
        asPredicate: asPredicate,
        asObject: asObject
    }
}

export async function createStoreWithTempUrisForBlankNodes(rdfStrings) {
    let store = await rdfStringsToStore(rdfStrings)
    let query = "SELECT * WHERE { ?s ?p ?o . }"
    const queryEngine = new QueryEngine()
    let bindingsStream = await queryEngine.queryBindings(query, { sources: [ store ] })
    let bindings = await bindingsStream.toArray()
    bindings.forEach(binding => {
        let s = binding.get("s")
        let p = binding.get("p")
        let o = binding.get("o")
        if (s.termType === "BlankNode") {
            let sTemp = namedNode("https://foerderfunke.org/temp#" + s.value)
            store.addQuad(sTemp, p, o)
        }
        if (o.termType === "BlankNode") {
            let oTemp = namedNode("https://foerderfunke.org/temp#" + o.value)
            store.addQuad(s, p, oTemp)
        }
        // also delete original triples with blank nodes? or leave them and just hide them in the frontend
    })
    return store
}
