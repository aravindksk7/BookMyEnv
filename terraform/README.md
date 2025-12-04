# BookMyEnv - AWS Terraform Deployment

This Terraform configuration deploys the BookMyEnv application on AWS using the following architecture:

## Architecture Overview

```
                                    ┌─────────────────┐
                                    │   Route 53      │
                                    │   (DNS)         │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   CloudFront    │
                                    │   (CDN + SSL)   │
                                    └────────┬────────┘
                                             │
                        ┌────────────────────┼────────────────────┐
                        │                    │                    │
               ┌────────▼────────┐  ┌────────▼────────┐          │
               │   S3 Bucket     │  │   ALB           │          │
               │   (Frontend)    │  │   (Backend LB)  │          │
               └─────────────────┘  └────────┬────────┘          │
                                             │                    │
                                    ┌────────▼────────┐          │
                                    │   ECS Fargate   │          │
                                    │   (Backend API) │          │
                                    └────────┬────────┘          │
                                             │                    │
                                    ┌────────▼────────┐          │
                                    │   RDS PostgreSQL│          │
                                    │   (Database)    │          │
                                    └─────────────────┘          │
                                                                  │
                        ┌─────────────────────────────────────────┘
                        │
               All resources in VPC with private subnets
```

## AWS Services Used

| Service | Purpose |
|---------|---------|
| **VPC** | Network isolation with public/private subnets |
| **ECS Fargate** | Serverless container hosting for backend |
| **RDS PostgreSQL** | Managed database |
| **S3** | Static website hosting for frontend |
| **CloudFront** | CDN with SSL/TLS termination |
| **ALB** | Application Load Balancer for backend |
| **ACM** | SSL/TLS certificates |
| **Secrets Manager** | Secure credential storage |
| **CloudWatch** | Logging and monitoring |
| **Route 53** | DNS management (optional) |

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Terraform** >= 1.0 installed
3. **AWS CLI** configured with credentials
4. **Domain name** (optional, for custom domain)

## Quick Start

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

### 2. Configure Variables

Create a `terraform.tfvars` file:

```hcl
# Required
project_name    = "bookmyenv"
environment     = "production"
aws_region      = "us-east-1"

# Database
db_username     = "bookmyenv_user"
db_password     = "YourSecurePassword123!"  # Use Secrets Manager in production

# JWT
jwt_secret      = "your-very-long-random-secret-key-min-32-chars"

# Optional: Custom Domain
# domain_name   = "bookmyenv.example.com"
# certificate_arn = "arn:aws:acm:us-east-1:xxx:certificate/xxx"
```

### 3. Plan and Apply

```bash
# Review the plan
terraform plan

# Apply the configuration
terraform apply
```

### 4. Deploy Application Code

After infrastructure is created:

```bash
# Build and push backend Docker image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker build -t bookmyenv-backend ./backend
docker tag bookmyenv-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/bookmyenv-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/bookmyenv-backend:latest

# Build and deploy frontend
cd frontend
npm run build
aws s3 sync out/ s3://bookmyenv-frontend-<account-id>/
aws cloudfront create-invalidation --distribution-id <dist-id> --paths "/*"
```

## File Structure

```
terraform/
├── README.md               # This file
├── main.tf                 # Main Terraform configuration
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── versions.tf             # Provider versions
├── terraform.tfvars.example # Example variables file
│
├── modules/
│   ├── vpc/               # VPC and networking
│   ├── rds/               # PostgreSQL database
│   ├── ecs/               # ECS Fargate cluster and services
│   ├── alb/               # Application Load Balancer
│   ├── s3/                # S3 bucket for frontend
│   ├── cloudfront/        # CloudFront distribution
│   └── secrets/           # Secrets Manager
```

## Cost Estimation (Monthly)

| Service | Configuration | Estimated Cost |
|---------|---------------|----------------|
| ECS Fargate | 0.5 vCPU, 1GB RAM, 2 tasks | ~$30 |
| RDS PostgreSQL | db.t3.micro, 20GB | ~$15 |
| ALB | Application Load Balancer | ~$20 |
| CloudFront | 100GB transfer | ~$10 |
| S3 | 1GB storage | ~$0.05 |
| Secrets Manager | 2 secrets | ~$1 |
| **Total** | | **~$76/month** |

*Costs vary by region and usage. Use AWS Calculator for accurate estimates.*

## Security Features

- ✅ VPC with private subnets for database and backend
- ✅ Security groups with least-privilege access
- ✅ Encrypted RDS storage
- ✅ SSL/TLS via CloudFront and ACM
- ✅ Secrets stored in AWS Secrets Manager
- ✅ IAM roles with minimal permissions
- ✅ CloudWatch logging enabled

## Scaling Options

### Horizontal Scaling (ECS)

```hcl
# In terraform.tfvars
ecs_desired_count = 3
ecs_max_count     = 10
```

### Vertical Scaling (RDS)

```hcl
# In terraform.tfvars
db_instance_class = "db.t3.medium"
```

### Auto Scaling

Auto Scaling is configured based on CPU utilization:
- Scale out: CPU > 70% for 2 minutes
- Scale in: CPU < 30% for 5 minutes

## Troubleshooting

### ECS Tasks Not Starting

1. Check CloudWatch Logs: `/ecs/bookmyenv-backend`
2. Verify ECR image exists
3. Check security group rules
4. Verify RDS connectivity

### Database Connection Issues

1. Ensure ECS security group can reach RDS
2. Check RDS is in the same VPC
3. Verify database credentials in Secrets Manager

### Frontend Not Loading

1. Check S3 bucket policy
2. Verify CloudFront origin configuration
3. Check CloudFront invalidation status

## Destroying Infrastructure

```bash
# Remove all resources
terraform destroy

# Note: RDS has deletion protection enabled by default
# Disable it first or use:
terraform destroy -target=module.rds
```

## Support

For issues and feature requests, please open an issue on the GitHub repository.

---

**Version:** 3.0.0  
**Last Updated:** December 2025
