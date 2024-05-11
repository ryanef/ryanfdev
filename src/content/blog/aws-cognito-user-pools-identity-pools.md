---
title: "AWS Cognito: User Pools, Identity Pools and App Clients"
pubDate: "February 15 2024"
heroImage: "https://ryanf.dev/blog-images/aws-cognito.jpg"
tags: ["Terraform", "AWS", "Cognito"]
description: "A high level overview of AWS Cognito as an authentication and authorization service. AWS Cognito is an identity management platform for web and mobile applications for registering users, authentication and authorization."
---

AWS Cognito is an identity management platform for web and mobile applications for registering users, authentication and authorization.  This service really does a lot so it can be overwhelming when the documentation is lacking details and examples in some of these areas. 

**Authentication**: The process of verifying your identity. The most common example is username and password.  

**Authorization:** Manage your access to services. You've proven who you say you are so now you have access to specific resources, such as a GetItem call on DynamoDB to retrieve profile information in the database.

Cognito is one service with two features that do very different things: [User Pools](#user-pools) and [Identity Pools](#identity-pools).

## User Pools

User Pools are a user directory for web and mobile apps that give many ways of authenticating and authorizing users. If your User Pool authentication is successful you get JSON Web Tokens(JWT) that your application can exchange for access to resources. For *most* AWS services, you need to exchange your JWT for AWS credentials but later we will look at using access tokens with API Gateway.

The access token you get from User Pools is a JSON Web Token(JWT) and has claims about the authenticated user along with a list of scopes you can define. The `userInfo` endpoint is an OIDC endpoint and will respond with user attributes allowed by the openid scope. Your app must collect the tokens from authenticated sessions and add them as bearer tokens to an Authorization header in the request. Configure the authorizer that you configured for the API, path, and method to evaluate token contents. API Gateway returns data only if the request matches the conditions that you set up for your authorizer.

### User Pool App Clients

App clients in a User Pool are where authentication flow, access tokens and scope settings are configured. You can create multiple app clients in one User Pool if you have a reason to do so. An example scenario could be you want different app clients with different access token expiration settings based on how the user logged in.

Mentioned earlier, Cognito can be public facing for users registering on your application or it can be server-side with machine talking to machine.  If you plan on using Cognito for a user on a mobile application or web browser, generally speaking you should *not* check "Generate a client secret" when you first make the app client.

## Identity Pools

These are how you get temporary AWS credentials for authorization to access AWS services by defining permissions on the policies attached to IAM roles.  Federated identities are available through Google, Facebook, User Pool and more. Identity Pools can support dealing with unauthenticated users as well.

Identity Pools will have to be configured to support tokens from one of the external identity providers(e.g. Google, Facebook, or **User Pools**!) but once an authenticated token is provided, Cognito will assume an IAM Role and retrieve temporary access credentials. The credentials will authorize the application to get the resources it needs such as getting a user's pictures from an S3 bucket or their profile information from DynamoDB.  The application gets the permissions the IAM role has and because of this, no access keys or credentials have to be hardcoded in the application or elsewhere.

User Pools and Identity Pools are completely independent of each other and you can choose to use only one or you can use both together. Remember that User Pools *authenticate* and in return you receive a JWT(JSON Web Token) but **most** AWS services will not accept JWTs for access to the service. Now remember that Identity Pools are how you get *authorization* to most AWS services because Identity Pools can exchange a JWT for temporary access credentials.



## Ways to use Cognito

There are many ways to implement Cognito ranging from official AWS services like Amplify, AWS SDKs or third party solutions like NextAuth.

### Amplify

Some may not want to use Amplify just to use Cognito and that's understandable, but it's worth noting you don't have to fully opt-in to the Amplify ecosystem just to use [Amplify Auth](https://www.npmjs.com/package/@aws-amplify/auth). If you're worried about bundle size, pricing or other issues with Amplify you can avoid that completely. It's straight forward to setup Amplify for your existing resources for either client side or server side authentication. The [AWS Docs](https://docs.amplify.aws/javascript/build-a-backend/auth/enable-sign-up/ ) have great examples.

[amazon-cognito-identity-js](https://www.npmjs.com/package/amazon-cognito-identity-js) is what Amplify uses under the hood so if Amplify Auth still isn't suitable then try this for more flexibility and smaller bundle sizes than Amplify itself. There are great examples on the amazon-cognito-identity-js homepage.

### Hosted UI Domains

Cognito also offers **Hosted UI Domain** with  OAuth 2.0 authorization. This is fairly flexible as well in the way that it lets you use an AWS hosted domain or your own custom domain. If using a custom domain then the responsibility is on you for configuring DNS and an SSL certificate.

### AWS SDKs

[AWS SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/cognito-identity-provider/) is another option for either client-side or server-side authentication. The SDKs are available in many languages such .NET, C++, PHP, Python, Ruby, Go, JavaScript and more.