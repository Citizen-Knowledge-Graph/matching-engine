import { Store, Parser as N3Parser, Writer as N3Writer, DataFactory } from "n3"
const { namedNode, literal } = DataFactory
import Validator from "shacl-engine/Validator.js"
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

export async function rdfStringToDataset(rdfStr) {
    const store = await rdfStringToStore(rdfStr)
    return rdf.dataset(store.getQuads())
}

/*export function parseSparqlQuery(query) {
    // import SparqlParser from "sparqljs"
    // import util from "util"
    // console.log(util.inspect(queryObj, false, null, true))
    const queryParser = new SparqlParser.Parser()
    return queryParser.parse(query)
}*/

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

export async function extractRpUriFromRpString(requirementProfileStr) {
    let store = await rdfStringToStore(requirementProfileStr)
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        SELECT * WHERE {
            ?rpUri a ff:RequirementProfile .
        }`
    let rows = await runSparqlSelectQueryOnStore(query, store)
    return rows[0].rpUri
}

export async function extractRequirementProfilesMetadata(requirementProfileStrings) {
    let store = await rdfStringsToStore(requirementProfileStrings)
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        SELECT * WHERE {
            ?rpUri a ff:RequirementProfile .
            OPTIONAL { ?rpUri ff:title ?title } .
            OPTIONAL { ?rpUri ff:category ?category } .
        }`
    let metadata = {}
    let rows = await runSparqlSelectQueryOnStore(query, store)
    for (let row of rows) {
        if (!metadata[row.rpUri]) {
            metadata[row.rpUri] = {
                uri: row.rpUri,
                title: row.title ?? "",
                categories: []
            }
        }
        if (row.category) metadata[row.rpUri].categories.push(row.category)
    }
    return metadata
}

export async function extractDatafieldsMetadata(datafieldsStr) {
    let store = await rdfStringToStore(datafieldsStr)
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX sh: <http://www.w3.org/ns/shacl#>
        SELECT * WHERE {
            ?dfUri a ff:DataField .
            OPTIONAL { ?dfUri rdfs:label ?label } .
            OPTIONAL { ?dfUri rdfs:comment ?comment } .
            OPTIONAL { 
                ?property sh:path ?dfUri ;
                    sh:class ?class .
            }
        }`
    let rows = await runSparqlSelectQueryOnStore(query, store)
    let metadata = {}
    for (let row of rows) {
        metadata[row.dfUri] = {
            uri: row.dfUri,
            label: row.label ?? "",
            comment: row.comment ?? "",
            objectHasClass: row.class ?? ""
        }
    }
    query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT * WHERE {
            ?classUri a ff:Class .
            OPTIONAL { ?classUri rdfs:label ?label } .
        }`
    rows = await runSparqlSelectQueryOnStore(query, store)
    for (let row of rows) {
        metadata[row.classUri] = {
            uri: row.classUri,
            label: row.label ?? "",
            isClass: true
        }
    }
    return metadata
}

const a = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")

function convertUserProfileToTurtleRecursively(jsonNode, writer) {
    if (!(jsonNode["@id"] && jsonNode["@type"])) {
        console.log("JSON node must have @id and @type, skipping it: " + JSON.stringify(jsonNode))
        return
    }
    let subject = namedNode(expandPrefixedStr(jsonNode["@id"]))
    let type = namedNode(expandPrefixedStr(jsonNode["@type"]))
    writer.addQuad(subject, a, type)
    for (let [predicate, objectOrArray] of Object.entries(jsonNode)) {
        if (predicate.startsWith("@")) continue
        predicate = namedNode(expandPrefixedStr(predicate)) // = dfUri
        if (!Array.isArray(objectOrArray)) {
            writer.addQuad(subject, predicate, convertObjectStr(objectOrArray))
            continue
        }
        for (let arrayElement of objectOrArray) {
            if (!arrayElement["@id"]) {
                console.log("JSON array element must have @id, skipping it: " + JSON.stringify(arrayElement))
                continue
            }
            writer.addQuad(subject, predicate, namedNode(expandPrefixedStr(arrayElement["@id"])))
            convertUserProfileToTurtleRecursively(arrayElement, writer)
        }
    }
}

export async function convertUserProfileToTurtle(userProfileJson) {
    const writer = new N3Writer({ prefixes: {
            xsd: "http://www.w3.org/2001/XMLSchema#",
            ff: "https://foerderfunke.org/default#"
        }})
    convertUserProfileToTurtleRecursively(userProfileJson, writer)
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve(result)
        })
    })
}

function expandPrefixedStr(str) {
    if (str.startsWith("ff:")) return "https://foerderfunke.org/default#" + str.slice(3)
    return str
}

function convertObjectStr(objectStr) {
    if (typeof objectStr === "boolean") return literal(objectStr)
    objectStr = objectStr.toString()
    if (objectStr.toLowerCase() === "true") return literal(true)
    if (objectStr.toLowerCase() === "false") return literal(false)
    if (objectStr.startsWith("http")) return namedNode(objectStr)
    if (objectStr.startsWith("ff:")) return namedNode("https://foerderfunke.org/default#" + objectStr.slice(3))
    if (/^\d{4}-\d{2}-\d{2}$/.test(objectStr)) return literal(objectStr, { value: "xsd:date" })
    const num = Number(objectStr)
    if (!isNaN(num)) return literal(num)
    return literal(objectStr)
}

export function quadToSpo(quad) {
    return { s: quad.subject.value, p: quad.predicate.value, o: quad.object.value }
}

export function storeContainsTriple(store, triple) {
    return store.has(namedNode(triple.subject), namedNode(triple.predicate), convertObjectStr(triple.object))
}
