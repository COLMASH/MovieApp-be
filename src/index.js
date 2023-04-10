const { AuthenticationError } = require('apollo-server')
const { ApolloServer } = require('apollo-server-micro')
const typeDefs = require('./graphQL/schema')
const resolvers = require('./graphQL/resolvers')
const connectDB = require('./config/db')
const jwt = require('jsonwebtoken')
require('dotenv').config({ path: 'variables.env' })

connectDB()

const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
        const token = req.headers['authorization'] || ''
        if (token) {
            try {
                const user = jwt.verify(token.replace('Bearer ', ''), process.env.SECRET)
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

const startServer = server.start()

async function handler(req, res) {
    await startServer
    await server.createHandler({
        path: '/api/graphql'
    })(req, res)
}

module.exports = { handler }
