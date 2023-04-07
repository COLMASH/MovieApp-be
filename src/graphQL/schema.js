const { gql } = require('apollo-server')

const typeDefs = gql`
    # --------- INPUTS ---------
    input MovieInput {
        title: String!
        page: Int!
    }
    input AuthInput {
        email: String!
        password: String!
    }
    input UserInput {
        name: String!
        lastName: String!
        email: String!
        password: String!
    }
    # --------- TYPES ---------
    type Movie {
        Title: String
        Year: String
        apiId: ID
        Type: String
        Poster: String
        Plot: String
        Actors: [String]
        Rating: String
    }
    type MoviesResult {
        movies: [Movie]
        totalResults: Int
    }
    type Token {
        token: String
    }
    type User {
        id: ID
        name: String
        lastName: String
        email: String
        created: String
    }
    # --------- QUERIES AND MUTATIONS ---------
    type Query {
        # ----- Users -----
        getUser(token: String): User
        # ------ Favorites/Movies -----
        getGeneralMoviesInfo(input: MovieInput): MoviesResult
        getDetailedFavoriteInfo(input: MovieInput): MoviesResult
    }
    type Mutation {
        # ----- Users -----
        newUser(input: UserInput): User
        authUser(input: AuthInput): Token
        # ------ Favorites/Movies -----
        addMovieToFavorites(favoriteId: ID!): String
        removeMovieFromFavorites(favoriteId: ID!): String
    }
`

module.exports = typeDefs
