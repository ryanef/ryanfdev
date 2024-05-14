---
title: "AWS Lambda Python Deployments: Zipped, Layers, Docker Containers"
pubDate: "January 27 2024"
heroImage: "/blog-images/aws-lambda-python.png"
tags: ["aws", "lambda", "python", "terraform"]
description: "AWS Lambda Python deployments can get a little tricky sometimes if you're using dependencies, but one of these options should cover just about any use case."
---


### On this page

- [Zipped Deployments](#zipped-lambda-deployments)
- [Lambda Layers](#lambda-layers)
- [Lambda Docker Containers](#lambda-docker-container-images)
- [Lambda's Execution Environment](#exploring-lambda-execution-environment)

## Zipped Lambda Deployments

This is the original and still great way to do Lambda deployments. It's a straight forward process where you zip the code plus any of its dependencies, then upload the zip directly to Lambda or put it in an S3 bucket.

Zipped deployments have a file size limitation of 50MB for the compressed zip file and 250MB uncompressed. This is *usually* okay since Lambdas are intended to short running functions with a maximum execution time of 15 minutes. 

You can do a zipped deployment like this:

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

#### Add the lambda function python file to the zip

```bash
zip lambda.zip lambda_function.py
```

#### Upload the zip to Lambda or S3 Bucket

And that's it for zipped deployments. 

**Issues with zipped deployments**:

Let's say you want to use a library like Pandas so you do the usual routine: `pip install pandas` and import it into your Python file, deploy to Lambda and...boo like usual Not all Python libraries are written in pure Python. That sounds weird but some libraries can be made in a compiled language like C. Python itself is not a compiled language but even so, you may have a Python library that needs to be compiled and that's where the problem begins. The issue is the development environment you're coding in may be a different operating system or architecture than the Lambda's execution environment. Your Lambda functions will be running on *Amazon Linux 2* or the newer *Amazon Linux 2023*. When you run into this problem you will see an error message something like this:

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

You can find more information in the [AWS docs](https://docs.aws.amazon.com/lambda/latest/dg/python-package.html) where they provide more examples and best practices.

## Lambda Layers

Lambda layers are also zip files but they do not contain the function's code. Layers are for dependencies, custom runtimes and configuration files. Let's say you use Pandas in 3 different functions, instead of deploying each function with Pandas in the zip, you could create a layer and share the layer among your functions. This drastically reduces deployment file size for functions and can help with the compiled code issue at the same time.

When Lambda pulls in a layer, it extracts the libraries to the **/opt** directory of the function's execution environment so even though layers externalize the packages, you can import and use them just like a regular zipped deployment.

### Making a Lambda layer for Python will usually go like this

#### Make a virtual environment and activate it

```bash
python3 -m venv venv

source ./venv/bin/activate
```

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

Use the sample Dockerfile from above and paste it into a file named `Dockerfile`

#### Build and run the Dockerfile locally to make sure it works

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
--region us-east-1 --image-scanning-configuration scanOnPush=true --image-tag-mutability MUTABLE 
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

This is a look at installing Python packages *after* a Lambda function starts. You will probably never want to do this, but maybe you'll find it interesting anyway. Keep in mind Lambda costs are determined by a combination of: number of executions, the function's duration and memory usage, and data transfer. In the example below I used `yfinance` and it actually takes so long to install you would have to increase Lambda's default timeout to higher than 3 seconds or you get an error. This would be a terrible idea on a function that's regularly used due to Lambda's duration cost but there might be some rare use cases for doing this. Of course if the next Lambda request reuses that environment it won't have the long cold start, but warm starts are not reliable. I'll add more about the Lambda execution lifecycle at the end.

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

### Execution Environment Lifecycle

When a *request* is made to run a Lambda function, AWS creates the `execution environment`, in short this means Lambda downloads your code then allocates some memory and a runtime for the function. Creating this environment takes time and is what's known as the `cold start`. Once a Lambda function has executed and is no longer running, AWS keeps this environment alive for a short amount of time and if another request comes in then it can reuse the environment and avoid a cold start. What happens if multiple requests arrive at the same time? Well, Lambda has to scale up by making multiple execution environments and each one will include a cold start. 