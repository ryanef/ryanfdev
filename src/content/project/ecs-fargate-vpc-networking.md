---
title: "AWS Fargate Networking Patterns"
pubDate: "March 29 2024"
heroImage: "/blog-images/ecsterraform.jpg"
tags: ["Fargate", "Networking", "Docker", "Terraform", "ECS"]
description: "Launch Fargate services with different networking options for tasks running in private subnets."
---
## AWS Fargate Terraform Module

### On This Page

- [Setup Demo App](#test-demo-locally)

- [Deploy with Terraform](#clone-the-terraform-project)

This Fargate module allows you to experiment with launching multiple services using NAT Gateway, VPC Endpoints, or direct access to public subnets. It also uses Service Connect(AWS CloudMap) for service discovery. For a deeper dive into these networking modes read [this blog](https://ryanf.dev/blog/aws-fargate-vpc-networking) I posted that covers some of the differences.

My [VPC](https://registry.terraform.io/modules/ryanef/vpc/aws/latest) and [Loadbalancer](https://registry.terraform.io/modules/ryanef/loadbalancer/aws/latest) modules are required for the networking. They are imported from Terraform Registry in `network.tf` in the root of this module.

For tasks you want to keep in private subnets, you can use either VPC Endpoints or NAT Gateway. They can be enabled in `variables.tf`

To demonstrate this I've put together 2 images that can be used in Fargate Task Definitions. If you want to follow along you'll need Docker, Terraform, node18+, Python 3.10 and an AWS account with administrator access.

## Setup Demo App

### Frontend - React with NGINX - [(link)](https://github.com/ryanef/frontend-ecs-project) 

NGINX serves the static React files and configured to handle the client side routing. Also in `nginx.conf` is a proxy_pass to */api* and the AWS CloudMap DNS resolver ```169.254.169.253``` so services can communicate via names like http://frontend:3000 and http://backend:5000

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

### Settings to Change before Terraform Apply

Go to `variables.tf` and update `frontend_image` and `backend_image` with your ECR Repository URIs. If using VPC Endpoints, the ECR Repository must be private. AWS does not support public repositories with ECR's interface endpoints.  

Enable NAT Gateway or VPC Endpoints by changing the default values of `use_endpoints` and `use_nat_gateway` to true. The variables for vpc_name and environment are used to name resources and tag them.

You will have to make sure Terraform has authentication to AWS. If you're in an environment where you've setup AWS access already then you shouldn't need to take any extra steps for this.  [AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs) shows the steps Terraform takes to look for AWS credentials. Don't hard code your AWS Access Keys into anything but you can go to `providers.tf` and add `shared_credentials_file` or the `profile` which you can see in the AWS Provider docs.

## Terraform Apply

After adjusting settings and adding your ECR image URIs you're ready to apply. It'll take a few minutes since it is creating about 50 resources.

```bash
terraform apply
```

When it is done, it'll output the DNS address for the loadbalancer and you can visit that address in your browser. You may get a 503 error the first minute or so while the tasks finish launching. After the web application loads, try clicking "Profile" on the navigation menu and see if you get a message from the Python backend. If you say "error in profile", it's possible the backend container isn't totally complete and needs a few more seconds.

## Monitoring

VPC Flow Logs, ECS Service and ECS Tasks are all using CloudWatch Logs and can be found with names like `vpcName-environment-*`. The Application Loadbalancer does not have logging enabled but if you wish to do that it will require making an S3 Bucket.

## Change Networking Details

If you want to change the default VPC CIDR or add more subnets, go to `variables.tf` and you'll see a networking section at the bottom. Refer to the README.MD for a full list of possible subnets that can be used with the default `10.10.0.0/20` CIDR.

## Add your own ECS Services / Task Definitions

Go to `locals.tf` and you'll see a locals block for the services and the default `frontend` and `backend`. To add more, simply add new blocks and change the values to your image link, container name, container port, etc. There's also a locals block for `target_groups` and you may need to change the port numbers to match your container ports.