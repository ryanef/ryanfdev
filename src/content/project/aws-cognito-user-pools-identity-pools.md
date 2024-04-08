---
title: "Authentication with AWS Cognito and Terraform"
pubDate: "February 8 2024"
heroImage: "/blog-images/cognito-api-gw2.png"
tags: ["AWS", "Cognito", "Terraform", "React", "DynamoDB"]
description: A full stack application deployed in a serverless architecture created with Terraform that uses AWS Cognito, Lambda, DynamoDB 
---

CognitoApp is a great way to begin demystifying the AWS Cognito service with customizable Terraform scripts and React application for experimenting with the changes.

To follow along it's assumed you have the following:
- Terraform 
- Node18+
- An AWS Account with AdministratorAccess

AWS Services created by Terraform:

- Cognito - The AWS authentication and authorization service
- DynamoDB - A database table for creating a user profile upon registration confirmation
- Lambda - The serverless function that Cognito triggers for inserting the initial user's registration information into the DynamoDB table.
- S3 - Static file hosting for React app files
- CloudFront - CDN for serving the S3 hosted React app
- Parameter Store - Secrets storage

Tech Stack:
- Terraform
- AWS Serverless architecture 
- React 18 using React Router 6