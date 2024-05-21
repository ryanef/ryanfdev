---
title: "AWS Fargate Networking and Deployment Optimization with Terraform"
pubDate: "March 29 2024"
heroImage: "/blog-images/ecsterraform.jpg"
tags: ["Fargate", "Networking", "Docker", "Terraform", "ECS"]
description: "Create a VPC, split the network into public and private subnets and create the IAM Roles and Security Groups needed to begin taking a look at the networking options available for Fargate. Also take a look at different optimization, logging and monitoring settings."
---
## AWS Fargate Terraform Module

## On This Page

- [Introduction](#introduction)
- [Setup Demo App](#test-demo-locally)
- [Quick Start Deploy with Terraform](#clone-the-terraform-project)
- [Logging and Monitoring](#monitoring)
- [Change Network Settings](#change-networking-details)
- [Optimization Settings](#optimization-settings)

## Introduction

This Fargate module allows you to experiment with different networking options like VPC Endpoints and NAT Gateway for Fargate tasks running in private or public subnets.  Also, there's some flexibility in settings for the Application Loadbalancer, Target Groups, Listeners, Health Checks, etc.

This isn't intended for production use but for optimizing and testing. Finding the optimal settings can really speed up your container deployments. AutoScale will be in an upcoming version.

You can add your own images and try deployments with a NAT Gateway or using VPC Endpoints. Easily modify container names and ports, alter health check settings, Target Group deregistration delay, etc. The VPC and networking is created automatically with no configuration required on your end but also customizable.

For a deeper dive into these networking modes read <a href="https://ryanf.dev/blog/aws-fargate-networking-options-for-tasks-in-private-subnets" target="_blank">this blog</a> I posted that covers some of the differences.

My <a href="https://registry.terraform.io/modules/ryanef/vpc/aws/latest" target="_blank">VPC</a> and <a href="https://registry.terraform.io/modules/ryanef/loadbalancer/aws/latest" target="_blank">LoadBalancer</a> modules are required for the networking. They are imported from Terraform Registry in `network.tf` in the root of this module.

For tasks you want to keep in private subnets, you can use either VPC Endpoints or NAT Gateway. They can be enabled in `variables.tf`

To demonstrate this I've put together 2 images that can be used in Fargate Task Definitions. If you want to follow along you'll need Docker, Terraform, node18+, Python 3.10 and an AWS account with administrator access.

## Setup Demo App

You can use your own images these are just samples for demonstration.

### React and NGINX Image - <a href="https://github.com/ryanef/frontend-ecs-project" target="_blank">(link)</a>

NGINX serves the static React files and configured to handle the client side routing. Also in `nginx.conf` is a proxy_pass to */api* and the AWS CloudMap DNS resolver ```169.254.169.253``` so services can communicate via names like http://frontend:3000 and http://backend:5000

### FastAPI Backend Image - <a href="https://github.com/ryanef/backend-ecs-project" target="_blank">(link)</a>

FastAPI with only a root `/` and `/api` route setup for responses to frontend API calls.

## Test Demo Locally

### Clone the frontend project files

```bash
git clone git@github.com:ryanef/frontend-ecs-project.git

cd frontend-ecs-project

# if you want to test locally before buiding images

npm install
npm run dev
```

When dev server starts in the CLI you should see a link like `http://localhost:5142` to open in your browser. If the React app loads, build the image and push to ECR.

### Build Docker Images and Push to Elastic Container Registry

Make one ECR Repository for the frontend image and one for the backend image. Making a repository in AWS Console only takes a few seconds and they'll give you exact commands to copy and paste to push.

In the example below my ECR Repository is named "reactdevtest" for the frontend and "backenddevtest" for the backend image

Docker or Docker Desktop must be running and AWS CLI must be installed. Use push commands from ECR console or modify these with your REGION and AWS Account Number:

```bash
aws ecr get-login-password --region REGION | docker login --username AWS --password-stdin ACCOUNTNUMBER.dkr.ecr.REGION.amazonaws.com

docker build -t reactdevtest -f Dockerfile.prod .

docker tag reactdevtest:latest ACCOUNTNUMBER.dkr.ecr.REGION.amazonaws.com/reactdevtest:latest

docker push ACCOUNTNUMBER.dkr.ecr.REGION.amazonaws.com/reactdevtest:latest
```

### Clone backend project files

Put these in an entirely different directory than the frontend files or your image sizes will be huge.

```bash
git clone git@github.com:ryanef/backend-ecs-project.git

cd backend-ecs-project

# if you want to test locally 
# i recommend making a python virtual environment

python3 -m venv venv

source venv/bin/activate

pip install -r requirements.txt

uvicorn app.main:app --port 5000
```

If it works, follow the same ECR Push instructions as the frontend. If you're using the same names as the guide then be sure to replace `reactdevtest` with `backenddevtest` in the docker build commands.

## Create Fargate Infrastructure with Terraform

### Clone the Terraform project

[Github Repository link](https://github.com/ryanef/terraform-aws-fargate)

```bash
git clone http://github.com/ryanef/terraform-aws-fargate

cd terraform-aws-ecs

terraform init

terraform plan
```

`variables.tf` and look for `use_nat_gateway` or `use_endpoints` and change the value to true for which one you want to use.

### Settings to Change before Terraform Apply

Go to `variables.tf` and update `frontend_image` and `backend_image` with your ECR Repository URIs. If using VPC Endpoints, the ECR Repository must be private. AWS does not support public repositories with ECR's interface endpoints.  

Enable NAT Gateway or VPC Endpoints by changing the default values of `use_endpoints` and `use_nat_gateway` to true. The variables for vpc_name and environment are used to name resources and tag them.

You will have to make sure Terraform has authentication to AWS. If you're in an environment where you've setup AWS access already then you shouldn't need to take any extra steps for this.  <a href="https://registry.terraform.io/providers/hashicorp/aws/latest/docs" target="_blank">AWS Provider Docs</a> shows the steps Terraform takes to look for AWS credentials. Don't hard code your AWS Access Keys into anything but you can go to `providers.tf` and add `shared_credentials_file` or the `profile` which you can see in the AWS Provider docs.

## Terraform Apply

After adjusting settings and adding your ECR image URIs you're ready to apply. It'll take a few minutes since it is creating about 50 resources.

```bash
terraform apply
```

When it is done, it'll output the DNS address for the loadbalancer and you can visit that address in your browser. You may get a 503 error the first minute or so while the tasks finish launching. After the web application loads, try clicking "Profile" on the navigation menu and see if you get a message from the Python backend. If you see "error in profile" displayed on the page, it's possible the backend container needs a few more seconds to setup.

## Monitoring

VPC Flow Logs, ECS Service and ECS Tasks are all using CloudWatch Logs and can be found with names like `vpcName-environment-*`. The Application Loadbalancer does not have logging enabled but if you wish to do that it will require making an S3 Bucket. X-Ray will be optional in a future version.

## Change Networking Details

If you want to change the default VPC CIDR or add more subnets, go to `variables.tf` and you'll see a networking section at the bottom. Refer to the README.MD for a full list of possible subnets that can be used with the default `10.10.0.0/20` CIDR.

## Add your own ECS Services / Task Definitions

Go to `locals.tf` and you'll see a locals block for the services and the default `frontend` and `backend`. To add more, simply add new blocks and change the values to your image link, container name, container port, etc. There's also a locals block for `target_groups` and you may need to change the port numbers to match your container ports.

## Optimization Settings

### Application Loadbalancer

Most of these can be changed in the `locals.tf` file where the ECS Services and Target Group settings are. The file name is beside the variable names. You may want different settings for different services so keeping them flexible in these locals blocks seems best for now.

`healthy_threshold` - **locals.tf**

**HealthyThresholdCount**: Number of consecutive passing health checks before a target is considered healthy. This is an ALB setting but ECS does check this as a consideration of container health.

**Default**: 5

**Range**: 2-10

----

`unhealthy_threshold` - **locals.tf**

**UnhealthyThresholdCount**: Number of consecutive failed health checks before target is marked unhealthy.

**Default**: 2

**Range**: 2-10

----

`interval` - **locals.tf**

**HealthCheckIntervalSeconds**: The time in seconds between each attempt at a health check.

**Default**: 30 seconds for *ip* and *instance* targets

**Range**: 5–300 seconds

----

`timeout` - **locals.tf**

**HealthCheckTimeoutSeconds**: Time in seconds that no response from a target means the health check has failed.

**Default**: 5 seconds for *ip* or *instance* targets

**Range**: 2-120 seconds

----

`deregistration_delay` - **locals.tf**
  
**AWS Default**: 300 seconds,
**Script Default**: 60 seconds

**Range**: 0-3600 seconds

Running containers are "registered" with the Application Loadbalancer's `target groups` which track the IP address and health of targeted containers. When a target is deregistered, that probably means you stopped it on purpose or it errored and crashed. The ALB will stop sending traffic to that target, but there's a concept of `Keep-Alive` in HTTP traffic where the ALB will leave existing connections open for a period of time so users with any in-flight requests don't get suddenly interrupted. ECS will wait on this deregistration_delay time before it forces the container process to be terminated. Most people can significantly lower this unless they have processes or users doing things like large file uploads or some other type of streaming connection.