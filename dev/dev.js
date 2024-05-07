import util from "util"
import path from "path"
import { fileURLToPath } from "url"
import fs, { promises as fsPromise } from "fs"
import { validateAll, validateOne, validateSingleDatafieldValue, validateUserProfile } from "../src/index.js"
import {
    convertUserProfileToTurtle,
    extractDatafieldsMetadata,
    extractRequirementProfilesMetadata,
    runSparqlConstructQueryOnRdfString,
    runSparqlSelectQueryOnRdfString
} from "../src/utils.js"

const DB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "requirement-profiles")
const SHACL_DIR = `${DB_DIR}/shacl`
const USER_PROFILE = `${DB_DIR}/user-profile-examples/empty-user-profile.ttl`
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
        // if (!(file === "kinderzuschlag.ttl")) continue
        requirementProfiles[file] = await fsPromise.readFile(`${SHACL_DIR}/${file}`, "utf8")
    }

    let report = await validateAll(userProfile, requirementProfiles, datafieldsStr, materializationStr, true)
    // console.log(report)
    console.log(util.inspect(report, { showHidden: false, depth: null, colors: true }))
}

async function devValidateOne() {
    let userProfile = await fsPromise.readFile(USER_PROFILE, "utf8")
    let requirementProfile = await fsPromise.readFile(`${SHACL_DIR}/kinderzuschlag.ttl`, "utf8")
    let datafieldsStr = await fsPromise.readFile(DATAFIELDS, "utf8")
    let materializationStr = await fsPromise.readFile(MATERIALIZATION, "utf8")
    let report = await validateOne(userProfile, requirementProfile, datafieldsStr, materializationStr, true)
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

async function devExtractMedatada() {
    let rpStrings = []
    for (let file of await fsPromise.readdir(SHACL_DIR)) {
        rpStrings.push(await fsPromise.readFile(`${SHACL_DIR}/${file}`, "utf8"))
    }
    console.log("Requirement profiles metadata:", await extractRequirementProfilesMetadata(rpStrings))
    console.log("Datafields metadata:", await extractDatafieldsMetadata(await fsPromise.readFile(DATAFIELDS, "utf8")))
}

async function devConvertUserProfileToTurtle() {
    let userProfileJsonStr = JSON.stringify({
        "ff:hasFirstNames": "Max",
        "ff:hasFamilyName": "Mustermann",
        "ff:hasBirthday": "1992-05-17",
        "ff:paysRentCold": 900,
        "ff:hasLivingArea": 80,
        "ff:hasResidence": "Berlin",
        "ff:hasParentingSetup": "ff:Elternpaar",
        "ff:receivesWohngeld": 450,
        "ff:hasIncomeBrutto": 2700,
        "ff:hasIncomeNetto": 1600,
        "ff:hasChild": [
            {
                "ff:hasBirthday": "2013-01-23",
                "ff:hasMaritalStatus": "LD",
                "ff:receivesKindergeld": 250
            },
            {
                "ff:hasBirthday": "2008-02-15",
                "ff:hasMaritalStatus": "LD",
                "ff:receivesKindergeld": 250
            }
        ]
    })
    let turtleStr = await convertUserProfileToTurtle(JSON.parse(userProfileJsonStr))
    console.log(turtleStr)
}

async function devValidateSingleDatafieldValue() {
    let datafieldsStr = await fsPromise.readFile(DATAFIELDS, "utf8")
    let singleDatafieldTriple = {
        triples: [{
            subject: "https://foerderfunke.org/default#mainPerson",
            predicate: "https://foerderfunke.org/default#hasIncomeBrutto",
            object: "5000"
        }]
    }
    let result = await validateSingleDatafieldValue(singleDatafieldTriple, datafieldsStr)
    console.log(result)
}

// devRunSparqlSelectQueryOnRdfString()
// devRunSparqlConstructQueryOnRdfString()
// devValidateAll()
// devValidateOne()
// devValidateOneStrings()
// devValidateUserProfile()
// devExtractMedatada()
devConvertUserProfileToTurtle()
// devValidateSingleDatafieldValue()
