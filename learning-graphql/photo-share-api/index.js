// 1. Require 'apollo-server'
const { ApolloServer } = require('apollo-server-express')
const { MongoClient } = require('mongodb')
require('dotenv').config()
const fetch = require("node-fetch");
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
        me: User
        totalPhotos: Int!
        allPhotos(after: DateTime): [Photo!]!
        totalUsers: Int!
        allUsers: [User!]!      
    }

    type AuthPayload {
        token: String!
        user: User!
    }

    # 3. Return the newly posted photo from the mutation
    type Mutation {
        postPhoto(input: PostPhotoInput!): Photo!
        githubAuth(code: String!): AuthPayload!
        addFakeUsers(count: Int = 1): [User!]!
        fakeUserAuth(githubLogin: ID!): AuthPayload!
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
        me: (parent, args, { currentUser }) => currentUser,
        totalPhotos: (parent, args, { db }) =>
            db.collection('photos')
                .estimatedDocumentCount(),

        allPhotos: (parent, args, { db }) =>
            db.collection('photos')
                .find()
                .toArray(),

        totalUsers: (parent, args, { db }) =>
            db.collection('users')
                .estimatedDocumentCount(),

        allUsers: (parent, args, { db }) =>
            db.collection('users')
                .find()
                .toArray()
    },
    Mutation: {
        async postPhoto(parent, args, { db, currentUser }) {

            // 1. If there is not a user in context, throw an error
            if (!currentUser) {
                throw new Error('only an authorized user can post a photo')
            }

            // 2. Save the current user's id with the photo
            const newPhoto = {
                ...args.input,
                userID: currentUser.githubLogin,
                created: new Date()
            }

            // 3. Insert the new photo, capture the id that the database created
            const { insertedIds } = await db.collection('photos').insert(newPhoto)
            newPhoto.id = insertedIds[0]

            return newPhoto

        },
        async githubAuth(parent, { code }, { db }) {
            // 1. Obtain data from GitHub
            let {
                message,
                access_token,
                avatar_url,
                login,
                name
            } = await authorizeWithGithub({
                client_id: '',
                client_secret: '',
                code,
                redirect_uri: 'http://localhost:3000'
            })
            // 2. If there is a message, something went wrong
            if (message) {
                throw new Error(message)
            }
            // 3. Package the results into a single object
            let latestUserInfo = {
                name,
                githubLogin: login,
                githubToken: access_token,
                avatar: avatar_url
            }

            console.log(latestUserInfo)
            // 4. Add or update the record with the new information
            const { ops: [user] } = await db
                .collection('users')
                .replaceOne({ githubLogin: login }, latestUserInfo, { upsert: true })
            // 5. Return user data and their token
            return { user, token: access_token }
        },
        addFakeUsers: async (root, { count }, { db }) => {

            var randomUserApi = `https://randomuser.me/api/?results=${count}`

            var { results } = await fetch(randomUserApi)
                .then(res => res.json())

            var users = results.map(r => ({
                githubLogin: r.login.username,
                name: `${r.name.first} ${r.name.last}`,
                avatar: r.picture.thumbnail,
                githubToken: r.login.sha1
            }))

            await db.collection('users').insert(users)

            return users
        },
        async fakeUserAuth(parent, { githubLogin }, { db }) {

            var user = await db.collection('users').findOne({ githubLogin })

            if (!user) {
                throw new Error(`Cannot find user with githubLogin "${githubLogin}"`)
            }

            return {
                token: user.githubToken,
                user
            }

        }
    },
    Photo: {
        id: parent => parent.id || parent._id,
        url: parent => `/img/photos/${parent._id}.jpg`,
        postedBy: (parent, args, { db }) =>
            db.collection('users').findOne({ githubLogin: parent.userID }),
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
    }),

}

const authorizeWithGithub = async credentials => {
    const { access_token } = await requestGithubToken(credentials)
    const githubUser = await requestGithubUserAccount(access_token)
    return { ...githubUser, access_token }
}

const requestGithubToken = credentials =>
    fetch(
        'https://github.com/login/oauth/access_token',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(credentials)
        }
    ).then(res => res.json())


async function requestGithubUserAccount(token) {
    console.log(token)
    fetch(`https://api.github.com/user`, {
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: token
        }
    })
        .then(res => res.json())
        .catch(error => {
            throw new Error(JSON.stringify(error))
        })

}



async function start() {
    // 2. Call `express()` to create an Express application
    const app = express()
    const MONGO_DB = process.env.DB_HOST
    const client = await MongoClient.connect(
        MONGO_DB,
        { useNewUrlParser: true }
    )


    const db = client.db()

    // const context = { db }

    const server = new ApolloServer({
        typeDefs,
        resolvers,
        context: async ({ req }) => {
            const githubToken = req.headers.authorization
            const currentUser = await db.collection('users').findOne({ githubToken })
            return { db, currentUser }
        }
    })
    server.start().then(res => {
        server.applyMiddleware({ app });
        app.get('/', (req, res) => res.end('Welcome to the PhotoShare API'))
        app.get('/playground', expressPlayground({ endpoint: '/graphql' }))

        // 5. Listen on a specific port
        app.listen({ port: 4000 }, () =>
            console.log(`GraphQL Server running @ http://localhost:4000${server.graphqlPath}`)
        )
    });
}

start();

