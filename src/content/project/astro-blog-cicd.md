---
title: "AutoBlog: A CI/CD pipeline with AstroJS, Terraform, GitHub Actions"
pubDate: "February 28 2024"
heroImage: "/blog-images/cloudfront-blog.png"
tags: ["AWS", "CloudFront", "Terraform", "AstroJS", "Github Actions"]
description: "Deploy AWS infrastructure with Terraform and GitHub Actions"
---

## Introduction

This project involves hosting a website in an AWS S3 bucket without enabling the website hosting setting in S3. This might seem counterintuitive but enabling this isn't always the best fit if there's parts of your website you want to keep private or restricted. That's when we can keep the bucket private and take advantage of CloudFront acting like a reverse proxy to restrict access to the bucket with Origin Access Control.

With OAC enabled a user cannot *directly* access objects in the bucket even if they have the link. This means they are forced to go through the CloudFront URL which allows you to enforce more security, caching and other benefits.

## Starting Point

- GitHub account, SSH key added to account, and a new repository
- AWS account with administrator access
- Terraform installed with access to the AWS account
- [nodejs v18+](https://nodejs.org/en/download): AstroJS is a JavaScript framework so you'll want *nodejs v18+* installed. `node -v` to check. [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) is a great tool for installing and switching Node versions.

## Create AWS Infrastructure with Terraform

There should be zero cost associated with this deployment but be sure to `terraform destroy` when you're done since it isn't intended for production use anyway. You can run Terraform locally on any machine where AWS credentials can be provided.

#### Credentials

Do not hard code AWS Access Keys into the Terraform files because Terraform state is stored in plain text. If the code accidentally makes it to a public GitHub repo, there are hackers always running scanners looking for these mistakes.

[Setup the AWS CLI](https://docs.aws.amazon.com/polly/latest/dg/setup-aws-cli.html) and there should be a credentials file in `/home/linuxUsername/.aws/credentials` or `C:\Users\WindowsUsername\.aws\credentials` which lists AWS profiles and their names in brackets like [default], [dev], [prod]. These profile names can be referenced in `providers.tf` or can be commented out if you have a way of providing short term credentials through an IAM role which is an even better option.

#### Default Settings and Customization

You will need to change your GitHub information in `variables.tf` but default settings should work out of the box. If you have already setup OIDC for GitHub see the next few paragraphs about the OIDC options.

In `variables.tf` you can change AWS Region, S3 Bucket name and a few other name settings if you'd like to customize tags. Your Github account name, repository name and branch name **must** be changed in the variable values for Terraform to include them in the IAM Role permissions needed to grant GitHub Actions the ability to put your website's files in S3 and also invalidate CloudFront's cached files after updates.

The variable `enable_openid` is true or false to configure [OpenID Connect](https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/) in your AWS account to setup trust between AWS and GitHub. You can change it to false if your account already has one. OIDC is to establish trust between AWS and GitHub as a way to deliver the IAM Role for short-lived credentials to your AWS account for improved security instead of putting AWS Access Keys into GitHub.

1. Clone the repository with the Terraform files `git clone git@github.com:ryanef/autoblog-infra.git`
2. Change into the directory: `cd autoblog-infra`
3. Initialize Terraform: `terraform init`
4. Run a plan: `terraform plan`
5. Review the plan. There should be 14 resources to create.
6. Apply the plan: `terraform apply`
7. It may take 5-10 minutes because CloudFront Distributions take awhile to create. If successful there should be 5 Terraform Outputs we will use soon:

- **CLOUDFRONT_DOMAIN** = "dzpeir0mwsxzy.cloudfront.net"
  - This is your CloudFront URL accessible through the browser. It's not easy on the eyes but you can easily get your own domain working with it through Route53.

- **CLOUDFRONT_DISTRO_ID** = "E200VV328813"
  - The ID of your CloudFront Distribution. Don't confuse with CLOUDFRONT_DOMAIN later when setting up GitHub Actions secrets  

- **IAM_ROLE_ARN** = "arn:aws:iam::303753793241:role/GitHubActionsRole"
  - Take note of this, it'll also be added to GitHub Actions secrets. It's the IAM Role that gives GitHub Actions permission to upload your blog's files to S3 then invalidate the old CloudFront cache afterwards so your new files will show.

- **S3_BUCKET** = "myBlogBucket1501"
  - This will be entered in GitHub Actions later. If you're not interested in following along with the rest of the guide or just want to make sure everything is working you can upload a simple index.html file to the bucket.

  ```bash
  echo '<html><body><h1>Terraform worked!</body></html>' >> index.html && \
  aws s3 cp index.html s3://myblogproject1236 
  ```
  
  Now you can visit *CLOUDFRONT_URL* in your browser and if it works you should see the "Terraform worked" text. CloudFront expects an index.html to be present in the distribution settings. You can now remove the html file with `aws s3 rm s3://myblogproject1236/index.html`

- **S3_REGIONAL_DOMAIN*** = "myblogproject1236.s3.us-east-1.amazonaws.com"

  Finally you can test if the OAC is working with this. Go to this URL in your browser and you'll get an Access Denied error. If the CloudFront URL works but going to the S3 URL is blocked, you've successfully setup OAC.

## Setup AstroJS

AstroJS is a lightweight JavaScript framework that's pretty great for content driven sites.

If you have `node v18+` and `npm` installed:

1. Install Astro: `npm create astro@latest`
    - Installation will have a few questions. I named mine 'autoblog-astro' and went with default settings on the rest.

2. Change into the installed project directory: `cd autoblog-astro`

3. Start the development server: `npm run dev`
    - If you get an error, you may need to run `npm install` before `npm run dev`
    - If dev server starts, you should see a URL like `http://localhost:4321`

4. If you want to make some changes go to `/src/pages/`
    - `index.astro` is where you can make main page edits on the default template installation
    - `index.astro` becomes index.html in the build phase so CloudFront will be able to find it in S3

When you're done editing it's time to push to GitHub. Astro has great [docs](https://docs.astro.build/en/getting-started/) if you want to learn more about it.

## Deploy to AWS with GitHub Actions

Earlier when you ran Terraform it output the *IAM ROLE ARN*, *CLOUDFRONT_DISTRO_ID*, *S3_BUCKET* values and we need to use those soon. You can run the `terraform output` command from the directory where your `.tf` files are located to see them again.

#### Create a workflow.yml file

**In your Astro project folder:**

1. Make a folder named `.github`
   - Don't forget the *.* in the folder name. Keep in mind this folder is different than your `.git` folder as well. Both should be located in the root of your Astro project.
2. Inside of `.github`, make another folder named `workflows`
3. Create a file named `workflow.yml`
4. Copy my workflow file from Github
   - [https://github.com/ryanef/autoblog-astro/blob/main/.github/workflows/workflow.yml](https://github.com/ryanef/autoblog-astro/blob/main/.github/workflows/workflow.yml)

You can copy and paste the workflow.yml entirely, just make sure you have the `.github` folder in the root directory of your Astro project.

#### Add Secrets to GitHub Actions

To keep things simple we'll add a few secrets manually but some of this could be automated as well because Terraform already puts these in Parameter Store.

1. Make a new GitHub repository if you don't have one already and go to the *repository's* settings
    - Make sure you're in GitHub repository settings, not your GitHub account settings
2. Go to `Secrets and Variables` on the left sidebar and go into `Actions`
    - `https://github.com/YourAccountName/autoblog-astro/settings/secrets/actions`
3. Add the secrets names *exactly* as shown to match the default workflow.yml config:
   - IAM_ROLE
   - S3_BUCKET
   - CF_DISTRO_ID

#### Push to Git 

The workflow.ym is configured to wait for updates to the main branch so after you push changes to main, GitHub Actions will deploy your site to the infrastructure we made with Terraform

In the root of your Astro project directory:

```bash
git init
git remote add origin git@github.com:YOUR_GITHUB_ACCOUNT/autoblog-astro.git
git branch -M main
git add .
git commit -m "first"
git push origin main
```

`Now go to your Actions page at https://github.com/yourAccount/repoName/actions/` and you should see the job has automatically started.

When it says job is completed you can go to your CloudFront URL and see the Astro deployment is live and running.

That's it! Now every time you push code to the `main` branch, GitHub Actions detects and deploys.

If you get any errors about assuming a web identity with the OIDC role, double check `variables.tf` and make sure you put the right GitHub account name, repository name and branch name. The AWS IAM ROLE needs that information to be correct to grant permissions.

## Technical Considerations

Enabling static website hosting for an S3 bucket enables HTTP website endpoints and this gives some extra features such as support for redirects. This is why things automatically work if you upload file structure like this:

```bash
index.html
blog/my-first-post/index.html
blog/mysecond-post/index.html
store/index.html
```

However, in our case, we do *not* have static website hosting enabled so CloudFront will make calls to S3 over the REST API instead of the HTTP endpoints. Let's say your website is `example.com` then CloudFront will be able to find `https://example.com/index.html` if you tell it to look for a root object called `index.html`, *but* that's the only setting you can configure.

If a user tries to go to `https://example.com/blog/my-first-post/index.html` and doesn't have HTTP endpoints enabled, a REST API looking for an S3 object with the key `https://example.com/blog/my-first-post/index.html` and of course that does not exist because the S3 key is actually just the `/blog/...` part. Read more about [differences between REST and HTTP endpoints](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteEndpoints.html#WebsiteRestEndpointDiff) in the AWS Docs.

When configuring a CloudFront distribution to serve files from an S3 bucket, it wants to know if the origin is an *S3 Origin* or *Custom Origin*. If an S3 bucket has static website hosting enabled it is considered a custom origin, not S3 origin.

In 2022, AWS introduced **Origin Access Control(OAC)** and it became the recommendation over **OAI** for using an S3 Bucket as a static website but also keeping the ability to restrict user access to objects in the bucket. You may find older guides referencing OAIs but stick with OAC when possible.