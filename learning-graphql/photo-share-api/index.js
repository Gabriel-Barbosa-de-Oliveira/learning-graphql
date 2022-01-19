// 1. Require 'apollo-server'
const { ApolloServer } = require('apollo-server-express')
const express = require('express')
const expressPlayground = require('graphql-playground-middleware-express').default

const { GraphQLScalarType } = require('graphql')

const typeDefs = `
    # 1. Add Photo type definition
    scalar DateTime

    type User {
        githubLogin: ID!
        name: String
        avatar: String
        postedPhotos: [Photo!]!
        inPhotos: [Photo!]!
    }

    enum PhotoCategory {
        SELFIE
        PORTRAIT
        ACTION
        LANDSCAPE
        GRAPHIC
    }

    type Photo {
        id: ID!
        url: String!
        name: String!
        description: String
        category: PhotoCategory!
        postedBy: User!
        taggedUsers: [User!]!
        created: DateTime!
    }

    input PostPhotoInput {
        name: String!
        category: PhotoCategory=PORTRAIT
        description: String
    }

    # 2. Return Photo from allPhotos
    type Query {
        totalPhotos: Int!
        allPhotos(after: DateTime): [Photo!]!
    }

    # 3. Return the newly posted photo from the mutation
    type Mutation {
        postPhoto(input: PostPhotoInput!): Photo!
    }
`

var _id = 0
var tags = [
    { "photoID": "1", "userID": "gPlake" },
    { "photoID": "2", "userID": "sSchmidt" },
    { "photoID": "2", "userID": "mHattrup" },
    { "photoID": "2", "userID": "gPlake" }
]
var photos = [
    {
        "id": "1",
        "name": "Dropping the Heart Chute",
        "description": "The heart chute is one of my favorite chutes",
        "category": "ACTION",
        "githubUser": "gPlake",
        "created": "3-28-1977"
    },
    {
        "id": "2",
        "name": "Enjoying the sunshine",
        "category": "SELFIE",
        "githubUser": "sSchmidt",
        "created": "1-2-1985"
    },
    {
        id: "3",
        "name": "Gunbarrel 25",
        "description": "25 laps on gunbarrel today",
        "category": "LANDSCAPE",
        "githubUser": "sSchmidt",
        "created": "2018-04-15T19:09:57.308Z"
    }
]
var users = [
    { "githubLogin": "mHattrup", "name": "Mike Hattrup" },
    { "githubLogin": "gPlake", "name": "Glen Plake" },
    { "githubLogin": "sSchmidt", "name": "Scot Schmidt" }
]

const serialize = value => new Date(value).toISOString()

const resolvers = {
    Query: {
        totalPhotos: () => photos.length,
        allPhotos: () => photos
    },
    Mutation: {
        postPhoto(parent, args) {
            // 2. Create a new photo, and generate an id
            var newPhoto = {
                id: _id++,
                ...args.input,
                created: new Date()
            }
            photos.push(newPhoto)
            // 3. Return the new photo
            return newPhoto
        }
    },
    Photo: {
        url: parent => `http://yoursite.com/img/${parent.id}.jpg`,
        postedBy: parent => {
            return users.find(u => u.githubLogin === parent.githubUser)
        },
        taggedUsers: parent => tags
            // Returns an array of tags that only contain the current photo
            .filter(tag => tag.photoID === parent.id)

            // Converts the array of tags into an array of userIDs
            .map(tag => tag.userID)

            // Converts array of userIDs into an array of user objects
            .map(userID => users.find(u => u.githubLogin === userID))
    },
    User: {
        postedPhotos: parent => {
            return photos.filter(p => p.githubUser === parent.githubLogin)
        },
        inPhotos: parent => tags
            // Returns an array of tags that only contain the current user
            .filter(tag => tag.userID === parent.id)

            // Converts the array of tags into an array of photoIDs
            .map(tag => tag.photoID)

            // Converts array of photoIDs into an array of photo objects
            .map(photoID => photos.find(p => p.id === photoID))
    },
    DateTime: new GraphQLScalarType({
        name: 'DateTime',
        description: 'A valid date time value.',
        parseValue: value => new Date(value),
        serialize: value => new Date(value).toISOString(),
        parseLiteral: ast => ast.value
    })
}

// 2. Call `express()` to create an Express application
var app = express()

const server = new ApolloServer({ typeDefs, resolvers })
server.start().then(res => {
    server.applyMiddleware({ app });
    app.get('/', (req, res) => res.end('Welcome to the PhotoShare API'))
    app.get('/playground', expressPlayground({ endpoint: '/graphql' }))

    // 5. Listen on a specific port
    app.listen({ port: 4000 }, () =>
        console.log(`GraphQL Server running @ http://localhost:4000${server.graphqlPath}`)
    )
});
