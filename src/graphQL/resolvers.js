const { AuthenticationError, ApolloError } = require('apollo-server')
const User = require('../models/user')
const Favorite = require('../models/favorite')
const bcryptjs = require('bcryptjs')
const jwt = require('jsonwebtoken')
const axios = require('axios')
require('dotenv').config({ path: 'variables.env' })

const createToken = (userExists, secret, expiresIn) => {
    const { id, name, lastName, email } = userExists
    return jwt.sign({ id, name, lastName, email }, secret, { expiresIn })
}

const resolvers = {
    Query: {
        getUser: async (_, { token }) => {
            try {
                const userId = await jwt.verify(token, process.env.SECRET)
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
                const response = await axios.get(
                    `http://www.omdbapi.com/?s=${title}&page=${page}&apikey=${process.env.OMDB_API_KEY}`
                )
                const { totalResults } = response.data
                const movies = response.data.Search
                return { movies, totalResults: parseInt(totalResults) }
            } catch (error) {
                throw new ApolloError(`getGeneralMoviesInfo: ${error}`)
            }
        },
        getDetailedFavoriteInfo: async (_, { input }, context) => {
            if (!context.user) {
                throw new AuthenticationError('Authentication was not successful')
            }
            const { title, page } = input
            try {
                const response = await axios.get(
                    `http://www.omdbapi.com/?s=${title}&page=${page}&apikey=${process.env.OMDB_API_KEY}`
                )
                const movies = response.data.Search
                const finalMovies = []
                for (let movie of movies) {
                    const response = await axios.get(
                        `http://www.omdbapi.com/?i=${movie.apiId}&apikey=${process.env.OMDB_API_KEY}`
                    )
                    const { Plot, Actors, Ratings } = response.data
                    const Rating = Ratings[0].Value || 'No Rating Available'
                    const actorsArray = Actors.split(',').map(name => name.trim())
                    movie = { ...movie, Plot, Actors: actorsArray, Rating }
                    finalMovies.push(movie)
                }
                return finalMovies
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
                return {
                    token: createToken(userExists, process.env.SECRET, '24h')
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
