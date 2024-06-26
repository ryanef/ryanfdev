---
title: "Terraform and AWS: Create a VPC with High Availability Networking"
pubDate: "Feb 01 2024"
heroImage: "/blog-images/vpcblog.png"
tags: ["AWS", "VPC", "Terraform", "Kubernetes"]
description: "Create a stand alone VPC with already configured ingress and egress networking for deploying highly available servers across multiple private or public subnets."
---

# AWS VPC Terraform Module

## On This Page

- [Introduction](#introduction)
- [Quick Start](#quick-start)
- [Changing Defaults](#changing-defaults)
- [Example Config](#example-vpc)

## INTRODUCTION 

Quickly create a VPC with public and private networking options suitable for Kubernetes clusters, Fargate deployments or any other use case for launching multiple servers across multiple availability zones.

This module is published on <a href="https://registry.terraform.io/modules/ryanef/vpc/aws/latest" target="_blank">Terraform Registry</a> and has default settings that create a VPC with 2 public subnets and 4 private subnets. NAT Gateway and VPC Endpoints are disabled by default but easily changed in `variables.tf`. 

Other modules to go with it but not required are <a href="https://registry.terraform.io/modules/ryanef/loadbalancer/aws/latest" target="_blank">Application Loadbalancer</a>, <a href="https://registry.terraform.io/modules/ryanef/fargate/aws/latest" target="_blank">AWS Fargate</a> modules for deploying containerized applications with private networking using this VPC.

## QUICK START

No inputs required unless you want to change defaults. This will create a VPC named `TF_VPC` in `us-east-1`. The module is hosted on a public Terraform registry so all you have to do to get started is put this in a `main.tf` file and run `terraform init`

```bash
module "vpc" {
  source  = "ryanef/vpc/aws"
  version = "1.3.2"
}
```

An [example](#example-vpc) configuration using more options is at the end of this README

The Github Repo is available <a href="https://github.com/ryanef/terraform-aws-vpc" target="_blank">here</a>.

## NETWORKING DEFAULTS

### INTERNET ACCESS

An Internet Gateway is created by default so anything you create in a public subnet will be able to reach that through settings in the route table.

`NAT Gateway` is optional, you can enable NAT at the `use_nat_gateway` option in *variables.tf* which will also create an Elastic IP.

`VPC Endpoints` are optional and can be changed at `use_vpc_endpoints` in the *variables.tf* file

A VPC Endpoint can either be a `Gateway Endpoint` or `Interface Endpoint` you can see an example in the bottom of *variables.tf*. Also keep in mind VPC Endpoints can cost money like NAT Gateway. Both are options for getting internet traffic to your resources running in private subnets.

## Changing Defaults

Most defaults can be changed in `variables.tf`

### VPC CIDR

The default VPC CIDR is `10.10.0.0/20` and can be changed at variable `"vpc_cidr"`

The subnets are using `/25` which give a total of 32 possible subnets.

**Note about Reserved IP addresses in each subnet:**

- 10.10.0.**0** - the network address
- 10.10.0.**1** - Reserved by AWS - VPC Router
- 10.10.0.**2** - Reserved by AWS - DNS server
- 10.10.0.**3** - Reserved by AWS - future use / spare capacity
- 10.0.0.**255** - Network broadcast address although broadcast is not supported in AWS VPCs.

#### Number of subnets to create

In `variables.tf` there are three variables to change. If you want to add more or less subnets, just add a new CIDR like `10.10.8.0/25` to the list of public or private subnets. I'll add a list of possible compatible /25 subnets at the end of this section.

### PUBLIC SUBNET DEFAULTS

Defaults: `[ "10.10.1.0/25/25", "10.10.3.0/25" ]`

variable `"count_public_cidrs"`

### PRIVATE SUBNET DEFAULTS

Defaults: `[ "10.10.2.0/25", "10.10.4.0/25" ]`

variable `"count_private_cidrs"`

### DATABASE SUBNET DEFAULTS

Defaults: `[ "10.10.10.0/25", "10.10.11.0/25" ]`

variable `"count_database_cidrs"`

With the `10.10.0.0/20` VPC CIDR, there are 32 possible subnets to use. This is a list of possible /25s you can use for public, private and database CIDR variables:

"10.10.0.0/25", "10.10.0.128/25", "10.10.1.0/25", "10.10.1.128/25", "10.10.2.0/25", "10.10.2.128/25", "10.10.3.0/25", "10.10.3.128/25", "10.10.4.0/25", "10.10.4.128/25", "10.10.5.0/25", "10.10.5.128/25", "10.10.6.0/25", "10.10.6.128/25", "10.10.7.0/25", "10.10.7.128/25", "10.10.8.0/25", "10.10.8.128/25", "10.10.9.0/25", "10.10.9.128/25", "10.10.10.0/25", "10.10.10.128/25", "10.10.11.0/25", "10.10.11.128/25", "10.10.12.0/25", "10.10.12.128/25", "10.10.13.0/25", "10.10.13.128/25", "10.10.14.0/25", "10.10.14.128/25", "10.10.15.0/25", "10.10.15.128/25"

## Example VPC

An example showing NAT Gateway enabled,  custom VPC Name and tags. It also adds additional public and private subnets, if you want to add more, pick /25 CIDRs from the list above. The current 

```bash
module "vpc" {
  source  = "ryanef/vpc/aws"
  version = "1.3.2"

  # VPC CIDR
  vpc_cidr = "10.10.0.0/20"
  # public subnets
  count_public_cidrs = ["10.10.1.0/25", "10.10.3.0/25", "10.10.5.0/25", "10.10.7.0/25"]
  # private subnets
  count_private_cidrs = ["10.10.2.0/25", "10.10.4.0/25", "10.10.5/0/25"]
  # database subnets
  count_database_cidrs = ["10.10.10.0/25", "10.10.11.0/25"]

  environment = "production"

  use_nat_gateway = true
  use_vpc_endpoints = false

  vpc_name = "MyNewVPC"
  
}
```
