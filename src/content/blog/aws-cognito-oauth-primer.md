---
title: "An OAuth 2.0 Overview for Understanding AWS Cognito"
pubDate: "February 15 2024"
heroImage: "/blog-images/oauth.png"
tags: ["OAuth", "AWS", "Cognito"]
description: "A high level overview of AWS Cognito as an authentication and authorization service. AWS Cognito is an identity management platform for web and mobile applications for registering users, authentication and authorization."
---

## OAuth 2.0 Introduction

Before diving into Cognito, it's a good idea to go over a few fundamental [OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749) principles. This article will mostly focus on authentication with public web and mobile applications but OAuth and Cognito can also be used for machine-to-machine authentication.

OAuth isn't a service or program you install but think of it is as a standard, or set of rules, for authenticating a user's identity and then authorizing their access to secure resources. If you have a web application where a user needs to enter their password so they can get access to their profile and messages, OAuth 2.0 is a set of security protocols you can follow to make this happen. 

When OAuth is implemented properly, it lets us have a way to access secure resources **without** giving our password to every single one of these resources as proof of identity. Instead we rely on trusted identity providers that authenticate our password and after successful authentication, responds to our device with `access tokens` that our application can now exchange for access to things.  We can then take those tokens and exchange them for access to private resources like a database.  First, let's take a look at the roles defined by the OAuth spec and how they relate to Cognito.

### OAuth 2.0 Roles

#### resource owner
An entity capable of granting access to a protected resource.

#### resource server
The server hosting the protected resource and has the capability to accept and respond to requests when the request has an access token for a protected resource

#### client
The application making protected resource requests e.g. your web/mobile app retrieving information from a database after a user clicks their inbox. A client can be different devices like phone, laptop or even another server. 

#### authorization server
the server that issues the access tokens to the client after a successful authentication. 

Since we know that OAuth 2.0 is a standard anyone can implement, we can now look at how AWS implements this standard by having Cognito be the `authentication server` that issues tokens and Cognito is also the `resource server` because Cognito User Pools store user data in a directory. Your application is the `client` that sends a request and if successfully authenticated will be given different types of `JWT tokens (access, ID, refresh tokens)` that can now be presented as credentials to exchange for access to protected resources like a database.
## Grant Type

This is a term that describes how we are going to grant access tokens to an application(e.g. your web app) after successful user authentication. You can change these settings in your User Pool's `app client` and there are three choices: `authorization code grant, implicit grant, client credentials grant`. 

`client credentials grant's` name can be confusing at first glance, but it is for machine-to-machine access and you *cannot* enable this in a User Pool app client where `authorization` or` implicit grants` are enabled. We won't talk about `client_credentials` much in this article but it's probably the simplest form of OAuth 2.0 implementation. Generally speaking if you want to grant access to a machine, and not a specific user, client_credentials grants might be what you want.

Authorization and Implicit grants start by making a request to the [Authorization endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html)  `/oauth2/authorize`

### Authorization Code Grant

This is the AWS recommended grant for public clients. When the client sends a request to `/oauth2/authorize`  and is successfully authenticated, the authorization server responds with a code that your application can send to the AWS Token Endpoint and exchange the code for access tokens. If your client is a web application that is using server side components, this is a good choice.

A request for an Authorization code grant with PKCE looks like this:

```
GET https://mydomain.auth.us-east-1.amazoncognito.com/oauth2/authorize?response_type=code& client_id=`1example23456789`& redirect_uri=`https://www.example.com`& state=`abcdefg`& scope=aws.cognito.signin.user.admin& code_challenge_method=S256& code_challenge=`a1b2c3d4...`
```

In the URL parameters, `response_type=code` is what makes this an Authorization code grant request. If your username and password authenticates, the authentication server responds with a redirect back to your application and there will be a code in the URL parameters like this:

```
HTTP/1.1 302 Found 
Location: https://`www.yourdomain.com`?code=a1b2c3d4-5678-90ab-cdef-EXAMPLE33311&state=`abcdefg`
```

Now your app takes this code and sends one more request, but this time  to the [Token Endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html)  `/oauth2/token` and if the code is valid the endpoint issues the access tokens, id tokens, refresh tokens. This code is temporary 
### PKCE

[Proof Key for Code Exchange(PKCE)](https://www.rfc-editor.org/rfc/rfc7636)is an extension for Authorization Code grants designed to prevent CSRF and authorization code injection attacks. They are currently considered [best practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics) for SPA and mobile apps. If you want to use PKCE with the Authorization Code grant, [AWS Docs](https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html#using-pkce-in-authorization-code.title) detail how your application can dynamically generate a unique string for the code challenge. 
### Implicit Grant

Implicit grants will also give you the access and id tokens but  not the refresh tokens.  It's no longer considered best practice but years ago this was the recommended pattern for SPA and mobile apps. Implicit grants don't have to make that additional request to the `Token Endpoint` like Authorization Code grants. Implicit grants are considered [legacy](https://docs.aws.amazon.com/cognito/latest/developerguide/federation-endpoints-oauth-grants.html) grants now. Instead of having `response_type=code`, your URL parameters would have `response_type=token`

## Single Page Applications

Single Page Applications are also called browser based apps because ultimately the application's source code is loaded in the browser and runs from there. This means SPAs have no ability at all to maintain client secrets in the same way an application running on a server does. On the surface, SPAs look like any other site to your users but under the hood they function entirely different. 

Over the last few years we've seen popular SPA libraries like React begin to incorporate server side components. For SPAs you would want to look into Authorization Code Grant flows with PKCE and use one of the client side flows mentioned below:

## Authentication Flows

**1.  ALLOW_ADMIN_USER_PASSWORD_AUTH**

Intended for server side authentication flow. Not intended for public client authentication. This flow uses `AdminInitiateAuth` and requires IAM Credentials for `cognito-idp:AdminInitiateAuth` and `cognito-idp:AdminRespondToAuthChallenge`

**2. ALLOW_USER_PASSWORD_AUTH**

Intended for client side authentication flow. When you want to use this, in your `app client` settings **DO NOT** generate a client secret. 

**3. ALLOW_USER_SRP_AUTH**

Intended for client side authentication flow. Similar to ALLOW_USER_PASSWORD_AUTH except it uses the `SRP PROTOCOL` to  verify the password. If you don't want to setup the SRP flow yourself you can import only the auth parts of the AWS Amplify library to your client side code and it has SRP compatibility out of the box. 

**4 ALLOW_CUSTOM_AUTH**

This is for creating your own challenge/response based authentication using AWS Lambda.