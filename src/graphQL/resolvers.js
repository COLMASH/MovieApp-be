const { AuthenticationError, ApolloError } = require('apollo-server')
const User = require('../models/user')
const Favorite = require('../models/favorite')
const bcryptjs = require('bcryptjs')
const jwt = require('jsonwebtoken')
const axios = require('axios')
const AWS = require('aws-sdk')
require('dotenv').config({ path: 'variables.env' })

const secretsmanager = new AWS.SecretsManager()
AWS.config.update({ region: `${process.env.AWS_REGION}` })

const createToken = (userExists, secret, expiresIn) => {
    const { id, name, lastName, email } = userExists
    return jwt.sign({ id, name, lastName, email }, secret, { expiresIn })
}

const resolvers = {
    Query: {
        getUser: async (_, { token }) => {
            try {
                const secretWordSecretArn = process.env.SECRET
                const secretsmanagerResponse = await secretsmanager
                    .getSecretValue({ SecretId: secretWordSecretArn })
                    .promise()
                const secretWordSecret = await secretsmanagerResponse
                const secretString = JSON.parse(secretWordSecret.SecretString)
                const userId = await jwt.verify(token, secretString['movie-app-secret-word'])
                if (!userId) {
                    throw new Error('User not found')
                }
                return userId
            } catch (error) {
                throw new AuthenticationError(`getUser: ${error}`)
            }
        },
        getGeneralMoviesInfo: async (_, { input }) => {
            const { title, page } = input
            try {
                const apiKeySecretArn = process.env.OMDB_API_KEY
                const secretsmanagerResponse = await secretsmanager
                    .getSecretValue({ SecretId: apiKeySecretArn })
                    .promise()
                const apiKeySecret = await secretsmanagerResponse
                const secretString = JSON.parse(apiKeySecret.SecretString)
                const response = await axios.get(
                    `http://www.omdbapi.com/?s=${title}&page=${page}&apikey=${secretString['movie-app-api-key']}`
                )
                if (response.data.Response === 'False' && response.data.Error === 'Too many results.') {
                    throw new Error(response.data.Error)
                }
                const { totalResults } = response.data
                const moviesRaw = response.data.Search
                let movies = []
                if (moviesRaw) {
                    movies = moviesRaw.map(({ imdbID, ...rest }) => {
                        return {
                            apiId: imdbID,
                            ...rest
                        }
                    })
                }
                return { movies, totalResults: totalResults ? parseInt(totalResults) : null }
            } catch (error) {
                throw new ApolloError(`getGeneralMoviesInfo: ${error}`)
            }
        },
        getDetailedFavoriteInfo: async (_, { favoriteId }, context) => {
            try {
                let favoritesArray = []
                if (favoriteId) {
                    favoritesArray.push({ apiId: favoriteId })
                } else {
                    if (!context.user) {
                        throw new AuthenticationError('Authentication was not successful')
                    }
                    const userId = context.user.id
                    const user = await User.findById(userId).populate({
                        path: 'favorites',
                        populate: { path: 'users', model: 'Favorite' }
                    })
                    favoritesArray = user.favorites
                }
                const apiKeySecretArn = process.env.OMDB_API_KEY
                const secretsmanagerResponse = await secretsmanager
                    .getSecretValue({ SecretId: apiKeySecretArn })
                    .promise()
                const apiKeySecret = await secretsmanagerResponse
                const secretString = JSON.parse(apiKeySecret.SecretString)
                const favorites = []
                for (let favorite of favoritesArray) {
                    const response = await axios.get(
                        `http://www.omdbapi.com/?i=${favorite.apiId}&apikey=${secretString['movie-app-api-key']}`
                    )
                    const { Title, Year, Type, Poster, Plot, Actors, Ratings } = response.data
                    const Rating = Ratings[0].Value || 'No rating available'
                    const actorsArray = Actors.split(',').map(name => name.trim())
                    favorite = { Title, Year, Type, Poster, apiId: favorite.apiId, Plot, Actors: actorsArray, Rating }
                    favorites.push(favorite)
                }
                return { movies: favorites, totalResults: favoritesArray ? favoritesArray.length : null }
            } catch (error) {
                throw new ApolloError(`getDetailedFavoriteInfo: ${error}`)
            }
        }
    },
    Mutation: {
        newUser: async (_, { input }) => {
            const { email, password } = input
            try {
                const userExists = await User.findOne({ email })
                if (userExists) {
                    throw new Error(`User with email ${email} is already registered`)
                }
                const salt = await bcryptjs.genSalt(10)
                input.password = await bcryptjs.hash(password, salt)
                const user = new User(input)
                user.save()
                return user
            } catch (error) {
                throw new ApolloError(`newUser: ${error}`)
            }
        },
        authUser: async (_, { input }) => {
            const { email, password } = input
            try {
                const userExists = await User.findOne({ email })
                if (!userExists) {
                    throw new Error(`User does not exist`)
                }
                const correctPassword = await bcryptjs.compare(password, userExists.password)
                if (!correctPassword) {
                    throw new Error('Password is not correct')
                }
                const secretWordSecretArn = process.env.SECRET
                const secretsmanagerResponse = await secretsmanager
                    .getSecretValue({ SecretId: secretWordSecretArn })
                    .promise()
                const secretWordSecret = await secretsmanagerResponse
                const secretString = JSON.parse(secretWordSecret.SecretString)
                return {
                    token: createToken(userExists, secretString['movie-app-secret-word'], '24h')
                }
            } catch (error) {
                throw new AuthenticationError(`authUser: ${error}`)
            }
        },
        addMovieToFavorites: async (_, { favoriteId }, context) => {
            if (!context.user) {
                throw new AuthenticationError('Authentication was not successful')
            }
            const userId = context.user.id
            try {
                let favorite = await Favorite.findOne({ apiId: favoriteId })
                if (!favorite) {
                    favorite = new Favorite({ apiId: favoriteId })
                    favorite.save()
                }
                const user = await User.findById(userId)
                if (user.favorites.includes(favorite._id)) {
                    return 'Movie already added to favorites'
                } else {
                    await User.updateOne({ _id: userId }, { $addToSet: { favorites: favorite._id } })
                    await Favorite.updateOne({ _id: favorite._id }, { $addToSet: { users: userId } })
                    return 'Movie has been added to favorites'
                }
            } catch (error) {
                throw new ApolloError(`addMovieToFavorites: ${error}`)
            }
        },
        removeMovieFromFavorites: async (_, { favoriteId }, context) => {
            if (!context.user) {
                throw new AuthenticationError('Authentication was not successful')
            }
            const userId = context.user.id
            try {
                const user = await User.findById(userId)
                const favorite = await Favorite.findOne({ apiId: favoriteId })
                if (favorite && user.favorites.includes(favorite._id)) {
                    await User.updateOne({ _id: userId }, { $pull: { favorites: favorite._id } })
                    await Favorite.updateOne({ _id: favorite._id }, { $pull: { users: userId } })
                    return 'Movie has been removed from favorites'
                } else {
                    throw new Error("Movie hasn't been found")
                }
            } catch (error) {
                throw new ApolloError(`removeMovieFromFavorites: ${error}`)
            }
        }
    }
}

module.exports = resolvers
