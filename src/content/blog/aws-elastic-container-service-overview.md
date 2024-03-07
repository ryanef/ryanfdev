---
title: "AWS Elastic Container Service Overview"
pubDate: "January 30 2024"
heroImage: "https://loremflickr.com/640/360"
image: "https://loremflickr.com/640/360"
description: "Elastic Container Service lets you manage containerized applications at scale on AWS with several cluster modes and pricing options.  Here's a quick refresher to go along with the ECS project."
tags: ["Terraform", "ECS", "Docker"]
---


## ECS Clusters
With ECS you choose between **Fargate** or **EC2 Mode** that is choosing your cluster mode.

EC2 Mode will provision regular EC2 instances in a VPC of your choice and you will be responsible for managing them yourself.  EC2 Mode provides more options but also comes with more administrative overhead.

In comparison, Fargate you do not manage the EC2 servers and is a "serverless" solution. In Fargate, the tasks will be injected into a VPC and given an Elastic Network Interface(ENI) and the ENI is what gives public IP addressing and lets you configure security groups. 

**Reminder**: In AWS, security groups and IP addresses are not directly on the EC2 instance but instead they are assigned to the ENI that is attached to an EC2 Instance. An ENI can be detached and moved to other instances.

## Task Definitions
These give you the ability to to set information about CPU, Memory, Storage, Container Definitions, Security Groups, Network Mode and more. A task definition can contain one or more container definitions. For example, in one task definition you could have a front-end container defined and a separate database container for storing user information. If containers are defined in the same task, they can communicate with each other across *localhost*. If containers are defined in separate tasks or services, they can still communicate in different ways depending on the network mode chosen.

## Container Definitions
Even though Container Definitions are nested inside a Task Definition, they are technically different things. The container definition is where you choose which ports to expose on the container, where the image is located such as ECR or DockerHub and more options.

## Task Role
This is a role the task can assume and the container will be able to access AWS resources based on the permissions policy attached to the Task Role. The Task Role is also defined in the Task Definition. 

## ECS Service
If you want your ECS deployment to be highly available or scalable that's done by configuring a **service definition**. You can choose to deploy a loadbalancer to sit in front of the service and distribute traffic among the tasks. When using a loadbalancer, its security group would allow incoming public traffic but the ECS security group would only allow incoming traffic from the loadbalancer.
