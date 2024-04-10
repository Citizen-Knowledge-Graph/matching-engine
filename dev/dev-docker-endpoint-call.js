import data from "./opendva-profile-data.json" assert { type: "json" }

fetch("http://localhost:3000/foerderfunke-eligibility-check", {
    method: "POST",
    body: JSON.stringify({ jsonProfile: data }),
    headers: { "Content-Type": "application/json" }
})
    .then(response => response.json())
    .then(json => console.log("Result:", json))
    .catch(err => console.error("Error:", err))
