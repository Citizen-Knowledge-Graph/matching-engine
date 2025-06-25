import { getRdf, queryEngine, sparqlSelect, storeFromTurtles } from "@foerderfunke/sem-ops-utils"

export async function getAllTriplesContainingUri(uri, store) {
    if (uri === null) {
        let allTriples = await sparqlSelect("SELECT * WHERE { ?s ?p ?o . }", [store])
        return {
            allTriples: allTriples
        }
    }
    let query = `
        SELECT * WHERE {
            <${uri}> ?p ?o .
        }`
    let asSubject = await sparqlSelect(query, store)
    query = `
        SELECT * WHERE {
            ?s <${uri}> ?o .
        }`
    let asPredicate = await sparqlSelect(query, store)
    query = `
        SELECT * WHERE {
            ?s ?p <${uri}> .
        }`
    let asObject = await sparqlSelect(query, store)
    return {
        asSubject: asSubject,
        asPredicate: asPredicate,
        asObject: asObject
    }
}

export async function createStoreWithTempUrisForBlankNodes(rdfStrings) {
    let store = await storeFromTurtles([rdfStrings])
    let query = "SELECT * WHERE { ?s ?p ?o . }"
    let bindingsStream = await queryEngine.queryBindings(query, { sources: [ store ] })
    let bindings = await bindingsStream.toArray()
    bindings.forEach(binding => {
        let s = binding.get("s")
        let p = binding.get("p")
        let o = binding.get("o")
        if (s.termType === "BlankNode") {
            let sTemp = getRdf().namedNode("https://foerderfunke.org/temp#" + s.value)
            store.addQuad(sTemp, p, o)
        }
        if (o.termType === "BlankNode") {
            let oTemp = getRdf().namedNode("https://foerderfunke.org/temp#" + o.value)
            store.addQuad(s, p, oTemp)
        }
        // also delete original triples with blank nodes? or leave them and just hide them in the frontend
    })
    return store
}
