import localhost from "./environment/localhost.js"

const env = process.env.ENV || "prod"

let config = localhost;

export { env, config }
