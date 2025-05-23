import { Store, Parser as N3Parser, Writer as N3Writer, DataFactory } from "n3"
const { namedNode, literal } = DataFactory
import Validator from "shacl-engine/Validator.js"
import { validations as sparqlValidations } from "shacl-engine/sparql.js"
import rdf from "rdf-ext"
import { QueryEngine } from "@comunica/query-sparql-rdfjs"

export async function rdfStringsToStore(rdfStrings) {
    let store = new Store()
    for (let str of rdfStrings) {
        await addRdfStringToStore(str, store)
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
        foaf: "http://xmlns.com/foaf/0.1/",
        temp: "https://foerderfunke.org/temp#"
    }})
}

export async function runValidationOnStore(store) {
    let dataset = rdf.dataset(store.getQuads())
    let validator = new Validator(dataset, { factory: rdf, debug: false, validations: sparqlValidations })
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

export function extractRpUriFromRpString(rpStr) {
    const match = rpStr.match(/(.*?)\s+a ff:RequirementProfile/) // make this more robust with whitespaces/trimming TODO
    if (match) {
        return expandPrefixedStr(match[1].trim())
    }
    console.error("Could not extract identifier from requirement profile string: " + rpStr)
    return "error"
}

export function convertReqProfilesStrArrToMap(reqProfileStrArr) {
    let map = {}
    for (let rpStr of reqProfileStrArr) {
        map[extractRpUriFromRpString(rpStr)] = rpStr
    }
    return map
}

export function expandPrefixedStr(str) {
    if (str.startsWith("ff:")) return "https://foerderfunke.org/default#" + str.slice(3)
    return str
}

export function convertObjectStr(objectStr) {
    if (typeof objectStr === "boolean") return literal(objectStr)
    objectStr = objectStr.toString()
    if (objectStr.toLowerCase() === "true") return literal(true)
    if (objectStr.toLowerCase() === "false") return literal(false)
    if (objectStr.startsWith("http")) return namedNode(objectStr)
    if (objectStr.startsWith("ff:")) return namedNode("https://foerderfunke.org/default#" + objectStr.slice(3))
    if (/^\d{4}-\d{2}-\d{2}.*$/.test(objectStr)) return literal(objectStr.substring(0, 10), { value: "xsd:date" })
    const num = Number(objectStr)
    if (!isNaN(num)) return literal(num)
    return literal(objectStr)
}

export function quadToSpo(quad) {
    return { s: quad.subject.value, p: quad.predicate.value, o: quad.object.value }
}

export function storeContainsTriple(store, triple) {
    return store.has(namedNode(triple.s), namedNode(triple.p), convertObjectStr(triple.o))
}

export async function getDeferments(store) {
    let defermentRows = await runSparqlSelectQueryOnStore(`
        PREFIX ff: <https://foerderfunke.org/default#>
        SELECT * WHERE {
            ?defermentUri a ff:Deferment ;
                rdf:subject ?subject ;
                rdf:predicate ?predicate .
        }`, store)
    let deferments = {}
    for (let row of defermentRows) {
        deferments[row.subject + "_" + row.predicate] = { uri: row.defermentUri }
    }
    return deferments
}

export async function getModifiableDatafields(store) {
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        SELECT * WHERE {
            ?df a ff:DataField ;
                ff:modifiable true .
        }`
    let rows = await runSparqlSelectQueryOnStore(query, store)
    let dfs = []
    for (let row of rows) {
        dfs.push(row.df)
    }
    return dfs
}

/*export async function rdfStringToDataset(rdfStr) {
    const store = await rdfStringToStore(rdfStr)
    return rdf.dataset(store.getQuads())
}
export function parseSparqlQuery(query) {
    // import SparqlParser from "sparqljs"
    // import util from "util"
    // console.log(util.inspect(queryObj, false, null, true))
    const queryParser = new SparqlParser.Parser()
    return queryParser.parse(query)
}
export async function runSparqlDeleteQueryOnStore(query, store) {
    const queryEngine = new QueryEngine()
    return await queryEngine.queryVoid(query, { sources: [ store ] })
}
*/
