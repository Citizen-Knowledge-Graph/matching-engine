export const FORMAT = {
    TURTLE: 1,
    JSON_LD: 2,
    STORE: 3
}

// to be used on one SHACL validation report at a time

// for a non-existing triple, sh:hasValue throws two validation errors: sh:MinCountConstraintComponent AND sh:HasValueConstraintComponent
// this doesn't work with our approach to determine eligibility, that's why we delete the HasValueConstraintComponent validation result in this case
export const QUERY_HASVALUE_FIX = `
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
                        ?result sh:sourceConstraintComponent ?type ;
                            sh:resultSeverity sh:Violation .
                        FILTER(?type NOT IN (sh:MinCountConstraintComponent, sh:QualifiedMinCountConstraintComponent, sh:OrConstraintComponent, sh:AndConstraintComponent, sh:NodeConstraintComponent))
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
            sh:resultPath ?df ;
            sh:resultSeverity sh:Violation .
        FILTER(?type IN (sh:MinCountConstraintComponent, sh:QualifiedMinCountConstraintComponent))
        
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
            ff:ineligibleGeneralExplanation ?ineligibleGeneralExplanation ;
            ff:administrativeLevel ?administrativeLevel ;
            ff:providingAgency ?providingAgency ;
            ff:legalBasis ?legalBasis ;
            ff:tag ?tag .
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
        OPTIONAL { ?rpUri ff:administrativeLevel ?administrativeLevel } .
        OPTIONAL { ?rpUri ff:providingAgency ?providingAgency } .
        OPTIONAL { ?rpUri ff:legalBasis ?legalBasis } .
        OPTIONAL { ?rpUri ff:tag ?tag } .
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
            ?ps sh:in/rdf:rest*/rdf:first ?option .
            ?option rdfs:label ?optionLabel .
            FILTER(lang(?optionLabel) = "${lang}")     
        }
    }`
}

export const QUERY_METADATA_DEFINITIONS = (rootUri, lang) => { return `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    CONSTRUCT {
        <${rootUri}> ff:hasDefinition ?def .
        ?def a ?type ;
            rdfs:label ?label ;
            rdfs:comment ?comment ;
            rdfs:seeAlso ?seeAlso .
    } WHERE {
        VALUES ?type {
            ff:BenefitCategory
            ff:DatafieldCategory
            ff:ProvidingAgency
            ff:AdministrativeLevel
            ff:Law
            ff:Tag
            ff:ValidationStage
            rdfs:Class
        }
        ?def a ?type ;
            rdfs:label ?label .
        FILTER(lang(?label) = "${lang}")
        OPTIONAL { 
            ?def rdfs:comment ?comment .
            FILTER(lang(?comment) = "${lang}")
        }
        OPTIONAL { ?def rdfs:seeAlso ?seeAlso }
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
