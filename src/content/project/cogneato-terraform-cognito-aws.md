---
title: "Cogneato: User Authentication with AWS Cognito"
pubDate: "February 28 2024"
heroImage: "/blog-images/aws-cognito.png"
tags: ["AWS", "Cognito", "Terraform", "React"]
description: "Deploy AWS infrastructure with Terraform to quickly test and develop AWS Cognito."

---
## Table of Contents

- [Introduction](#introduction)
- [Starting Point](#starting-point)
- [Create AWS Infrastructure](#terraform---create-aws-infrastructure)
- [React Application Setup](#react-application-setup)

## Introduction

Cogneato is a set of Terraform modules bundled with a React application for quickly testing and developing AWS Cognito settings. After user registration and successful authentication, Cognito returns JWT(id and access) tokens so Cogneato is also a way to test different authentication and authorization patterns.

Terraform will create a serverless architecture including CloudFront, API Gateway, 2 Lambda Functions and an S3 Bucket to host the React app. At the moment it only uses Cognito User Pools but I will add in Identity Pools and social support later.

AWS Cognito is a complex service loaded with features, so using Terraform to quickly destroy and create new User Pools can be convenient in development.  For example, some of the user registration attributes are locked in at creation time when you make a User Pool, if you want to change them later, you have to make a new User Pool. With Cogneato's Terraform modules you could quickly destroy your old user pool, go to `cognito/main.tf` and add a new `schema` block for user attributes.

## Starting Point

- **Terraform** installed with access to the AWS account that has administrator access for creating resources
- **[nodejs v18+]**(<a href="https://nodejs.org/en/download">download</a>): Cogneato uses React 18 with React Router 6. `nvm` is a popular node version manager if interested.

## Terraform - Create AWS Infrastructure

The Terraform modules and React app are in the same repository but different directories. This isn't ideal, but fine for this purpose. The Terraform modules are in the infra directory. 

### AWS Credentials

Terraform needs AWS credentials and there are a variety of ways to provide that. If you haven't done that already, read below and view the Terraform AWS provider documentation.

**Do not** hard code AWS Access Keys into the Terraform files since by default Terraform state is stored in plain text.

If necessary, in `infra/providers.tf` you can add `shared_credentials_file` or `profile`. You can see details in the <a href="https://registry.terraform.io/providers/hashicorp/aws/latest/docs" target="_blank">Terraform AWS Provider docs</a>.


1. Clone the <a href="https://github.com/ryanef/terraform-react-cognito" target="_blank">repository</a> with the Terraform files `git clone git@github.com:ryanef/terraform-react-cognito.git`
2. Change into the directory: `cd terraform-react-cognito`
3. Change into the **infra** directory: `cd infra`
4. `terraform init`
5. `terraform plan`
6. `terraform apply`

The CloudFront distribution can take a long time to create, so this may take 5-10 minutes.

### COPY ENVIRONMENT VARIABLES FROM TERRAFORM OUTPUT 

There's a **Bash** script in the `infra` directory named `envvar.sh` that will copy the values of API Gateway URL, Cognito User Pool ID, App Client ID, CloudFront domain URL, S3 Bucket Name, etc and put them in the React app's `.env` file. You can always run the `terraform output` command if you want to manually copy and paste them into `react/.env` and `react/.env.production`.

1. Make the script executable `sudo chmod +x envvar.sh`
2. Run the script: `./envvar.sh`
3. Verify that `react/.env` and `react/.env.production` have been updated

## React Application Setup

From the root of the Cogneato project folder there is an `infra` folder and `react` folder. If you've followed the above environment variable instructions, most of the configuration for a default deployment should be done. We just have to setup React and test it locally.

1. Change into **react** directory: `cd react`
2. Install React and dependencies: `npm install`
3. Run a local web server and test React: `npm run dev`
4. Open the `localhost` link it shows 


#### IMPORTANT

Some browsers will automatically change http://localhost:5173 into http://127.0.0.1:5173. Normally it doesn't matter at all, but in `/react/auth/config.ts` it is configured to use `CookieStorage` by default with **cognitoUserPooolsTokenProvider** and it wants an exact domain match.

Make sure you see **http://localhost:5173** in your browser's URL bar or you will get this error:  `UnexpectedSignInInterruptionException`

## Deploy React App to AWS

There's no fancy CI/CD process for this small project, but all we need to do is upload React's static build files to the S3 bucket made by Terraform.

### From the `/react` directory:


1. Make a production build: `npm run build`
2. Upload **dist** folder to S3: `aws s3 cp --recursive dist/ s3://bucketname`

Terraform keeps the S3 Bucket private so you need to access the React app by going through the CloudFront URL. You can get that from `terraform output` command in the **infra** directory. CloudFront is configured to use an **OAC(Origin Access Controller)** which is how the S3 Bucket can stay private but also serve a public website. The S3 Bucket has a policy to only accept traffic from the CloudFront distribution.

CloudFront has SSL enabled so the React application is now sending encrypted requests.







