#Installation
##npm
```
npm install credy-check-client
```
##yarn
```
yarn add credy-check-client
```

#Usage
For complete code examples see `requester-example.js` and `responder-example.js`.

Start by importing and configuring.
```
import credyCheckClient from 'credy-check-client'

const client = credyCheckClient({
  clientId: '' // Provided by Credy
  clientSecret: '' // Provided by Credy
})
```
To use the production API, set your `NODE_ENV` environment variable to `production`.
To use the staging API, don't set `NODE_ENV` or set it to anything other than `production`.

##Responding to other requesters
###Generate keys and send public key
You should now set up a web server to listen for requests on a previously negotiated URL.

`client.sendKey` expects the request POST data as an object and a customer data callback URL.

`client.sendKey` returns a `Promise`.

###Send customer data
Your web server should be listening for requests on the URL set as the callback URL for `client.sendKey`.

`client.sendCustomerData` expects the customer request POST data as an object and a callback function.
The callback function is called with the customer's perosnal id once the request is decrypted.
In the callback function you are expected to return a `Promise` that will resolve with the customer's data as an object.

`client.sendCustomerData` returns a `Promise`.

##Requesting data
###Start session
`client.startSession` expects a callback URL which will be used to notify when a session is ready.

`client.startSession` returns a `Promise`.

###Session callback
Your web server should be listening for requests on the URL set as the callback URL for `client.startSession`.
The request POST data is required for the next request.

###Get customer history
`client.getCustomerHistory` expects the session callback POST data as an object,
a callback URL which will be used to get the data about the customer
and the personal id of the customer.

`client.getCustomerHistory` returns a `Promise`.

###Customer history callback
Your web server should be listening for requests on the URL set as the callback URL for `client.getCustomerHistory`.
The request POST data contains the customer's data.
