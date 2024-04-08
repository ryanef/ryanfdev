---
title: "AWS Fargate: Networking Patterns for Fargate Tasks"
pubDate: "March 30 2024"
heroImage: "/blog-images/fargatelogo.png"
tags: ["Fargate", "Networking", "Docker", "ECS"]
description: "AWS Fargate for experimenting with different networking options."
---

## AWS Fargate Networking

AWS Fargate is a "serverless compute engine" for ECS or EKS and as the name suggests it is great at reducing overhead for server administration, but the networking is still your responsibility.  When a Fargate task is made, it is injected into a VPC and by default given an Elastic Network Interface(ENI) and a private IP address similar to a regular EC2 Instance. VPCs are isolated private networks by default so the Fargate task isn't going to have internet access until some network changes are made.

Fargate gives you control of where your tasks are launched, meaning you can choose which VPC and any public or private subnet in that VPC. If you launch in a public subnet, you can optionally assign a public IP to the Fargate task. More on that later, but sometimes this is a bad idea. There are ways to stay in a private subnet and get indirect internet access, but that means more resources and expense. All solutions have a trade-off so it's up to you to find the best fit.

Depending on the industry or company you work for, keeping some containers in private subnets is absolutely required and non-negotiable. If the work being done by the container isn't sensitive data then running with a public IP but locked down by security groups could be an option. In this scenario you would create an Internet Gateway(IGW) and in the route table of a public subnet, add a route for internet traffic to target the IGW. Now make an Application Loadbalancer available in those public subnets and adjust the ALB's security group settings to accept HTTP/S traffic from the public internet. Next, go to the security group settings of your Fargate tasks and only allow traffic from the ALB on your container ports.

If your Fargate tasks need to stay in private subnets, you can decide between using a `NAT Gateway` or `VPC Endpoints`.

## NAT Gateway

<img src="/blog-images/natECS.png">

This is probably the most common solution and generally recommended by AWS. NAT Gateways run in a public subnet and get an Elastic IP. Your Fargate tasks can stay in private subnets and those subnet route tables have route entries that send internet traffic to the NAT Gateway. NAT Gateway will then pass the request along to the Internet Gateway and then make sure the response traffic is sent back to the correct server.

That is `Network Address Translation(NAT)`. This is most likely how your devices at home communicate with the world too.  Your home network probably has one public IP address like `72.33.11.99` given by your ISP, but devices around the house will have some private IP address that look like `192.168.22.30` on your phone or `192.168.22.88` on the laptop. When your laptop goes to Netflix.com, Netflix only sees the public IP shared by all your devices, and your home router will use NAT to make sure Netflix's response goes back to the right device.

## VPC Endpoints

There are two types of VPC Endpoints and you'll probably need a combination of both for your Fargate tasks to pull images, get to S3 or push anything to CloudWatch Logs.

`Gateway Endpoints` are objects on your actual route table that you will see as a route entry. There is no extra charge for using S3 Gateway Endpoints.

`Interface Endpoints` are very different. They use ENIs and security groups and plus come with a charge. Whether it's cheaper to use NAT Gateway or VPC Endpoints just depends on how many endpoints you have to make to achieve your goals.

[Interface Endpoint Pricing](https://aws.amazon.com/privatelink/pricing/)
[NAT Gateway Pricing](https://aws.amazon.com/vpc/pricing/)

As you can see, Interface Endpoints and NAT Gateway both charge per hour and per GB of data processed. NAT has more expensive data processing but if you have to make a lot of Interface Endpoints, you could possibly negate the savings. If you inspect your network traffic and notice you have a lot of data going to/from S3, then opt for an S3 Gateway Endpoint since they're free. S3 also has an Interface Endpoint available, so make sure to pick S3 Gateway Endpoint.

### Gateway Endpoints

`com.amazonaws.us-east-1.s3`

S3 Gateway Endpoints are required if you plan for Fargate tasks to pull images from Elastic Container Registry. It seems irrelevant, but under the hood ECR is storing image layers in S3. After creating a Gateway Endpoint, AWS should automatically put a route for the S3 prefix list(pl-63a5400a) in the route table. Your private subnet can now send traffic to this S3 Gateway endpoint and there's no extra configuration needed.

### Interface Endpoints

These Interface Endpoints will let your Fargate tasks connect to ECR and CloudWatch Logs. It's important to note these endpoints only work with *private* ECR repositories. If you try to use public ECR repositories you'll  get errors so look into a [pull through cache](https://docs.aws.amazon.com/AmazonECR/latest/userguide/pull-through-cache.html) method to get around that.

`com.amazonaws.us-east-1.ecr.dkr`

`com.amazonaws.us-east-1.ecr.api`

`com.amazonaws.us-east-1.logs`

Interface Endpoints require security groups to accept inbound HTTPS traffic on port 443 from the VPC's CIDR range. The Interface Endpoints will also need to be associated with the private subnets where your tasks run.

## Application Loadbalancer

If you have multiple Fargate services running on different ports, for example `webapp` running on port 3000 and `backendserver` on port 5000, you can configure Listeners and Target Groups to deal with this. An ALB Listener can listen for incoming HTTP connections on port 80 and forward those to a Target Group that keep track of `webapp` containers running on port 3000. Listeners can have multiple rules, so you could add a second rule that listens for URL *path* requests like `/api/profile`, and forward that traffic to your port 5000 `backendserver` containers.

`AWS Service Connect` is optional but when enabled it makes communication much easier. It uses AWS CloudMap under the hood similar to Service Discovery but they work in different ways. Service Connect is making API calls to get container information instead of DNS queries like Service Discovery. Either way, instead of having to worry about tracking IP addresses of every container, we can give them names and let our applications talk to each other through names like `http://backend:5000`.