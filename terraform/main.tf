# =============================================================================
# BookMyEnv - Main Terraform Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# -----------------------------------------------------------------------------
# Local Values
# -----------------------------------------------------------------------------

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  account_id  = data.aws_caller_identity.current.account_id
  region      = data.aws_region.current.name

  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
  })
}

# -----------------------------------------------------------------------------
# VPC Module
# -----------------------------------------------------------------------------

module "vpc" {
  source = "./modules/vpc"

  name_prefix          = local.name_prefix
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  tags                 = local.common_tags
}

# -----------------------------------------------------------------------------
# Secrets Manager
# -----------------------------------------------------------------------------

module "secrets" {
  source = "./modules/secrets"

  name_prefix = local.name_prefix
  db_username = var.db_username
  db_password = var.db_password
  jwt_secret  = var.jwt_secret
  tags        = local.common_tags
}

# -----------------------------------------------------------------------------
# RDS PostgreSQL Database
# -----------------------------------------------------------------------------

module "rds" {
  source = "./modules/rds"

  name_prefix              = local.name_prefix
  vpc_id                   = module.vpc.vpc_id
  private_subnet_ids       = module.vpc.private_subnet_ids
  db_instance_class        = var.db_instance_class
  db_allocated_storage     = var.db_allocated_storage
  db_name                  = var.db_name
  db_username              = var.db_username
  db_password              = var.db_password
  db_multi_az              = var.db_multi_az
  db_deletion_protection   = var.db_deletion_protection
  db_backup_retention      = var.db_backup_retention_period
  allowed_security_groups  = [module.ecs.ecs_security_group_id]
  tags                     = local.common_tags
}

# -----------------------------------------------------------------------------
# Application Load Balancer
# -----------------------------------------------------------------------------

module "alb" {
  source = "./modules/alb"

  name_prefix       = local.name_prefix
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  certificate_arn   = var.certificate_arn
  tags              = local.common_tags
}

# -----------------------------------------------------------------------------
# ECR Repository
# -----------------------------------------------------------------------------

resource "aws_ecr_repository" "backend" {
  name                 = "${local.name_prefix}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = local.common_tags
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# ECS Fargate Cluster and Service
# -----------------------------------------------------------------------------

module "ecs" {
  source = "./modules/ecs"

  name_prefix                   = local.name_prefix
  vpc_id                        = module.vpc.vpc_id
  private_subnet_ids            = module.vpc.private_subnet_ids
  alb_target_group_arn          = module.alb.target_group_arn
  alb_security_group_id         = module.alb.security_group_id
  ecr_repository_url            = aws_ecr_repository.backend.repository_url
  ecs_cpu                       = var.ecs_cpu
  ecs_memory                    = var.ecs_memory
  ecs_desired_count             = var.ecs_desired_count
  ecs_min_count                 = var.ecs_min_count
  ecs_max_count                 = var.ecs_max_count
  health_check_grace_period     = var.ecs_health_check_grace_period
  enable_container_insights     = var.enable_container_insights
  log_retention_days            = var.log_retention_days
  secrets_arn                   = module.secrets.secrets_arn
  database_host                 = module.rds.db_endpoint
  database_name                 = var.db_name
  jwt_expires_in                = var.jwt_expires_in
  rate_limit_window_ms          = var.rate_limit_window_ms
  rate_limit_max_requests       = var.rate_limit_max_requests
  frontend_url                  = var.domain_name != "" ? "https://${var.domain_name}" : "https://${module.cloudfront.distribution_domain_name}"
  tags                          = local.common_tags

  depends_on = [module.rds, module.alb]
}

# -----------------------------------------------------------------------------
# S3 Bucket for Frontend
# -----------------------------------------------------------------------------

module "s3_frontend" {
  source = "./modules/s3"

  name_prefix = local.name_prefix
  bucket_name = "${local.name_prefix}-frontend-${local.account_id}"
  tags        = local.common_tags
}

# -----------------------------------------------------------------------------
# CloudFront Distribution
# -----------------------------------------------------------------------------

module "cloudfront" {
  source = "./modules/cloudfront"

  providers = {
    aws = aws.us_east_1
  }

  name_prefix           = local.name_prefix
  s3_bucket_domain_name = module.s3_frontend.bucket_regional_domain_name
  s3_bucket_id          = module.s3_frontend.bucket_id
  alb_dns_name          = module.alb.alb_dns_name
  domain_name           = var.domain_name
  certificate_arn       = var.certificate_arn
  tags                  = local.common_tags
}

# Update S3 bucket policy with CloudFront OAI
resource "aws_s3_bucket_policy" "frontend" {
  bucket = module.s3_frontend.bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontAccess"
        Effect    = "Allow"
        Principal = {
          AWS = module.cloudfront.origin_access_identity_arn
        }
        Action   = "s3:GetObject"
        Resource = "${module.s3_frontend.bucket_arn}/*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Route 53 DNS Records (Optional)
# -----------------------------------------------------------------------------

resource "aws_route53_record" "main" {
  count = var.create_dns_records && var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = module.cloudfront.distribution_domain_name
    zone_id                = module.cloudfront.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  count = var.create_dns_records && var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = "www.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.domain_name]
}
