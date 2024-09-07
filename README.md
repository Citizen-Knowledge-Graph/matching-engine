# matching-engine
- **Input**: user profile, requirement profiles, datafield constraints, materialization queries
- **Output**: a report about eligibilities (yes, no, missing data)

In use in the [Förderfunke app](https://github.com/Citizen-Knowledge-Graph/foerderfunke-react-app).

## Local development

```shell
# after bumping the @foerderfunke/matching-engine version
npm run build
npm publish
```

```shell
# to run dev.js
npm start
```

## Using this library as dependency

```shell
npm install --save @foerderfunke/matching-engine
```

```shell
# package.json
{
  "type": "module",
  "dependencies": {
    "@foerderfunke/matching-engine": "^0.2.0"
  }
}

# dev.js
import { validateUserProfile } from "@foerderfunke/matching-engine"
# ...
let report = await validateUserProfile(userProfileString, datafieldsString)
console.log(report)

# node dev.js
```
