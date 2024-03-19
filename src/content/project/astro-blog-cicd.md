---
title: "AutoBlog: A CI/CD pipeline with AstroJS, Terraform, GitHub Actions"
pubDate: "February 28 2024"
heroImage: "/blog-images/aws-oac-cf-s3.png"
tags: ["AWS", "CloudFront", "Terraform", "AstroJS", "Github Actions"]
description: "Deploy AWS infrastructure with Terraform and GitHub Actions"
---

## Introduction

This project is about hosting a website in an AWS S3 bucket without enabling the website hosting setting in S3. That sounds couterintuitive but to use that setting your bucket must be made public and sometimes that's what you want but maybe you only want *some* parts of your website to have public access. That's when we can take advantage of CloudFront acting like a reverse proxy to restrict access to the bucket with Origin Access Control.

<img src="/blog-images/aws-oac-cf-s3.png" alt="CloudFront OAC S3 Diagram" />

The user cannot *directly* access objects in the bucket even if they have the link which adds security and other benefits that can be enforced through CloudFront. This means you can force all your website's traffic through the CloudFront distribution URL and get additional caching options, security benefits and control over website content.

## Starting Point

To follow along you will need a new Github repository, an AWS account with administrator access and a basic familiarity with Terraform.

## Deploy Infrastructure to AWS

There should be zero cost associated with this deployment but be sure to `terraform destroy` when you're done since it isn't intended for production use anyway. You can run Terraform locally or any machine where AWS credentials can be provided.

#### Credentials

Do not hard code AWS Access Keys into the Terraform files because Terraform state is stored in plain text so don't do it even for testing and development. If the code accidentally makes it to a public GitHub repo, there are hackers always running scanners looking for these mistakes. [Setup the AWS CLI](https://docs.aws.amazon.com/polly/latest/dg/setup-aws-cli.html) and there should be a credentials file in `/home/linuxUsername/.aws/credentials` or `C:\Users\WindowsUsername\.aws\credentials` which lists AWS profiles and their names in brackets like [default], [dev], [prod]. These can be referenced in `providers.tf` or can be commented out if you have a way of providing short term credentials through an IAM role which is an even better option.

1. Clone the repository with the Terraform files `git clone git@github.com:ryanef/autoblog-infra.git`
2. Change into the directory: `cd autoblog-infra`
3. Initialize Terraform: `terraform init`
4. Run a plan: `terraform plan`
5. Review the plan. There should be 12 resources to create.
6. Apply the plan: `terraform apply`
7. If successful there should be 4 Terraform Outputs:

  - IAM ROLE ARN: Keep note of this we will use it later for giving GitHub Actions access to upload the website files
  - S3_BUCKET: The name of the S3 Bucket where the website files are stored
  - CLOUDFRONT_DOMAIN: This is the CloudFront URL to access the website. It isn't pretty but you can add your own domain with Route 53.

## Considerations

Enabling static website hosting for an S3 bucket enables HTTP website endpoints and this gives some extra features such as support for redirects. This is why things automatically work if you upload file structure like this:

```bash
index.html
blog/my-first-post/index.html
blog/mysecond-post/index.html
store/index.html
```

If you do *not* have static website hosting enabled CloudFront will make calls to S3 over the REST API instead of the HTTP endpoints. Let's say your website is `example.com` then CloudFront will be able to find `https://example.com/index.html` if you tell it to look for a root object called `index.html`, *but* that's the only setting you can configure. If a user tries to go to `https://example.com/blog/my-first-post/index.html` and doesn't have HTTP endpoints enabled, a REST API looking for an S3 object with the key `https://example.com/blog/my-first-post/index.html` and of course that does not exist because the S3 key is actually just the `/blog/...` part. Read more about [differences between REST and HTTP endpoints](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteEndpoints.html#WebsiteRestEndpointDiff) in the AWS Docs.

When configuring a CloudFront distribution to serve files from an S3 bucket, it wants to know if the origin is an *S3 Origin* or *Custom Origin*. If an S3 bucket has static website hosting enabled it is considered a custom origin, not S3 origin.

In 2022, AWS introduced **Origin Access Control(OAC)** and it became the recommendation over **OAI** for using an S3 Bucket as a static website but also keeping the ability to restrict user access to objects in the bucket.
