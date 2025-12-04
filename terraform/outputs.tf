# =============================================================================
# BookMyEnv - Output Values
# =============================================================================

# -----------------------------------------------------------------------------
# VPC Outputs
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.vpc.private_subnet_ids
}

# -----------------------------------------------------------------------------
# Database Outputs
# -----------------------------------------------------------------------------

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_endpoint
}

output "rds_port" {
  description = "RDS instance port"
  value       = module.rds.db_port
}

output "database_name" {
  description = "Database name"
  value       = var.db_name
}

# -----------------------------------------------------------------------------
# ECS Outputs
# -----------------------------------------------------------------------------

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.ecs.service_name
}

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.backend.repository_url
}

# -----------------------------------------------------------------------------
# Load Balancer Outputs
# -----------------------------------------------------------------------------

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.alb_dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = module.alb.alb_zone_id
}

# -----------------------------------------------------------------------------
# S3 Outputs
# -----------------------------------------------------------------------------

output "frontend_bucket_name" {
  description = "Name of the S3 bucket for frontend"
  value       = module.s3_frontend.bucket_id
}

output "frontend_bucket_arn" {
  description = "ARN of the S3 bucket for frontend"
  value       = module.s3_frontend.bucket_arn
}

# -----------------------------------------------------------------------------
# CloudFront Outputs
# -----------------------------------------------------------------------------

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_distribution_domain" {
  description = "Domain name of the CloudFront distribution"
  value       = module.cloudfront.distribution_domain_name
}

output "application_url" {
  description = "URL to access the application"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "https://${module.cloudfront.distribution_domain_name}"
}

# -----------------------------------------------------------------------------
# Secrets Outputs
# -----------------------------------------------------------------------------

output "secrets_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = module.secrets.secrets_arn
}

# -----------------------------------------------------------------------------
# Deployment Commands
# -----------------------------------------------------------------------------

output "deployment_commands" {
  description = "Commands to deploy the application"
  value = <<-EOT

    # ========================================
    # BookMyEnv Deployment Commands
    # ========================================

    # 1. Login to ECR
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.backend.repository_url}

    # 2. Build and push backend Docker image
    cd backend
    docker build -t ${aws_ecr_repository.backend.repository_url}:latest .
    docker push ${aws_ecr_repository.backend.repository_url}:latest

    # 3. Update ECS service to deploy new image
    aws ecs update-service --cluster ${module.ecs.cluster_name} --service ${module.ecs.service_name} --force-new-deployment --region ${var.aws_region}

    # 4. Build frontend for production
    cd frontend
    npm install
    NEXT_PUBLIC_API_URL=https://${module.cloudfront.distribution_domain_name}/api npm run build

    # 5. Deploy frontend to S3
    aws s3 sync out/ s3://${module.s3_frontend.bucket_id}/ --delete

    # 6. Invalidate CloudFront cache
    aws cloudfront create-invalidation --distribution-id ${module.cloudfront.distribution_id} --paths "/*"

    # ========================================
    # Application URL: https://${var.domain_name != "" ? var.domain_name : module.cloudfront.distribution_domain_name}
    # ========================================

  EOT
}
