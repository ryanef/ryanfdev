---
title: "AWS Elastic Container Service Overview"
pubDate: "January 30 2024"
heroImage: "https://ryanf.dev/blog-images/ecs-fargate.png"
image: "https://ryanf.dev/blog-images/ecs-fargate.png"
description: "Elastic Container Service lets you manage containerized applications at scale on AWS with several cluster modes and pricing options.  Here's a quick refresher to go along with the ECS project."
tags: ["Terraform", "ECS", "Docker"]
---


## ECS Clusters

Elastic Container Service uses the concept of clusters and they run in two modes:**Fargate** or **EC2 Mode**. Just like any other orchestrated environment you may be familiar with a cluster is a set of servers where there's a main server often called a *control plane* with *worker nodes*. ECS is a fully managed system so let's take a quick glance at what it provides.

There's a *cluster manager* -- a backend service responsible for keeping track of your container's `state`. A company may have hundreds or thousands of containers running on any given day, so keeping track of their state(memory, cpu, networking info, storage volumes, etc...) is critical. ECS uses a key-value store to track information about your containers and through the use of an `agent` which is a lightweight program written in Go installed automatically on every EC2 instance, ECS can orchestra and schedule your containers in an organized way. As you can imagine, state can conflict at times and ECS deals with this through the use of optimistic concurrency which has been a way to get lower latency and high availability because the writes aren't being blocked.

**EC2 Mode** will provision regular EC2 instances in a VPC of your choice. These instances are just like any other EC2 Instance, you will be expected to manage them and pay for the instance's running time. EC2 Mode can be a great compromise if you want to keep control over the container's hosts but also pass off some of the container management responsibility to ECS. It's important to remember you'll still be paying for the EC2 hosts even if your containers aren't running.

Fargate mode still operates in a VPC and much of the surrounding technology is the same but there's less admin overhead since you won't be managing the EC2 instances yourself. Fargate tasks are injected into the VPC you choose and given an Elastic Network Interface(ENI) which means it can now get an IP address plus security groups. Fargate is running on a shared infrastructure so you only pay for the resources used when the containers run.

## Task Definitions

Tasks are an instantation of a task definition. A task definition lets you define the launch type(EC2, Fargate or External), CPU, Memory, Storage, Container Definitions, Security Groups, Network Mode and much more. Some things are required and some are optional depending on the launch type you choose.

A task definition can have one or multiple container definitions. Since a task can have multiple containers it will be important to think about the hard limits set by your CPU and Memory in the Task Definition.

## Container Definitions

Even though Container Definitions are nested inside a Task Definition, they are technically different things. A good way to understand this is by looking at how two containers defined in one Task Definition have to share the hard limit of CPU and Memory resources set by the Task Definition:

### Example Task Definition with 2 nested Container Definitions

This is just a sample Task Definition to make a point, see [AWS Docs](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definitions) for full examples.

```bash
{  # TASK DEFINITION

  "launchType": "FARGATE",
  "memory": "4096", # Task Definition sets hard limit on memory
  "cpu": "2048", # Task Definition sets hard limit on cpu
  
  "container_definitions": [

    { # The First Container Definition
      "name": "frontend-react-app",
      "image": "node",
      "memory": "2048", # Container Definition allocating a portion of Task Definition's hard limit 
      "cpu": "1024" # Container Definition allocating a portion of Task Definition's hard limit 
    }, 

    { # The Second Container Definition
      "name": "backend-python",
      "image": "python",
      "memory": "1934", # Notice the strange numbers
      "cpu": "999"  # Notice the strange numbers
    }
 ]
}
```

Notice how `backend-python` container definition is using some strange numbers for memory and CPU. The only reason I did that is to drive home the point these numbers represent `CPU Units` which is just some standard measuring unit Amazon uses. If an instance has `1 vCPU` that is equivalent to 1024 CPU Units and `2 vCPU` would be 2048 CPU Units.

## Task Role

This is a role the task can assume and the container will be able to access AWS resources based on the permissions policy attached to the Task Role. The Task Role is also defined in the Task Definition.

## ECS Service

If you want your ECS deployment to be highly available or scalable that's done by configuring a **service definition**. You can deploy a loadbalancer to sit in front of the service and distribute traffic among the tasks. When using a loadbalancer, it would have a security group that allows incoming traffic from the public and your ECS Task security group would only accept traffic from the loadbalancer. The loadbalancer would be in a public subnet while the tasks stay in a private subnet.

## Container Communication and Networking

When making a Task Definition you'll choose between `host`, `bridged` or `awsvpc` for the networking mode. Going with `awsvpc` is common since this is how you get an Elastic Network Interface(ENI) and therefore many of the same security features you get with EC2 Instances. Remember with EC2 instances, security groups and IP addresses are on the ENI, not the instance itself. With EC2 Instances you can detach an ENI and move it to another instance but detaching is not allowed with ECS Tasks.

Going back to the example above with two containers in one task, `frontend-react` and `backend-python`, let's say we put those in `awsvpc` networking mode. How do they talk? Easy! They can simply talk to each other over `localhost` - no further configuration needed. 

Maybe you don't want your containers to be in the same task. If `frontend-react` and `backend-python` are in the same task, you could run into problems independently scaling and maintaining them. It could be a good idea to put them in entirely different services but how would they talk then? `Service Discovery` and `Service Connect` are two options that use `AWS CloudMap` in different ways.

`Service Discovery` relies on resolving DNS names through the VPC and `Service Connect` is making API calls directly to CloudMap and looking for an IP address of a healthy instance. Service Connect is the newer of the two and is actually creating and managing a "sidecar" proxy that promises to be faster during failover than Service Discovery. You can read more about the differences in this [AWS Blog](https://aws.amazon.com/blogs/aws/new-amazon-ecs-service-connect-enabling-easy-communication-between-microservices/) from November 2022.