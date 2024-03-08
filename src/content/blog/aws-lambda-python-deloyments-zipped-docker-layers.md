---
title: "AWS Lambda Python Deployments: Zipped, Layers, Docker Containers"
pubDate: "January 27 2024"
heroImage: "https://ryanf.dev/blog-images/aws-lambda-python.png"
tags: ["aws", "lambda", "python", "terraform"]
description: "AWS Lambda Python deployments can get a little tricky sometimes if you're using dependencies, but one of these options should cover just about any use case."
---

This article is a primer for anyone interested in using the Terraform scripts and code provided in this --project link--.  The scripts give you the option to deploy Lambda functions in three different ways so this is a high level overview of why you may choose one over the others. 

### On this page

- Zipped Deployments
- Lambda Layers
- Lambda Docker Containers
- Python subprocess and sys modules

## Zipped Lambda Deployments

This is the original and still great way to do Lambda deployments. It's a straight forward process where you zip the function code plus any of its dependencies into a compressed file and upload the zip directly to Lambda or put it in an S3 bucket.

Zipped deployments have a file size limitation of 50MB for the compressed zip file and 250MB uncompressed. This is *usually* okay since Lambdas are intended to be focused, short running functions with a maximum execution time of 15 minutes. 

### For many use cases you can do a zipped deployment with dependencies like this

#### Create a Python virtual environment and activate it

```bash
python3 -m venv venv
source ./venv/bin/activate
```

#### Install dependencies

```bash
pip install -r requirements.txt
```

#### Zip the *site-packages* folder that was created in the virtual environment folder

```bash
zip lambda.zip -r ./venv/lib/python3.10/site-packages/
```

#### Add the lambda function python file 

```bash
zip lambda.zip lambda_function.py
```

#### Upload the zip to Lambda or S3 Bucket

This can work well until you install libraries like Pandas that are using extensions made in C or C++ which are compiled languages. That means Pandas isn't a pure Python library and a package manager like pip that installs Pandas will also need to compile the C code that Pandas uses.  The issue is the development environment may be a different operating system or architecture than the Lambda's execution environment in AWS. Your Lambda functions will likely be running on *Amazon Linux 2* or the newer *Amazon Linux 2023*. 

```bash
{
 "errorMessage": "Unable to import module 'lambda_function': Unable to import required dependencies:\nnumpy: No module named 'numpy'\npytz: No module named 'pytz'",
}
```

There are several ways around this. An obvious one is using Lambda layers which will be discussed later in this article. You could also download the wheels file for the Python library and try this:

```bash
# this example is for x86_64 architecture. 
#  for arm64 you need to change --platform to _aarch64
pip install \
    --platform manylinux2014_x86_64 \
    --target=package \
    --implementation cp \
    --python-version 3.10 \
    --only-binary=:all: --upgrade \
    pandas
```

At the end of the article I'll show a few other ways to install libraries that shouldn't be used in production but still an interesting look around the Lambda execution environment using Python's subprocess and sys modules. 

You can find more information in the [AWS docs](https://docs.aws.amazon.com/lambda/latest/dg/python-package.html) where they provide more examples and best practices.

## Lambda Layers

Lambda layers are also zip files but they do not contain the function's code. Layers are for dependencies, custom runtimes and configuration files. Let's say you use Pandas in 3 different functions, instead of deploying each function with Pandas in the zip, you could create a layer and share the layer among your functions. This drastically reduces deployment file size for functions and can help eliminate the problem zipped deployments have with compiled code.

When Lambda pulls in a layer, it extracts the libraries to the /opt directory of the function's execution environment so even though layers externalize the packages, you can import and use them just like a regular zipped deployment.

### Making a Lambda layer for Python will usually go like this

#### Make a virtual environment and activate it

```bash
python3 -m venv venv
source ./venv/bin/activate
#### Install dependencies
```bash
pip install -r requirements.txt
```

#### Deactivate the virtual environment

```bash
deactivate
```

#### Make a new directory so files can be copied into it

```bash
mkdir -p python/lib/python3.10/site-packages
```

#### Copy the venv's installed dependencies into the new directory

```bash
cp -r venv/lib/python3.10/site-packages/* python/lib/python3.10/site-packages
```

#### Zip and upload to Lambda or S3

```bash
zip lambda_layer.zip ./python/lib/python3.10/site-packages
```

## Lambda Docker Container Images

Lambda has supported container images since 2020 and has gotten some interesting performance upgrades since its initial release. This [2023 UseNix talk]([https://www.youtube.com/watch?v=Wden61jKWvs]) from Marc Brooker goes into detail on how they've used lazy loading, deduplication and other techniques to achieve up to 15x faster cold start times while having 10gb max image size.

As Mark says in the UseNix speech, they are leaning into the fact many people are re-using the same set of base images like Ubuntu, Alpine or Nginx and a majority of what's uploaded are bit-for-bit identical. Since they're so similar they can break these up into encrypted chunks and store them in S3 as an address store to be used by Lambda workers later.

Lambda with containers also gives the benefit of being able to do testing earlier in the deployment process that is more in line with what most CI/CD pipelines are using. Local testing was another challenge Lambda developers faced but now a Lambda runtime API can be included in the image and get access to the Lambda Runtime Interface Emulator(RIE) to use during the CI/CD build process. AWS base images come with RIE included.

#### Sample Dockerfile for AWS Lambda container image

```bash
FROM public.ecr.aws/lambda/python:3.10

ENV  AWS_LAMBDA_FUNCTION_TIMEOUT=60

COPY requirements.txt ${LAMBDA_TASK_ROOT}

RUN pip install -r requirements.txt

COPY lambda_function.py ${LAMBDA_TASK_ROOT}

CMD [ "lambda_function.handler" ]
```

### Lambda Docker Python deployment process

This process is using an [AWS base image](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html) and may be different for custom images.

#### Find an AWS base image for Python or make your own

[AWS Base Images Link](https://gallery.ecr.aws/lambda/python)

**Python3.10 on ECR**:
```bash
public.ecr.aws/lambda/python:3.10-x86_64
```
#### Make a Dockerfile in root directory of Lambda function

- Build and run the Dockerfile locally  to make sure it works

```bash
docker build --platform linux/amd64 -t docker-image:test .  

docker run --platform linux/amd64 -p 9000:8080 docker-image:test 
```

#### Curl the running container

```bash
curl "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{}'
```

#### Kill container

```bash
docker ps
docker kill [container id]
```

#### Login to Elastic Container Registry

```bash
aws ecr get-login-password \
--region us-east-1 | docker login --username AWS --password-stdin 111122223333.dkr.ecr.us-east-1.amazonaws.com
```

#### Create a repository in ECR

```bash

aws ecr create-repository \
--repository-name mylambdarepo \
--region us-east-1 --image-scanning-configuration scanOnPush=true \ --image-tag-mutability MUTABLE 
```

#### Copy *repositoryURI* of the output from the command above

```bash
 # REPLACE ACCOUNT ID AND REGION
"repositoryUri": "111122223333.dkr.ecr.us-east-1.amazonaws.com/mylambdarepo"  
```

#### Tag the Docker image with the *repositoryUri*

```bash
docker tag docker-image:test 111122223333.dkr.ecr.us-east-1.amazonaws.com/mylambdarepo:latest
```

#### Push the image to ECR

```bash
docker push 111122223333.dkr.ecr.us-east-1.amazonaws.com/mylambdarepo:latest
```

#### Create an Execution Role for the Lambda [AWS docs](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-awscli.html#with-userapp-walkthrough-custom-events-create-iam-role)

```bash
aws iam create-role \
 --role-name docker-lambda \
 --assume-role-policy-document '{
    "Version": "2012-10-17","Statement": 
    [{ "Effect": "Allow", "Principal": 
    {"Service": "lambda.amazonaws.com"}, 
    "Action": "sts:AssumeRole"}]}'
```

#### Attach the managed AWS Execution Policy to the role

```bash
aws iam attach-role-policy \ 
    --role-name docker-lambda \
    --policy-arn \
    arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 
```
#### Zip the lambda_function.py file 

```bash
zip function.zip lambda_function.py
```

#### Create Lambda Function use the ARN from the Execution Role 

```bash
aws lambda create-function \
--function-name docker-lambda \
--package-type Image \
--code ImageUri=111122223333.dkr.ecr.us-east-1.amazonaws.com/mylambdarepo:latest \
--role arn:aws:iam::111122223333:role/lambda-ex
```

#### Finally, time to invoke the function

```bash 
aws lambda invoke --function-name hello-world response.json
```

If everything went according to plan the response you see should look like this:

```bash
{
    "StatusCode": 200,
    "ExecutedVersion": "$LATEST"
}
```

If you don't get a 200 StatusCode then double check the values you entered above match your AWS account ID, function name, role name and region.

## Exploring Lambda Execution Environment

I mentioned earlier this is a look at using *subprocess* and *sys* modules to install dependencies with Python code. It's really slow and not recommended but just a way to 

```python
import os
import sys
import subprocess

subprocess.call('pip install yfinance -t /tmp/ --no-cache-dir'.split(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

sys.path.insert(1, '/tmp/')

import yfinance as yf

def lambda_handler(event, context):

    msft = yf.Ticker('MSFT')

    print(msft)    
```

The above example works but is actually so slow you have to increase the default Lambda timeout to 30 seconds or it fails.  Instead of doing the subprocess.call() and doing the install from the code, you could also do your *pip install* locally like you normally would into *--target ./package* and use `sys.path.insert(1, './package')` at the top of your Python file. Again, this shouldn't really be done for any other reason to poke around Lambda out of curiosity.
