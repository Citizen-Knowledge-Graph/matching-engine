import { Store, Parser as N3Parser, Writer as N3Writer, DataFactory } from "n3"
const { namedNode, literal } = DataFactory
import Validator from "shacl-engine/Validator.js"
import { validations as sparqlValidations } from "shacl-engine/sparql.js"
import rdf from "rdf-ext"
import { QueryEngine } from "@comunica/query-sparql-rdfjs"
import { getDetailsAboutDfs } from "./prematch.js"

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

export async function runSparqlDeleteQueryOnStore(query, store) {
    const queryEngine = new QueryEngine()
    return await queryEngine.queryVoid(query, { sources: [ store ] })
}

export function extractRpUriFromRpString(rpStr) {
    const match = rpStr.match(/(.*?)\s+a ff:RequirementProfile/) // make this more robust with whitespaces/trimming TODO
    if (match) {
        return expandPrefixedStr(match[1])
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

export async function extractRequirementProfilesMetadata(requirementProfileStrings, lang) {
    let store = await rdfStringsToStore(requirementProfileStrings)
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        SELECT * WHERE {
            ?rpUri a ff:RequirementProfile .
            OPTIONAL { 
                ?rpUri ff:title ?title .
                FILTER (lang(?title) = "${lang}")
            } .
            OPTIONAL { ?rpUri ff:leikaId ?leikaId } .
            OPTIONAL { ?rpUri ff:category ?category } .
            OPTIONAL { ?rpUri rdfs:seeAlso ?seeAlso } .
            OPTIONAL { 
                ?rpUri ff:benefitInfo ?benefitInfo .
                FILTER (lang(?benefitInfo) = "${lang}")
            } .
            OPTIONAL { 
                ?rpUri ff:ineligibleGeneralExplanation ?ineligibleGeneralExplanation .
                FILTER (lang(?ineligibleGeneralExplanation) = "${lang}")
            } .
        }`
    let metadata = {}
    let rows = await runSparqlSelectQueryOnStore(query, store)
    for (let row of rows) {
        if (!metadata[row.rpUri]) {
            metadata[row.rpUri] = {
                uri: row.rpUri,
                title: row.title ?? "",
                leikaId: row.leikaId ?? "",
                seeAlso: row.seeAlso ?? "",
                benefitInfo: row.benefitInfo ?? "",
                ineligibleGeneralExplanation: row.ineligibleGeneralExplanation ?? "",
                categories: []
            }
        }
        if (row.category) metadata[row.rpUri].categories.push(row.category)
    }
    return metadata
}

export async function extractDatafieldsMetadata(datafieldsStr, lang) {
    let store = await rdfStringToStore(datafieldsStr)
    return await getDetailsAboutDfs([], store, lang)
}

// replaced by method above that reuses helper method, but keeping this code for potential later reusage of the class-logic
/*export async function extractDatafieldsMetadata(datafieldsStr, lang) {
    let store = await rdfStringToStore(datafieldsStr)
    let query = `
        PREFIX ff: <https://foerderfunke.org/default#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX sh: <http://www.w3.org/ns/shacl#>
        SELECT * WHERE {
            ?dfUri a ff:DataField .
            OPTIONAL {
                ?dfUri rdfs:label ?label .
                FILTER (lang(?label) = "${lang}")
            } .
            OPTIONAL {
                ?dfUri schema:question ?question .
                FILTER (lang(?question) = "${lang}")
            } .
            OPTIONAL {
                ?dfUri rdfs:comment ?comment .
                FILTER (lang(?comment) = "${lang}")
            } .
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
            question: row.question ?? "",
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
}*/

const a = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}

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
            if (!isObject(arrayElement)) {
                writer.addQuad(subject, predicate, namedNode(expandPrefixedStr(arrayElement)))
                continue
            }
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
            rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
            xsd: "http://www.w3.org/2001/XMLSchema#",
            dcterms: "http://purl.org/dc/terms/",
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
