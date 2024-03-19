---
title: "AWS Cognito: User Pools, Identity Pools and App Clients"
pubDate: "February 15 2024"
heroImage: "https://ryanf.dev/blog-images/aws-cognito.jpg"
tags: ["Terraform", "AWS", "Cognito"]
description: "A high level overview of AWS Cognito as an authentication and authorization service. AWS Cognito is an identity management platform for web and mobile applications for registering users, authentication and authorization."
---

AWS Cognito is an identity management platform for web and mobile applications for registering users, authentication and authorization.  Not only does it support the common scenario of client side user registration and signing in everyone is familiar with but machine to machine authentication is possible with server side resources. 

AWS Cognito really does a lot so it can be overwhelming but this series will start with a high level overview then jump into the deep end with the Terraform and React application provided.

**Terminology Reminder:**

**Authentication**: The process of verifying your identity. The most common example is username and password.  

**Authorization:** Manage your access to services. You've proven who you say you are so now you have access to specific resources, such as a GetItem call on DynamoDB to retrieve profile information in the database.

### The Two Faces of AWS Cognito

Cognito is one service but when you open it in the AWS console you'll be presented with two options:

#### User Pools

This is a user directory that provides extra layers of security and identity federation. If your User Pool authentication is successful you get a JSON Web Token(JWT) in return that can be accepted directly by AWS API Gateway but most AWS services cannot accept JWT tokens. For *most* AWS services, you need to exchange your JWT for AWS credentials. User Pools do not grant you access to most AWS services but they do give you many ways to authenticate with registration, login, social media logins, multi-factor authentication and more. 

#### Identity Pools

These are how you get temporary AWS credentials for authorization to access AWS services by defining permissions on the policies attached to IAM roles.  Federated identities are available through Google, Facebook, User Pool and more. Identity Pools can support dealing with unauthenticated users as well.

Identity Pools will have to be configured to support tokens from one of the external identity providers(e.g. Google, Facebook, or **User Pools**!) but once an authenticated token is provided, Cognito will assume an IAM Role and retrieve temporary access credentials. The credentials will authorize the application to get the resources it needs such as getting a user's pictures from an S3 bucket or their profile information from DynamoDB.  The application gets the permissions the IAM role has and because of this, no access keys or credentials have to be hardcoded in the application or elsewhere.

User Pools and Identity Pools are completely independent of each other and you can choose to use only one or you can use both together. Remember that User Pools *authenticate* and in return you receive a JWT(JSON Web Token) but **most** AWS services will not accept JWTs for access to the service. Now remember that Identity Pools are how you get *authorization* to most AWS services because Identity Pools can exchange a JWT for temporary access credentials. 

When I say most AWS services will not accept JWTs, there is one notable exception with AWS API Gateway and that will be explored later as well. 

#### User Pool App Clients

App clients in a User Pool are where authentication flow, access tokens and scope settings are configured. You can create multiple app clients in one User Pool. Perhaps you would want different app clients with different access token expiration settings based on how the user logged in.

Mentioned earlier, Cognito can be public facing for users registering on your application or it can be server-side with machine talking to machine.  If you plan on using Cognito for a user on a mobile application or web browser, generally speaking you should *not* check "Generate a client secret" when you first make the app client.

### Cognito in Action - How to Use It

There are many ways to implement Cognito in an application ranging from official AWS services like Amplify, AWS SDKs or third party solutions like NextAuth.

#### Amplify

Some may not want to use Amplify at first glance but it's worth noting you don't have to fully opt-in to the Amplify ecosystem and use things like Amplify UI libraries or Amplify CLI. You can install [Amplify Auth](https://www.npmjs.com/package/@aws-amplify/auth) on its own. It's straight forward to setup Amplify for your existing resources for either client side or server side authentication. The [AWS Docs](https://docs.amplify.aws/javascript/build-a-backend/auth/enable-sign-up/ ) have great examples

[amazon-cognito-identity-js](https://www.npmjs.com/package/amazon-cognito-identity-js) is what Amplify uses under the hood so if Amplify Auth still isn't suitable then try this for more flexibility and smaller bundle sizes than Amplify itself. There are great examples on the amazon-cognito-identity-js homepage.

#### Hosted UI Domains

Cognito also offers **Hosted UI Domain** with  OAuth 2.0 authorization. This is fairly flexible as well in the way that it lets you use an AWS hosted domain or your own custom domain. If using a custom domain then the responsibility is on you for setting up DNS and an SSL certificate.

#### AWS SDKs

[AWS SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/cognito-identity-provider/) is another option for either client-side or server-side authentication. The SDKs are available in many languages such .NET, C++, PHP, Python, Ruby, Go, JavaScript and more.