import { Store, Parser as N3Parser } from "n3"
import SparqlParser from "sparqljs"
import rdf from "rdf-ext"

/**
 * @param {string} rdfStr
 * @returns {Promise<Store>}
 */
export function rdfStringToStore(rdfStr) {
    return new Promise((resolve, reject) => {
        let store = new Store()
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
export function rdfStringToDataset(rdfStr) {
    return rdfStringToStore(rdfStr).then(store => {
        return rdf.dataset(store.getQuads())
    })
}

/**
 * @param {string} query
 * @returns {SparqlQuery}
 */
export function parseSparqlQuery(query) {
    const queryParser = new SparqlParser.Parser()
    return queryParser.parse(query)
}
