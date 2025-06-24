// test-list.js
import fs from "fs/promises";
import {
  rdfStringToStore,
  runSparqlSelectQueryOnStore
} from "./utils.js";
import { DataFactory } from "n3";
const { namedNode } = DataFactory;

async function main() {
  // 1) Load your TTL into a store
  const ttl = await fs.readFile("./datafields.ttl", "utf8");
  const store = await rdfStringToStore(ttl);

  // — DEBUG: inspect store size and list-node counts —
  const totalQuads = typeof store.size === "number"
    ? store.size
    : store.getQuads(null, null, null, null).length;
  console.log("🗃️ total quads in store:", totalQuads);
  const firstQuads = store.getQuads(
    null,
    namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#first"),
    null,
    null
  );
  console.log("🔢 total rdf:first quads:", firstQuads.length);

  // 2) Define any language and optional DataField URIs to filter
  const lang = "en";
  const shortenedDfUris = []; // e.g. ["ff:field1", "ff:field2"]

  // 3) Zero-or-more SPARQL with merged property-paths and explicit projection
  const query = `
    PREFIX ff:   <https://foerderfunke.org/default#>
    PREFIX sh:   <http://www.w3.org/ns/shacl#>
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?df ?option ?label WHERE {
      ?df a ff:DataField .
      ${shortenedDfUris.length === 0 ? "" : "VALUES ?df { " + shortenedDfUris.join(" ") + " }"}

      # Follow the path ff:hasShaclShape → sh:property → sh:in → all list members
      ?df ff:hasShaclShape/sh:property/sh:in/rdf:rest*/rdf:first ?option .

      # Grab the label in the specified language
      ?option rdfs:label ?label .
      FILTER(lang(?label) = "${lang}")
    }
  `;

  // 4) Run the query and log the results
  const rows = await runSparqlSelectQueryOnStore(query, store);
  console.log(
    "🔍 [DEBUG] choice rows count:",
    rows.length,
    rows.map(r => ({ df: r.df, option: r.option, label: r.label }))
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});