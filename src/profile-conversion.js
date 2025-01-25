import { Writer as N3Writer, DataFactory } from "n3"
import { convertObjectStr, expandPrefixedStr } from "./utils.js"
const { namedNode } = DataFactory

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
