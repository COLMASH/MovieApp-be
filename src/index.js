const { ApolloServer, AuthenticationError } = require('apollo-server-lambda')
const typeDefs = require('./graphQL/schema')
const resolvers = require('./graphQL/resolvers')
const connectDB = require('./config/db')
const jwt = require('jsonwebtoken')
const AWS = require('aws-sdk')
require('dotenv').config({ path: 'variables.env' })

const secretsmanager = new AWS.SecretsManager()
AWS.config.update({ region: `${process.env.AWS_REGION}` })

connectDB()

const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {
        const token = req.headers['authorization'] || ''
        if (token) {
            try {
                const secretWordSecretArn = process.env.SECRET
                const secretsmanagerResponse = await secretsmanager
                    .getSecretValue({ SecretId: secretWordSecretArn })
                    .promise()
                const secretWordSecret = await secretsmanagerResponse
                const secretString = JSON.parse(secretWordSecret.SecretString)
                const user = jwt.verify(token.replace('Bearer ', ''), secretString['movie-app-secret-word'])
                if (!user) {
                    throw new Error('User not found')
                } else {
                    return { user }
                }
            } catch (error) {
                throw new AuthenticationError(`context: authentication was not successful -> ${error}`)
            }
        }
    }
})

// server.listen().then(({ url }) => console.log(`Server ready in URL: ${url}`))

module.exports.handler = server.createHandler({
    cors: {
        origin: '*',
        credentials: true
    }
})
