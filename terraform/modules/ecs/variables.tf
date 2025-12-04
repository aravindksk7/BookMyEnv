# =============================================================================
# ECS Module - Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "alb_target_group_arn" {
  description = "ALB target group ARN"
  type        = string
}

variable "alb_security_group_id" {
  description = "ALB security group ID"
  type        = string
}

variable "ecr_repository_url" {
  description = "ECR repository URL"
  type        = string
}

variable "ecs_cpu" {
  description = "CPU units for ECS task"
  type        = number
}

variable "ecs_memory" {
  description = "Memory for ECS task in MB"
  type        = number
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
}

variable "ecs_min_count" {
  description = "Minimum number of ECS tasks"
  type        = number
}

variable "ecs_max_count" {
  description = "Maximum number of ECS tasks"
  type        = number
}

variable "health_check_grace_period" {
  description = "Health check grace period"
  type        = number
}

variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights"
  type        = bool
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
}

variable "secrets_arn" {
  description = "Secrets Manager secret ARN"
  type        = string
}

variable "database_host" {
  description = "Database host"
  type        = string
}

variable "database_name" {
  description = "Database name"
  type        = string
}

variable "jwt_expires_in" {
  description = "JWT expiration time"
  type        = string
}

variable "rate_limit_window_ms" {
  description = "Rate limit window in milliseconds"
  type        = number
}

variable "rate_limit_max_requests" {
  description = "Maximum requests per rate limit window"
  type        = number
}

variable "frontend_url" {
  description = "Frontend URL for CORS"
  type        = string
}

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
  default     = {}
}
