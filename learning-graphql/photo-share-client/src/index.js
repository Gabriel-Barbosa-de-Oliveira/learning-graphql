import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import ApolloClient, { gql } from 'apollo-boost'
const client = new ApolloClient({ uri: 'http://localhost:4000/graphql' })

const query = gql`
    {
        totalUsers
        totalPhotos
    }
`

client.query({query})
    .then(({ data }) => console.log('data', data))
    .catch(console.error)

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
