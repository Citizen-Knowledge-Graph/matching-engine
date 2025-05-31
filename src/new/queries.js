export const MATCHING_MODE = {
    QUIZ: "ff:quiz",
    FULL: "ff:full"
}

export const FORMAT = {
    TURTLE: 1,
    JSON_LD: 2,
    STORE: 3
}

// to be used on one SHACL validation report at a time

export const QUERY_HASVALUE_FIX = `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    DELETE {
        ?parentNode sh:result ?result2 ;
            sh:detail ?result2 .
        ?result2 ?p ?o .
    } WHERE {
        # parentNode can be the blank root node of sh:ValidationReport or sh:detail
        ?parentNode (sh:result | sh:detail) ?result1, ?result2 .
      
        ?result1 
            sh:focusNode ?focusNode ;
            sh:resultPath ?path ;
            sh:sourceConstraintComponent ?type .
        FILTER(?type IN (sh:MinCountConstraintComponent, sh:QualifiedMinCountConstraintComponent))
                 
        ?result2 
            sh:focusNode ?focusNode ;
            sh:resultPath ?path ;
            sh:sourceConstraintComponent sh:HasValueConstraintComponent ;
            ?p ?o .
}`

export const QUERY_ELIGIBILITY_STATUS = (rpEvalUri) => { return `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    CONSTRUCT {
        <${rpEvalUri}> ff:hasEligibilityStatus ?status .
    } WHERE {
        ?report sh:conforms ?conforms .
        BIND(
            IF(
                ?conforms = true,
                ff:eligible,
                IF(
                    EXISTS {
                        ?result sh:sourceConstraintComponent ?type .
                        FILTER(?type NOT IN (sh:MinCountConstraintComponent, sh:QualifiedMinCountConstraintComponent, sh:OrConstraintComponent))
                    },
                    ff:ineligible, ff:missingData
                )
            )
        AS ?status)
    }`
}

export const QUERY_MISSING_DATAFIELDS = (reportUri, rpEvalUri) => { return `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    
    CONSTRUCT {
        <${reportUri}> ff:hasMissingDatafield ?indivDfId .
        ?indivDfId ff:isMissedBy <${rpEvalUri}> ;
            rdf:subject ?individual ;
            rdf:predicate ?df .
    } WHERE {
        ?result a sh:ValidationResult ;
            sh:sourceConstraintComponent ?type ;
            sh:focusNode ?individual ;
            sh:resultPath ?df .
        FILTER(?type IN (sh:MinCountConstraintComponent, sh:QualifiedMinCountConstraintComponent))                
    
        FILTER NOT EXISTS {
            ?otherResult sh:sourceConstraintComponent ?otherType .
            FILTER(?otherType NOT IN (sh:MinCountConstraintComponent, sh:QualifiedMinCountConstraintComponent, sh:OrConstraintComponent))
        }
     
        BIND(IRI(CONCAT(STR(?individual), "_", REPLACE(STR(?df), "^.*[#/]", ""))) AS ?indivDfId)
    }`
}

export const QUERY_TOP_MISSING_DATAFIELD = (reportUri) => { return `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX ff: <https://foerderfunke.org/default#>
    
    CONSTRUCT {
        <${reportUri}> ff:hasMostMissedDatafield ?dfId .
        ?dfId rdf:subject ?subject ;
            rdf:predicate ?datafield .
    } WHERE {
        {
            SELECT ?dfId ?subject ?datafield (COUNT(?rp) AS ?missedByCount) WHERE {
                ?dfId ff:isMissedBy ?rp ;
                    rdf:subject ?subject ;
                    rdf:predicate ?datafield .
            }
            GROUP BY ?dfId ?subject ?datafield
            ORDER BY DESC(?missedByCount)
            LIMIT 1
        }
    }`
}

export const QUERY_NUMBER_OF_MISSING_DATAFIELDS = (reportUri) => { return `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX ff: <https://foerderfunke.org/default#>
    
    CONSTRUCT {
        <${reportUri}> ff:hasNumberOfMissingDatafields ?missingDfs .
    } WHERE {
        {
            SELECT (COUNT(DISTINCT ?dfId) AS ?missingDfs) WHERE {
                ?dfId ff:isMissedBy ?rp .
            }
        }
    }`
}

export const QUERY_DELETE_NON_VIOLATING_VALIDATION_RESULTS = `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>

    DELETE {
        ?parentNode sh:result ?result ;
            sh:detail ?result .
        ?result ?p ?o .
    } WHERE { 
        ?parentNode (sh:result | sh:detail) ?result .
        ?result sh:sourceConstraintComponent ?type ;
            ?p ?o .
        FILTER(?type = sh:MinCountConstraintComponent || ?type = sh:QualifiedMinCountConstraintComponent || ?type = sh:OrConstraintComponent)
    }`

export const QUERY_BUILD_INDIVIDUALS_TREE = `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    
    CONSTRUCT {
        ?parentIndividual ff:hasSubindividualClass ?subindividualClass ;
            ff:conformanceMode ?conformanceModeIndividualLevelFinal .
        ?subindividualClass ff:hasSubindividual ?individual ;
            ff:conformanceMode ?conformanceModeClassLevelFinal .
    } WHERE {
        ?parentIndividual a ?parentClass .
        ?individual a ?class .
        ?parentIndividual ?relationship ?individual .
      
        BIND(IRI(CONCAT(STR(?parentIndividual), "_", REPLACE(STR(?class), "^.*[#/]", ""))) AS ?subindividualClass)
    
        OPTIONAL {
            ?parentNodeShape sh:targetClass ?parentClass ;
                sh:property ?ps1 .
            ?ps1 sh:node ?childNodeShape ;
                 ff:conformanceMode ?conformanceModeClassLevel .
            ?childNodeShape sh:targetClass ?class ;
        }
        BIND(COALESCE(?conformanceModeClassLevel, ff:cmAtLeastOne) AS ?conformanceModeClassLevelFinal)
    
        OPTIONAL {
            ?parentNodeShape sh:targetClass ?parentClass ;
                ff:conformanceMode ?conformanceModeIndividualLevel .
        }
        BIND(COALESCE(?conformanceModeIndividualLevel, ff:cmAll) AS ?conformanceModeIndividualLevelFinal)
    }`

export const QUERY_EXTRACT_INVALID_INDIVIDUALS = `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    
    CONSTRUCT {
        ff:validationReport ff:containsInvalidIndividual ?individual .
    } WHERE {
        ?result sh:focusNode ?individual ;
            sh:sourceConstraintComponent ?type .
        FILTER(?type NOT IN (sh:MinCountConstraintComponent, sh:NodeConstraintComponent))
    }`

// metadata

export const QUERY_METADATA_RPS = (rootUri, lang) => { return `
    PREFIX ff: <https://foerderfunke.org/default#>
    CONSTRUCT {
        <${rootUri}> ff:hasRP ?rpUri .
        ?rpUri a ff:RequirementProfile ;
            ff:title ?title ;
            ff:leikaId ?leikaId ;
            ff:category ?category ;
            rdfs:seeAlso ?seeAlso ;
            ff:validationStage ?validationStage ;
            ff:benefitInfo ?benefitInfo ;
            ff:ineligibleGeneralExplanation ?ineligibleGeneralExplanation .
    } WHERE {
        ?rpUri a ff:RequirementProfile .
        OPTIONAL { 
            ?rpUri ff:title ?title  .
            FILTER (lang(?title) = "${lang}")
        } .
        OPTIONAL { ?rpUri ff:leikaId ?leikaId } .
        OPTIONAL { ?rpUri ff:category ?category } .
        OPTIONAL { ?rpUri rdfs:seeAlso ?seeAlso } .
        OPTIONAL { ?rpUri ff:validationStage ?validationStage } .
        OPTIONAL { 
            ?rpUri ff:benefitInfo ?benefitInfo  .
            FILTER (lang(?benefitInfo) = "${lang}")
        } .
        OPTIONAL { 
            ?rpUri ff:ineligibleGeneralExplanation ?ineligibleGeneralExplanation  .
            FILTER (lang(?ineligibleGeneralExplanation) = "${lang}")
        } .
    }`
}

export const QUERY_METADATA_DFS = (rootUri, lang) => { return `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX schema: <http://schema.org/>
    CONSTRUCT {
        <${rootUri}> ff:hasDF ?df .
        ?df a ff:DataField ;
            rdfs:label ?label ;
            schema:category ?category ;
            schema:question ?question ;
            rdfs:comment ?comment ;
            ff:datatype ?datatype ;
            ff:hasAnswerOption ?option .
        ?option a ff:AnswerOption ;
            rdfs:label ?optionLabel .
    } WHERE {
        ?df a ff:DataField ;
            rdfs:label ?label .
        FILTER (lang(?label) = "${lang}")
        OPTIONAL {
            ?df schema:category ?category .
        }  
        OPTIONAL {
            ?df schema:question ?question .
            FILTER (lang(?question) = "${lang}")
        }  
        OPTIONAL { 
          ?df rdfs:comment ?comment .
          FILTER (lang(?comment) = "${lang}")
        }
        OPTIONAL { 
            ?df ff:hasShaclShape ?shape .
            ?shape sh:property ?ps .
            OPTIONAL { ?ps sh:datatype ?dt }
            OPTIONAL { ?ps sh:maxCount ?maxCount }
            BIND(COALESCE(?dt, IF(BOUND(?maxCount), ff:selection, ff:selection_multiple)) AS ?datatype)
        }
        OPTIONAL { 
            ?df ff:hasShaclShape ?shape .
            ?shape sh:property ?ps .
            ?ps ff:shInListMember ?option .
            ?option rdfs:label ?optionLabel .
            FILTER(lang(?optionLabel) = "${lang}")     
        }
    }`
}

import { DataFactory } from "n3"
const { namedNode, quad } = DataFactory

// workaround because sh:in/rdf:rest*/rdf:first doesn't work properly: https://github.com/comunica/comunica/issues/1562
export function flattenListWorkaround(store) {
    const RDF_FIRST= namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#first")
    const RDF_REST = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#rest")
    const RDF_NIL = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#nil")
    const SH_IN = namedNode("http://www.w3.org/ns/shacl#in")
    const LIST_MEMBER = namedNode("https://foerderfunke.org/default#shInListMember")
    for (const inQuad of store.getQuads(null, SH_IN, null, null)) {
        const propShape = inQuad.subject
        let cursor = inQuad.object
        while (cursor && !cursor.equals(RDF_NIL)) {
            const firstQuad = store.getQuads(cursor, RDF_FIRST, null, null)[0]
            if (!firstQuad) break
            const item = firstQuad.object
            if (store.getQuads(propShape, LIST_MEMBER, item, null).length === 0) {
                store.addQuad(quad(propShape, LIST_MEMBER, item))
            }
            const restQuad = store.getQuads(cursor, RDF_REST, null, null)[0]
            if (!restQuad) break
            cursor = restQuad.object
        }
    }
}

export const QUERY_METADATA_BCS = (rootUri, lang) => { return `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX schema: <http://schema.org/>
    CONSTRUCT {
        <${rootUri}> ff:hasBC ?bc .
        ?bc a ff:BenefitCategory ;
            rdfs:label ?label .
    } WHERE {
        ?bc a ff:BenefitCategory ;
        rdfs:label ?label .
        FILTER (lang(?label) = "${lang}")
    }`
}

export const QUERY_INSERT_VALIDATION_REPORT_URI = (validationReportUri) => { return `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    DELETE {
        ?reportBlankNode ?p ?o .
    } INSERT {
        ${validationReportUri} ?p ?o .
    } WHERE {
        ?reportBlankNode a sh:ValidationReport ;
            ?p ?o .
    }`
}

export const QUERY_LINK_REPORT_ONLY_IF_EXISTS = (reportName, rpEvalUri) => { return `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    CONSTRUCT {
        <${rpEvalUri}> ff:hasValidationReport ${reportName} .
    } WHERE {
        ?result a sh:ValidationResult .
    }`
}

export const FETCH_LEAVE_NODE_EVALS = `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    SELECT * WHERE {
        ?result sh:focusNode ?focusNode ;
            sh:resultSeverity ?severity ;
            sh:sourceConstraintComponent ?type .    
        FILTER(?type NOT IN (
            sh:NotConstraintComponent,
            sh:OrConstraintComponent,
            sh:AndConstraintComponent,
            sh:MinCountConstraintComponent
        )) .
        OPTIONAL { ?result sh:resultPath ?resultPath . }
        OPTIONAL { ?result sh:resultMessage ?resultMessage . }
        OPTIONAL { ?result sh:value ?value . }
        OPTIONAL {
            ?parent sh:result|sh:detail ?result ;
                sh:resultPath ?parentResultPath ;
                sh:focusNode ?parentFocusNode .
        }        
    }`
