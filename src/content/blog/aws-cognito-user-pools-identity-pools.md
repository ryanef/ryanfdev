---
title: "AWS Cognito: User Pools, Identity Pools and App Clients"
pubDate: "February 15 2024"
heroImage: "https://ryanf.dev/blog-images/aws-cognito.jpg"
tags: ["Terraform", "AWS", "Cognito"]
description: "A high level overview of AWS Cognito as an authentication and authorization service. AWS Cognito is an identity management platform for web and mobile applications for registering users, authentication and authorization."
---

<a href="https://ryanf.dev/projects/cogneato-user-authentication-with-aws-cognito">My Terraform and React projects using Cognito</a>


AWS Cognito is an identity management platform for web and mobile applications for registering users, authentication and authorization. When it comes to price, you get a lot for your money with Cognito but it can be overwhelming in the areas that lack documentation and examples. There's a lot of competition in this space and some offer a better developer experience than Cognito, but when you compare the cost of monthly active users Cognito is usually much cheaper. There can also be benefits beyond the price if your application can benefit from Cognito's integrations with other AWS services.

One reason Cognito confuses people is it's one service with two main features that do very different things: [User Pools](#user-pools) and [Identity Pools](#identity-pools). You can have a User Pool without an Identity Pool and similarly you can have an Identity Pool without a User Pool. You can also integrate them together. Let's look at what they do from a high level and it'll start to make sense.

User Pools are an `identity provider` that **authenticate** the user and Identity Pools **authorize** a user to perform an action, e.g. if your username and password are valid then the application gets temporary credentials to make a database request for that account's information. The separation of these two roles means we can use them together or maybe swap one out with an existing solution. Maybe your company already has an identity provider but just needs temporary credentials to get into a database that runs in AWS, well you'd only need an Identity Pool and not a User Pool. If you only want to rely on social identity federation using Google, Facebook, Twitter, etc. you would also only need to make an Identity Pool.

Of course there's way more to it than that because authentication and authorization is a complex topic. If you're not familiar with how OAuth 2.0 works, you can read my [OAuth Primer for AWS Cognito](http://localhost:4321/blog/an-oauth-20-overview-for-understanding-aws-cognito) blog. Getting familiar with OAuth principles will make Cognito easier to understand since it is an OAuth based service and the separation of roles we've mentioned will also begin to make even more sense.


## User Pools

User Pools are a user directory and give a way for your users to register an account then later authenticate their identity in some way . If your User Pool authentication is successful you get JSON Web Tokens(JWT) that your application can exchange for access to resources. For *most* AWS services, you need to exchange your JWT for AWS credentials but later we will look at using access tokens with API Gateway.

The access token you get from User Pools is a JSON Web Token(JWT) and has claims about the authenticated user along with a list of scopes you can define. The `userInfo` endpoint is an OIDC endpoint and will respond with user attributes allowed by the openid scope. Your app must collect the tokens from authenticated sessions and add them as bearer tokens to an Authorization header in the request. Configure the authorizer that you configured for the API, path, and method to evaluate token contents. API Gateway returns data only if the request matches the conditions that you set up for your authorizer.

### User Pool App Clients

App clients in a User Pool are where authentication flow, access tokens and scope settings are configured. You can create multiple app clients in one User Pool if you have a reason to do so. An example scenario could be you want different app clients with different access token expiration settings based on how the user logged in.

Mentioned earlier, Cognito can be public facing for users registering on your application or it can be server-side with machine talking to machine.  If you plan on using Cognito for a user on a mobile application or web browser, generally speaking you should *not* check "Generate a client secret" when you first make the app client.

## Identity Pools

These are how you get temporary AWS credentials for authorization to access AWS services by defining permissions on the policies attached to IAM roles.  Federated identities are available through Google, Facebook, User Pool and more. Identity Pools can support dealing with unauthenticated users as well.

Identity Pools will have to be configured to support tokens from one of the external identity providers(e.g. Google, Facebook, or **User Pools**!) but once an authenticated token is provided, Cognito will assume an IAM Role and retrieve temporary access credentials. The credentials will authorize the application to get the resources it needs such as getting a user's pictures from an S3 bucket or their profile information from DynamoDB.  The application gets the permissions the IAM role has and because of this, no access keys or credentials have to be hardcoded in the application or elsewhere.

User Pools and Identity Pools are completely independent of each other and you can choose to use only one or you can use both together. Remember that User Pools *authenticate* and in return you receive a JWT(JSON Web Token) but **most** AWS services will not accept JWTs for access to the service. Now remember that Identity Pools are how you get *authorization* to most AWS services because Identity Pools can exchange a JWT for temporary access credentials.



## Integrate Cognito In Your Application

There are many ways to implement Cognito in your project ranging from official AWS services like Amplify, AWS SDKs or third party solutions like NextAuth. 

### Amplify

AWS Amplify is a giant ecosystem with a bunch of tools but it's worth noting you can avoid almost all of that and just import Amplify Auth into your app. It's understandable why sometimes people don't want to use it at first, but Amplify lets you use existing resources and if all you want to use is Auth, you can avoid everything else about Amplify. You can see more about using Amplify with existing resources in the  <a href="https://docs.amplify.aws/javascript/build-a-backend/auth/enable-sign-up/" target="_blank">AWS Docs</a>

I have some Terraform modules and React application available <a href="https://ryanf.dev/projects/cogneato-user-authentication-with-aws-cognito">on Cogneato project page</a>. Terraform modules build out everything for AWS and React is using Amplify for client side authentication with the Cognito User Pool id and App Client id. After a user authenticates, the app receives access tokens then makes a call to API Gateway with those tokens. API Gateway uses a Cognito Authorizer to get claims and Cognito user information out of the tokens and passes them to a Lambda function. The Lambda function looks at the JWT claims, finds the user ID created by Cognito, and that ID has an entry as a primary key in the database for its user profile information. Access to the database is restricted by IAM policies only allowing the Lambda function to retrieve items. The Lambda function can only be invoked by the API Gateway method with the Cognito Authorizer. The API Gateway method can only be accessed if there's an access token present in the headers or it returns an error.

#### If you want to avoid importing the AWS Amplify library: 

<a href="https://www.npmjs.com/package/amazon-cognito-identity-js" target="_blank">amazon-cognito-identity-js</a> is what Amplify uses under the hood so if Amplify Auth still isn't suitable then try this for more flexibility and smaller bundle sizes than Amplify itself. Over the years it was merged into the Amplify project but it's still available on its own. There are great examples on the amazon-cognito-identity-js homepage.

### AWS SDKs

<a href="https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/cognito-identity-provider/" target="_blank">The AWS SDKs</a> are another option for either client-side or server-side authentication. The SDKs are available in many languages: NET, C++, PHP, Python, Ruby, Go, JavaScript and more.

### Hosted UI Domains

Cognito also offers **Hosted UI Domain** with  OAuth 2.0 authorization. This is fairly flexible as well in the way that it lets you use an AWS hosted domain or your own custom domain. If using a custom domain then the responsibility is on you for configuring DNS and an SSL certificate.

