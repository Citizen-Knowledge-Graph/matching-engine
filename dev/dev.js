import path from "path"
import { fileURLToPath } from "url"
import fs, { promises as fsPromise } from "fs"
import { validateAll, validateOne, validateUserProfile } from "../src/index.js"
import { runSparqlConstructQueryOnRdfString, runSparqlSelectQueryOnRdfString } from "../src/utils.js"

const DB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "db")
const SHACL_DIR = `${DB_DIR}/shacl`
const USER_PROFILE = `${DB_DIR}/dev-user-profile.ttl`
const DATAFIELDS = `${DB_DIR}/datafields.ttl`
const MATERIALIZATION = `${DB_DIR}/materialization.ttl`

function devRunSparqlSelectQueryOnRdfString() {
    let query = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        SELECT * WHERE { 
            ?s foaf:birthday ?bday .
            BIND(YEAR(NOW()) - YEAR(?bday) - IF(MONTH(NOW()) < MONTH(?bday) || (MONTH(NOW()) = MONTH(?bday) && DAY(NOW()) < DAY(?bday)), 1, 0) AS ?age) .
        }
    `
    /*let rdfStr = `
        @prefix ex: <http://example.org/> .
        ex:sub1 ex:pred1 ex:obj1 .
        ex:sub2 ex:pred2 ex:obj2 .
    `*/
    fs.readFile(USER_PROFILE, "utf8", (err, data) => {
        runSparqlSelectQueryOnRdfString(query, data).then(result => console.log(result))
    })
}

function devRunSparqlConstructQueryOnRdfString() {
    let query = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        CONSTRUCT {
            ?person foaf:age ?age .
        } WHERE { 
            ?person foaf:birthday ?bday .
            BIND(YEAR(NOW()) - YEAR(?bday) - IF(MONTH(NOW()) < MONTH(?bday) || (MONTH(NOW()) = MONTH(?bday) && DAY(NOW()) < DAY(?bday)), 1, 0) AS ?age) .
        }
    `
    fs.readFile(USER_PROFILE, "utf8", (err, data) => {
        runSparqlConstructQueryOnRdfString(query, data).then(result => console.log(result))
    })
}

async function devValidateAll() {
    let shaclFiles = await fsPromise.readdir(SHACL_DIR)
    let userProfile = await fsPromise.readFile(USER_PROFILE, "utf8")
    let datafieldsStr = await fsPromise.readFile(DATAFIELDS, "utf8")
    let materializationStr = await fsPromise.readFile(MATERIALIZATION, "utf8")

    let requirementProfiles = {}
    for (let file of shaclFiles) {
        requirementProfiles[file] = await fsPromise.readFile(`${SHACL_DIR}/${file}`, "utf8")
    }

    let report = await validateAll(userProfile, requirementProfiles, datafieldsStr, materializationStr)
    console.log(report)
}

async function devValidateOne() {
    let userProfile = await fsPromise.readFile(USER_PROFILE, "utf8")
    let requirementProfile = await fsPromise.readFile(`${SHACL_DIR}/kinderzuschlag.ttl`, "utf8")
    let datafieldsStr = await fsPromise.readFile(DATAFIELDS, "utf8")
    let materializationStr = await fsPromise.readFile(MATERIALIZATION, "utf8")
    let report = await validateOne(userProfile, requirementProfile, datafieldsStr, materializationStr)
    console.log(report)
}

function devValidateOneStrings() {
    const userProfile = `
        @prefix ex: <http://example.org/> .
        
        ex:numb1 a ex:Number .
        ex:numb1 ex:is 5 .
    `
    const requirementProfile = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        
        ex:NumbShape a sh:NodeShape ;
            sh:targetClass ex:Number ;
            sh:property [
                sh:path ex:is ;
                sh:minInclusive 10 ;
                sh:message "ex:Number must be at least 10" ;
            ] .
    `
    validateOne(userProfile, requirementProfile).then(report => console.log(report))
}

async function devValidateUserProfile() {
    let userProfile = await fsPromise.readFile(USER_PROFILE, "utf8")
    let datafieldsStr = await fsPromise.readFile(DATAFIELDS, "utf8")
    let conforms = await validateUserProfile(userProfile, datafieldsStr)
    console.log(conforms)
}

// devRunSparqlSelectQueryOnRdfString()
// devRunSparqlConstructQueryOnRdfString()
devValidateAll()
// devValidateOne()
// devValidateOneStrings()
// devValidateUserProfile()
