import React from 'react'
import { render } from 'react-dom'
import App from './App'
import { ApolloProvider } from 'react-apollo'
import ApolloClient from 'apollo-boost'

const client = new ApolloClient({ uri: 'http://localhost:4000/graphql' })

// const query = gql`
//     {
//         totalUsers
//         totalPhotos
//     }
// `


render(
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>,
  document.getElementById('root')
)

