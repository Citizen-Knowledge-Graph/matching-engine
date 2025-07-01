import { expand, getRdf, getWriter, a } from "@foerderfunke/sem-ops-utils"

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}

function convertObjectStr(objectStr) {
    const xsd = prefix => getRdf().namedNode(`http://www.w3.org/2001/XMLSchema#${prefix}`)
    if (typeof objectStr === "boolean") return getRdf().literal(objectStr, xsd("boolean"))
    objectStr = objectStr.toString()
    if (objectStr.toLowerCase() === "true") return getRdf().literal("true", xsd("boolean"))
    if (objectStr.toLowerCase() === "false") return getRdf().literal("false", xsd("boolean"))
    if (objectStr.startsWith("http")) return getRdf().namedNode(objectStr)
    if (objectStr.startsWith("ff:")) return getRdf().namedNode("https://foerderfunke.org/default#" + objectStr.slice(3))
    if (/^\d{4}-\d{2}-\d{2}.*$/.test(objectStr)) return getRdf().literal(objectStr.substring(0, 10), xsd("date"))
    const num = Number(objectStr)
    if (!isNaN(num)) {
        const type = Number.isInteger(num) ? xsd("integer") : xsd("decimal")
        return getRdf().literal(num.toString(), type)
    }
    return getRdf().literal(objectStr)
}

function convertUserProfileToTurtleRecursively(jsonNode, writer) {
    if (!(jsonNode["@id"] && jsonNode["@type"])) {
        console.log("JSON node must have @id and @type, skipping it: " + JSON.stringify(jsonNode))
        return
    }
    let subject = getRdf().namedNode(expand(jsonNode["@id"]))
    let type = getRdf().namedNode(expand(jsonNode["@type"]))
    writer.addQuad(subject, a, type)
    for (let [predicate, objectOrArray] of Object.entries(jsonNode)) {
        if (predicate.startsWith("@")) continue
        predicate = getRdf().namedNode(expand(predicate)) // = dfUri
        if (!Array.isArray(objectOrArray)) {
            writer.addQuad(subject, predicate, convertObjectStr(objectOrArray))
            continue
        }
        for (let arrayElement of objectOrArray) {
            if (!isObject(arrayElement)) {
                writer.addQuad(subject, predicate, getRdf().namedNode(expand(arrayElement)))
                continue
            }
            if (!arrayElement["@id"]) {
                console.log("JSON array element must have @id, skipping it: " + JSON.stringify(arrayElement))
                continue
            }
            writer.addQuad(subject, predicate, getRdf().namedNode(expand(arrayElement["@id"])))
            convertUserProfileToTurtleRecursively(arrayElement, writer)
        }
    }
}

export async function convertUserProfileToTurtle(userProfileJson) {
    const writer = getWriter({
            rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
            xsd: "http://www.w3.org/2001/XMLSchema#",
            dcterms: "http://purl.org/dc/terms/",
            ff: "https://foerderfunke.org/default#"
        })
    convertUserProfileToTurtleRecursively(userProfileJson, writer)
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error)
            else resolve(result)
        })
    })
}
