---
title: "AWS Fargate Networking Patterns"
pubDate: "March 29 2024"
heroImage: "/blog-images/cloudfront-blog.png"
tags: ["Fargate", "Networking", "Docker", "Terraform", "ECS"]
description: "Launch Fargate services with different networking options for tasks running in private subnets."
---
## AWS Fargate Terraform Module

### On This Page

- [Setup Demo App](#test-demo-locally)

- [Deploy with Terraform](#clone-the-terraform-project)

Use this Fargate module to experiment launching multiple services with NAT Gateway, VPC Endpoints or directly into public subnets. It also uses Service Connect(AWS CloudMap) for service discovery. For a deeper dive into these networking modes read [this blog I wrote](https://ryanf.dev/blog/aws-fargate-vpc-networking) that goes into more detail.

You don't have to include them manually but this uses my [VPC](https://registry.terraform.io/modules/ryanef/vpc/aws/latest) and [Loadbalancer](https://registry.terraform.io/modules/ryanef/loadbalancer/aws/latest) modules for its base networking. They are imported in the `network.tf` in this module.

For tasks you want to keep in private subnets, you can use either VPC Endpoints or NAT Gateway. They can be enabled in `variables.tf`

To demo this I've put together 2 images that can be used in Fargate Task Definitions. If you want to follow along you'll need Docker, Terraform, node18+, Python 3.10 and an AWS account with administrator access.

## Setup Demo App

### Frontend React Image - [(link)](https://github.com/ryanef/frontend-ecs-project) 

Simple React app and NGINX in the same image. NGINX serves the static React files and configured to handle the client side routing. `nginx.conf` also includes a proxy_pass to */api* for API calls to the Python backend and the AWS CloudMap DNS resolver ```169.254.169.253``` so services can communicate via names like http://frontend:3000 and http://backend:5000

### FastAPI Backend Image - [(link)](https://github.com/ryanef/backend-ecs-project)

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

### Variables to Change Before Applying Terraform

Go to `variables.tf` and update `frontend_image` and `backend_image` with your ECR Repository URIs. If using VPC Endpoints, the ECR Repository must be private. AWS does not support public repositories with ECR's interface endpoints.  

Enable NAT Gateway or VPC Endpoints by changing the default values of `use_endpoints` and `use_nat_gateway` to true. The variables for vpc_name and environment are used to name resources and tag them.

You will have to make sure Terraform has authentication to AWS. If you're in an environment where you've setup AWS access already then you shouldn't have to configure anything. If you do, just go to `providers.tf` and check the AWS Providers docs on how to add your credentials file location.

## Terraform Apply

After adjusting settings and adding your ECR image URIs you're ready to apply. It'll take a few minutes since it is creating about 50 resources.

```bash
terraform apply
```

When it is done, it'll output the DNS address for the loadbalancer and you can visit that at http://loadbalancerAddress. You may get a 503 error the first minute or so while the containers get up and running.

