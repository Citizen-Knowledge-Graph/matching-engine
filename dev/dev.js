import util from "util"
import path from "path"
import { fileURLToPath } from "url"
import fs, { promises as fsPromise } from "fs"
import {
    checkUserProfileForMaterializations,
    inferNewUserDataFromCompliedRPs,
    validateAll, validateAllUserProfilesAgainstOneRp,
    validateOne,
    validateUserProfile
} from "../src/index.js"
import {
    addRdfStringToStore, printDatasetAsTurtle,
    runSparqlConstructQueryOnRdfString,
    runSparqlSelectQueryOnRdfString, runValidationOnStore
} from "../src/utils.js"
import {
    getBenefitCategories,
    getPrioritizedMissingDataFieldsJson,
    transformRulesFromRequirementProfile
} from "../src/prematch.js";
import {Store} from "n3";

const DB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "requirement-profiles")
const SHACL_DIR = `${DB_DIR}/shacl`
const USER_PROFILE = `${DB_DIR}/user-profile-examples/kinderzuschlag-user-profile.ttl`
const DATAFIELDS = `${DB_DIR}/datafields.ttl`
const MATERIALIZATION = `${DB_DIR}/materialization.ttl`

async function devRunSparqlSelectQueryOnRdfString() {
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

    // query = `
    //     PREFIX ff: <https://foerderfunke.org/default#>
    //     PREFIX sh: <http://www.w3.org/ns/shacl#>
    //     SELECT * WHERE {
    //         ?df a ff:DataField .
    //         ?df rdfs:label ?label .
    //         OPTIONAL { ?df rdfs:comment ?comment } .
    //         OPTIONAL { ?df ff:explanation ?explanation } .
    //
    //         #?df ff:hasOOshape ?ooShape .
    //         #?ooShape sh:datatype ?datatype .
    //         #?ooShape sh:in/rdf:rest*/rdf:first ?value .
    //
    //         ?df ff:hasSOshape ?ooShape .
    //         ?ooShape sh:property ?property .
    //         ?property sh:maxCount ?maxCount .
    //     }
    // `

    let rdfStr = await fsPromise.readFile(`${DB_DIR}/sozialplattform/materialization.ttl`, "utf8")
    runSparqlSelectQueryOnRdfString(query, rdfStr).then(result => console.log(result))
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
    /*
    let shaclFiles = await fsPromise.readdir(SHACL_DIR)
    let userProfile = await fsPromise.readFile(USER_PROFILE, "utf8")
    let datafieldsStr = await fsPromise.readFile(DATAFIELDS, "utf8")
    let materializationStr = await fsPromise.readFile(MATERIALIZATION, "utf8")
     */
    let dir = `${DB_DIR}/sozialplattform/shacl`
    let shaclFiles = await fsPromise.readdir(dir)
    let userProfile = await fsPromise.readFile(`${DB_DIR}/sozialplattform/user-profile-dev.ttl`, "utf8")
    let datafieldsStr = await fsPromise.readFile(`${DB_DIR}/sozialplattform/datafields.ttl`, "utf8")
    let materializationStr = await fsPromise.readFile(`${DB_DIR}/sozialplattform/materialization.ttl`, "utf8")

    let requirementProfiles = {}
    for (let file of shaclFiles) {
        // if (!(file === "kinderzuschlag.ttl")) continue
        // requirementProfiles[file] = await fsPromise.readFile(`${SHACL_DIR}/${file}`, "utf8")
        requirementProfiles[file] = await fsPromise.readFile(`${dir}/${file}`, "utf8")
        // console.log(`${dir}/${file}`);
    }
    let startTime = new Date().getTime()
    let report = await validateAll(userProfile, requirementProfiles, datafieldsStr, materializationStr, false)
    let endTime = new Date().getTime()
    console.log("time elapsed", (endTime - startTime) / 1000, "seconds")
    console.log(util.inspect(report, { showHidden: false, depth: null, colors: true }))
}

async function devValidateOne() {
    let userProfile = await fsPromise.readFile(`${DB_DIR}/sozialplattform/user-profile-dev.ttl`, "utf8")
    let requirementProfile = await fsPromise.readFile(`${DB_DIR}/sozialplattform/shacl/10-bildung-und-teilhabe-bei-bezug-von-buergergeld.ttl`, "utf8")
    let datafieldsStr = await fsPromise.readFile(`${DB_DIR}/sozialplattform/datafields.ttl`, "utf8")
    let materializationStr = await fsPromise.readFile(`${DB_DIR}/sozialplattform/materialization.ttl`, "utf8")
    let report = await validateOne(userProfile, requirementProfile, datafieldsStr, materializationStr, false)
    console.log(util.inspect(report, false, null, true))
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
    let userProfileStr = await fsPromise.readFile(`${DB_DIR}/sozialplattform/user-profile-dev.ttl`, "utf8")
    let datafieldsStr = await fsPromise.readFile(`${DB_DIR}/sozialplattform/datafields.ttl`, "utf8")
    let report = await validateUserProfile(userProfileStr, datafieldsStr, true)
    console.log(report)
}

async function devExtractMetadata() {
    const dir = `${DB_DIR}/sozialplattform/shacl`
    let rpStrings = []
    for (let file of await fsPromise.readdir(dir)) {
        rpStrings.push(await fsPromise.readFile(`${dir}/${file}`, "utf8"))
    }
    console.log("Requirement profiles metadata:", await extractRequirementProfilesMetadata(rpStrings, "en"))
    console.log("Datafields metadata:", await extractDatafieldsMetadata(await fsPromise.readFile(`${DB_DIR}/sozialplattform/datafields.ttl`, "utf8"), "en"))
}

async function devConvertUserProfileToTurtle() {
    let userProfileJsonStr = JSON.stringify({
        "@id": "ff:mainPerson",
        "@type": "ff:Citizen",
        "ff:hasFirstNames": "Max",
        "ff:hasFamilyName": "Mustermann",
        "ff:hasBirthday": "1992-05-17",
        "ff:paysRentCold": 900,
        "ff:hasLivingArea": 80,
        "ff:hasResidence": "Berlin",
        "ff:parentingSetup": "ff:Elternpaar",
        "ff:receivesWohngeld": 450,
        "ff:hasIncomeBrutto": 2700,
        "ff:hasIncomeNetto": 1600,
        "ff:hasChild": [
            {
                "@id": "ff:child0",
                "@type": "ff:Child",
                "ff:hasBirthday": "2013-01-23",
                "ff:hasMaritalStatus": "LD",
                "ff:receiveKindergeld": 250
            },
            {
                "@id": "ff:child1",
                "@type": "ff:Child",
                "ff:hasBirthday": "2008-02-15",
                "ff:hasMaritalStatus": "LD",
                "ff:receiveKindergeld": 250
            }
        ],
        "ff:einkommen_neu": ["ff:einkommen_neu-ao-alg", "ff:einkommen_neu-ao-selbstaendig"]
    })
    let turtleStr = await convertUserProfileToTurtle(JSON.parse(userProfileJsonStr))
    console.log(turtleStr)
}

async function devCheckUserProfileForMaterializations() {
    let userProfileStr = await fsPromise.readFile(USER_PROFILE, "utf8")
    let materializationStr = await fsPromise.readFile(MATERIALIZATION, "utf8")
    let report = await checkUserProfileForMaterializations(userProfileStr, materializationStr)
    console.log(util.inspect(report, false, null, true))
}

async function devInferNewUserDataFromCompliedRPs() {
    let userProfileStr = await fsPromise.readFile(USER_PROFILE, "utf8")
    let requirementProfileStr = await fsPromise.readFile(`${SHACL_DIR}/opendva-jenabonus.ttl`, "utf8")
    let report = await inferNewUserDataFromCompliedRPs(userProfileStr, requirementProfileStr)
    console.log(report)
}

async function devDeferment() {
    let userProfileStr = await fsPromise.readFile(`${DB_DIR}/user-profile-examples/dev-deferment-user-profile.ttl`, "utf8")
    let datafieldsStr = await fsPromise.readFile(DATAFIELDS, "utf8")
    let requirementProfileStr = await fsPromise.readFile(`${SHACL_DIR}/dev-child-toy.ttl`, "utf8")
    let materializationStr = await fsPromise.readFile(MATERIALIZATION, "utf8")

    // check 1: validation
    let report = await validateAll(userProfileStr, { rp: requirementProfileStr }, datafieldsStr, materializationStr, false)
    console.log("1. Validation", util.inspect(report, { showHidden: false, depth: null, colors: true }))

    // check 2: materialization
    report = await checkUserProfileForMaterializations(userProfileStr, materializationStr)
    console.log("2. Materialization", util.inspect(report, { showHidden: false, depth: null, colors: true }))

    // check 3: inference from complied RPs
    let compliedRpStr = await fsPromise.readFile(`${SHACL_DIR}/opendva-jenabonus.ttl`, "utf8")
    report = await inferNewUserDataFromCompliedRPs(userProfileStr, compliedRpStr)
    console.log("3. Inference", report)
}

async function devGetBenefitCategories() {
    let datafieldsStr = await fsPromise.readFile(`${DB_DIR}/sozialplattform/datafields.ttl`, "utf8")
    let shaclDir = `${DB_DIR}/sozialplattform/shacl`
    let shaclFiles = await fsPromise.readdir(`${shaclDir}`)
    let rps = []
    for (let file of shaclFiles) {
        rps.push(await fsPromise.readFile(`${shaclDir}/${file}`, "utf8"))
    }
    let result = await getBenefitCategories(datafieldsStr, rps, true)
    console.log(util.inspect(result, false, null, true))
}

async function devGetPrioritizedMissingDataFieldsJson() {
    let userProfileStr = `
        @prefix ff: <https://foerderfunke.org/default#> .
        ff:mainPerson a ff:Citizen .
    `
    let datafieldsStr = await fsPromise.readFile(`${DB_DIR}/sozialplattform/datafields.ttl`, "utf8")
    let materializationStr = await fsPromise.readFile(`${DB_DIR}/sozialplattform/materialization.ttl`, "utf8")
    let shaclDir = `${DB_DIR}/sozialplattform/shacl`
    let shaclFiles = await fsPromise.readdir(`${shaclDir}`)
    let rps = []
    for (let file of shaclFiles) {
        rps.push(await fsPromise.readFile(`${shaclDir}/${file}`, "utf8"))
    }
    let benefitCategories = ["ff:leistungen-fuer-familien-bc-kategorie", "ff:sozialhilfe-grundsicherung-bc-kategorie"]
    let benefits = ["ff:hilfe-zum-lebensunterhalt"]
    benefitCategories = []
    benefits = []
    let lang = "de" // "en"
    let result = await getPrioritizedMissingDataFieldsJson(benefitCategories, benefits, userProfileStr, datafieldsStr, rps, materializationStr, lang)
    console.log(util.inspect(result, false, null, true))
}

async function devTransformRulesFromRequirementProfile() {
    let requirementProfile = await fsPromise.readFile(`${DB_DIR}/sozialplattform/shacl/02-kindergeld.ttl`, "utf8")
    let result = await transformRulesFromRequirementProfile(requirementProfile, "en")
    console.log(util.inspect(result, false, null, true))
}

async function devValidateMultipleProfilesAgainstOneRP() {
    let userProfileDir = `${DB_DIR}/user-profile-examples`
    let userProfileFiles = await fsPromise.readdir(userProfileDir)
    let datafieldsStr = await fsPromise.readFile(`${DB_DIR}/datafields.ttl`, "utf8")
    let materializationStr = await fsPromise.readFile(`${DB_DIR}/materialization.ttl`, "utf8")
    let rpStr = await fsPromise.readFile(`${DB_DIR}/shacl/kinderzuschlag.ttl`, "utf8")
    let userProfiles = {}
    for (let userProfileFilename of userProfileFiles) {
        // console.log(`${userProfileDir}/${userProfileFilename}`);
        userProfiles[userProfileFilename] = await fsPromise.readFile(`${userProfileDir}/${userProfileFilename}`, "utf8")
    }
    let result = await validateAllUserProfilesAgainstOneRp(userProfiles, rpStr, datafieldsStr, materializationStr, false)
    console.log(util.inspect(result, false, null, true))
}

async function shaclSparqlTest() {
    let userProfileStr = `
        @prefix ff: <https://foerderfunke.org/default#> .
        ff:mainPerson a ff:Citizen ;
            ff:numb1 1000 ;
            ff:numb2 2000 .
    `
    let rpStr = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ff: <https://foerderfunke.org/default#> .

        ff:Test1Shape a sh:NodeShape ;
        sh:targetClass ff:Citizen ;
        sh:property [
            sh:path ff:numb1 ;
            sh:minCount 1 ;
        ] .
    
        ff:Test2Shape a sh:NodeShape ;
        sh:targetClass ff:Citizen ;
        sh:sparql [
            a sh:SPARQLConstraint ;
            sh:message "Test 123" ;
            sh:select """
                PREFIX ff: <https://foerderfunke.org/default#>
                SELECT $this WHERE {
                    $this ff:numb1 ?numb1 .
                    $this ff:numb2 ?numb2 .
                    FILTER(?numb1 < ?numb2) .
                }
            """ ;
        ] .
    `
    let store = new Store()
    await addRdfStringToStore(userProfileStr, store)
    await addRdfStringToStore(rpStr, store)
    let validationReport = await runValidationOnStore(store)
    printDatasetAsTurtle(validationReport.dataset)
}

async function devModifiable() {
    let dir = `${DB_DIR}/experimental`
    let user = await fsPromise.readFile(`${dir}/municipality-profile.ttl`, "utf8")
    let rp = await fsPromise.readFile(`${dir}/municipality-foerderung-spielplatz.ttl`, "utf8")
    //let user = await fsPromise.readFile(`${dir}/user-profile.ttl`, "utf8")
    //let rp = await fsPromise.readFile(`${dir}/ausbildungsfoerderung.ttl`, "utf8")

    let df = await fsPromise.readFile(`${dir}/datafields.ttl`, "utf8")
    let mat = await fsPromise.readFile(`${dir}/materialization.ttl`, "utf8")
    let report = await validateOne(user, rp, df, mat, false)
    console.log(util.inspect(report, false, null, true))
}

async function devGetAllTriplesContainingUri() {
    let uri = "https://foerderfunke.org/default#geburtsdatum"

    let dir = `${DB_DIR}/sozialplattform`
    let shaclDir = `${dir}/shacl`
    let df = await fsPromise.readFile(`${dir}/datafields.ttl`, "utf8")
    let mat = await fsPromise.readFile(`${dir}/materialization.ttl`, "utf8")
    let shaclFiles = await fsPromise.readdir(`${shaclDir}`)
    let rps = []
    for (let file of shaclFiles) {
        rps.push(await fsPromise.readFile(`${shaclDir}/${file}`, "utf8"))
    }

    let store = await createStoreWithTempUrisForBlankNodes([df, mat, ...rps])
    let triples = await getAllTriplesContainingUri(uri, store)
    console.log(triples)
}

async function devTestSeverity() {
    let data = `
        @prefix ff: <https://foerderfunke.org/default#> .
        ff:mainPerson a ff:Citizen ;
            ff:dev 1000 .
    `
    let shacl = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ff: <https://foerderfunke.org/default#> .

        ff:Test1Shape a sh:NodeShape ;
        sh:targetClass ff:Citizen ;
        sh:property [
            sh:path ff:dev ;
            sh:maxExclusive 100 ;
            sh:severity sh:Info ;
        ] .
    `
    let store = new Store()
    await addRdfStringToStore(data, store)
    await addRdfStringToStore(shacl, store)
    let validationReport = await runValidationOnStore(store)
    printDatasetAsTurtle(validationReport.dataset)
}

async function devShDeactivated() {
    let profile = `
        @prefix ff: <https://foerderfunke.org/default#>.
        ff:mainPerson a ff:Citizen ;
            ff:citizenship ff:eu . # ff:de
            # ff:steuerpflichtig true .`

    let shacl = `
        @prefix ff: <https://foerderfunke.org/default#>.
        @prefix sh: <http://www.w3.org/ns/shacl#>.
        @prefix shn: <https://schemas.link/shacl-next#>.
        ff:RootShape a sh:NodeShape;
            sh:targetClass ff:Citizen ;
            sh:property [
                sh:path ff:citizenship ;
                sh:in (ff:de ff:eu) ;
                sh:minCount 1 ;
            ] ;
            sh:property [
              sh:deactivated [
                  shn:eq ([ sh:path ff:citizenship ] ff:de )
              ] ;
              sh:path ff:steuerpflichtig ;
              sh:in (true) ;
              sh:minCount 1 ;
            ] .`
    let store = new Store()
    await addRdfStringToStore(profile, store)
    await addRdfStringToStore(shacl, store)
    let validationReport = await runValidationOnStore(store)
    printDatasetAsTurtle(validationReport.dataset)
}

async function devQualifiedValueShape() {
    let userProfile = `
        @prefix ff: <https://foerderfunke.org/default#> .
        ff:mainPerson a ff:Citizen ;
            ff:hasChild ff:child0, ff:child1 .
        ff:child0 a ff:Child ;
            ff:hasAge 28 .
        ff:child1 a ff:child ;
            ff:hasAge 34 .`
    let datafieldsStr = await fsPromise.readFile(`${DB_DIR}/sozialplattform/datafields.ttl`, "utf8")
    let materializationStr = await fsPromise.readFile(`${DB_DIR}/sozialplattform/materialization.ttl`, "utf8")
    let requirementProfiles = {}
    requirementProfiles["devQualifiedValueShape"] = `
        @prefix ff: <https://foerderfunke.org/default#> .
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        ff:devQualifiedValueShape a ff:RequirementProfile .
        ff:MainShape a sh:NodeShape ;
            sh:targetClass ff:Citizen ;
            sh:property [
                sh:path ff:hasChild ;
                sh:qualifiedValueShape ff:ChildShape ;
                sh:qualifiedMinCount 1 ;
            ] .
        ff:ChildShape a sh:NodeShape ;
            sh:property [
                sh:path ff:hasAge ;
                sh:maxExclusive 25 ;
                sh:minCount 1 ;
            ] .`
    let report = await validateAll(userProfile, requirementProfiles, datafieldsStr, materializationStr, false)
    console.log(util.inspect(report, { showHidden: false, depth: null, colors: true }))
}

// devRunSparqlSelectQueryOnRdfString()
// devRunSparqlConstructQueryOnRdfString()
// devValidateAll()
// devValidateOne()
// devValidateOneStrings()
// devValidateUserProfile()
// devExtractMetadata()
// devConvertUserProfileToTurtle()
// devCheckUserProfileForMaterializations()
// devInferNewUserDataFromCompliedRPs()
// devDeferment()
// devGetBenefitCategories()
// devGetPrioritizedMissingDataFieldsJson()
// devTransformRulesFromRequirementProfile()
// devValidateMultipleProfilesAgainstOneRP()
// shaclSparqlTest()
// devModifiable()
// devGetAllTriplesContainingUri()
// devTestSeverity()
// devShDeactivated()
devQualifiedValueShape()
