import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"

export default {
    input: "src/index.js",
    output: [
        {
            file: "dist/bundle.cjs",
            format: "cjs"
        },
        /*
        {
            file: "dist/bundle.esm.js",
            format: "esm"
        },

        package.json:
        "module": "dist/bundle.esm.js",
        */
        {
            file: "dist/bundle.umd.js",
            name: "MatchingEngine",
            format: "umd"
        }
    ],
    plugins: [
        resolve(),
        commonjs()
    ]
}
