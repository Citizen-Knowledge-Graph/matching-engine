import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"

export default {
    input: "src/index.js",
    output: [
        {
            file: "dist/bundle.cjs.js",
            format: "cjs"
        },
        {
            file: "dist/bundle.esm.js",
            format: "esm"
        },
        {
            file: "dist/bundle.umd.js",
            name: "MyHelloWorldLib",
            format: "umd"
        }
    ],
    plugins: [
        resolve(),
        commonjs()
    ]
}
