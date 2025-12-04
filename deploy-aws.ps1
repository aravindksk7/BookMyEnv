# =============================================================================
# BookMyEnv - AWS Deployment Script (PowerShell)
# =============================================================================
# This script helps deploy BookMyEnv to AWS using Terraform
# =============================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("full", "infrastructure", "backend", "frontend", "info", "destroy")]
    [string]$Action = ""
)

$ErrorActionPreference = "Stop"

# Colors
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-Host "========================================" -ForegroundColor Green
Write-Host " BookMyEnv AWS Deployment Script" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Check prerequisites
function Test-Prerequisites {
    Write-Host "`nChecking prerequisites..." -ForegroundColor Yellow
    
    # Check Terraform
    try {
        $tfVersion = terraform version -json | ConvertFrom-Json
        Write-Host "✓ Terraform installed: $($tfVersion.terraform_version)" -ForegroundColor Green
    } catch {
        Write-Host "Error: Terraform is not installed" -ForegroundColor Red
        exit 1
    }
    
    # Check AWS CLI
    try {
        $awsVersion = aws --version
        Write-Host "✓ AWS CLI installed: $awsVersion" -ForegroundColor Green
    } catch {
        Write-Host "Error: AWS CLI is not installed" -ForegroundColor Red
        exit 1
    }
    
    # Check Docker
    try {
        $dockerVersion = docker --version
        Write-Host "✓ Docker installed: $dockerVersion" -ForegroundColor Green
    } catch {
        Write-Host "Error: Docker is not installed" -ForegroundColor Red
        exit 1
    }
    
    # Check AWS credentials
    try {
        aws sts get-caller-identity | Out-Null
        Write-Host "✓ AWS credentials configured" -ForegroundColor Green
    } catch {
        Write-Host "Error: AWS credentials not configured" -ForegroundColor Red
        exit 1
    }
}

# Initialize Terraform
function Initialize-Terraform {
    Write-Host "`nInitializing Terraform..." -ForegroundColor Yellow
    Set-Location terraform
    terraform init
}

# Plan infrastructure
function New-TerraformPlan {
    Write-Host "`nPlanning infrastructure changes..." -ForegroundColor Yellow
    terraform plan -out=tfplan
}

# Apply infrastructure
function Invoke-TerraformApply {
    Write-Host "`nApplying infrastructure changes..." -ForegroundColor Yellow
    terraform apply tfplan
}

# Build and push Docker image
function Build-AndPushImage {
    Write-Host "`nBuilding and pushing Docker image..." -ForegroundColor Yellow
    
    # Get ECR repository URL from Terraform output
    $ECR_URL = terraform output -raw ecr_repository_url
    $REGION = "us-east-1"
    try {
        $REGION = terraform output -raw aws_region
    } catch {}
    
    # Login to ECR
    $password = aws ecr get-login-password --region $REGION
    $password | docker login --username AWS --password-stdin $ECR_URL
    
    # Build image
    Set-Location ../backend
    docker build -t "${ECR_URL}:latest" .
    
    # Push image
    docker push "${ECR_URL}:latest"
    
    Set-Location ../terraform
}

# Deploy frontend
function Deploy-Frontend {
    Write-Host "`nDeploying frontend..." -ForegroundColor Yellow
    
    # Get outputs from Terraform
    $BUCKET_NAME = terraform output -raw frontend_bucket_name
    $DISTRIBUTION_ID = terraform output -raw cloudfront_distribution_id
    $CF_DOMAIN = terraform output -raw cloudfront_distribution_domain
    
    # Build frontend
    Set-Location ../frontend
    npm install
    $env:NEXT_PUBLIC_API_URL = "https://$CF_DOMAIN/api"
    npm run build
    
    # Deploy to S3
    aws s3 sync out/ "s3://$BUCKET_NAME/" --delete
    
    # Invalidate CloudFront cache
    aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
    
    Set-Location ../terraform
}

# Update ECS service
function Update-ECSService {
    Write-Host "`nUpdating ECS service..." -ForegroundColor Yellow
    
    $CLUSTER_NAME = terraform output -raw ecs_cluster_name
    $SERVICE_NAME = terraform output -raw ecs_service_name
    $REGION = "us-east-1"
    try {
        $REGION = terraform output -raw aws_region
    } catch {}
    
    aws ecs update-service `
        --cluster $CLUSTER_NAME `
        --service $SERVICE_NAME `
        --force-new-deployment `
        --region $REGION
}

# Show deployment info
function Show-DeploymentInfo {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host " Deployment Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    
    Write-Host "`nApplication URLs:" -ForegroundColor Yellow
    terraform output application_url
    
    Write-Host "`nDeployment Commands:" -ForegroundColor Yellow
    terraform output deployment_commands
}

# Main menu
function Show-Menu {
    Test-Prerequisites
    
    if ($Action -eq "") {
        Write-Host "`nSelect an action:" -ForegroundColor Yellow
        Write-Host "1) Full deployment (init + plan + apply + build + deploy)"
        Write-Host "2) Infrastructure only (init + plan + apply)"
        Write-Host "3) Backend only (build + push image + update ECS)"
        Write-Host "4) Frontend only (build + deploy to S3)"
        Write-Host "5) Show deployment info"
        Write-Host "6) Destroy infrastructure"
        Write-Host "q) Quit"
        
        $choice = Read-Host "Enter choice"
    } else {
        $choice = switch ($Action) {
            "full" { "1" }
            "infrastructure" { "2" }
            "backend" { "3" }
            "frontend" { "4" }
            "info" { "5" }
            "destroy" { "6" }
        }
    }
    
    switch ($choice) {
        "1" {
            Initialize-Terraform
            New-TerraformPlan
            Invoke-TerraformApply
            Build-AndPushImage
            Update-ECSService
            Deploy-Frontend
            Show-DeploymentInfo
        }
        "2" {
            Initialize-Terraform
            New-TerraformPlan
            Invoke-TerraformApply
            Show-DeploymentInfo
        }
        "3" {
            Set-Location terraform
            Build-AndPushImage
            Update-ECSService
        }
        "4" {
            Set-Location terraform
            Deploy-Frontend
        }
        "5" {
            Set-Location terraform
            Show-DeploymentInfo
        }
        "6" {
            Write-Host "WARNING: This will destroy all infrastructure!" -ForegroundColor Red
            $confirm = Read-Host "Are you sure? (yes/no)"
            if ($confirm -eq "yes") {
                Set-Location terraform
                terraform destroy
            }
        }
        "q" {
            exit 0
        }
        default {
            Write-Host "Invalid choice" -ForegroundColor Red
        }
    }
}

# Run the script
Show-Menu
