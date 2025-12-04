#!/bin/bash
# =============================================================================
# BookMyEnv - AWS Deployment Script
# =============================================================================
# This script helps deploy BookMyEnv to AWS using Terraform
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} BookMyEnv AWS Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"
    
    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        echo -e "${RED}Error: Terraform is not installed${NC}"
        exit 1
    fi
    echo "✓ Terraform installed: $(terraform version -json | jq -r '.terraform_version')"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}Error: AWS CLI is not installed${NC}"
        exit 1
    fi
    echo "✓ AWS CLI installed: $(aws --version)"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi
    echo "✓ Docker installed: $(docker --version)"
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}Error: AWS credentials not configured${NC}"
        exit 1
    fi
    echo "✓ AWS credentials configured"
}

# Initialize Terraform
init_terraform() {
    echo -e "\n${YELLOW}Initializing Terraform...${NC}"
    cd terraform
    terraform init
}

# Plan infrastructure
plan_infrastructure() {
    echo -e "\n${YELLOW}Planning infrastructure changes...${NC}"
    terraform plan -out=tfplan
}

# Apply infrastructure
apply_infrastructure() {
    echo -e "\n${YELLOW}Applying infrastructure changes...${NC}"
    terraform apply tfplan
}

# Build and push Docker image
build_and_push_image() {
    echo -e "\n${YELLOW}Building and pushing Docker image...${NC}"
    
    # Get ECR repository URL from Terraform output
    ECR_URL=$(terraform output -raw ecr_repository_url)
    REGION=$(terraform output -raw aws_region 2>/dev/null || echo "us-east-1")
    
    # Login to ECR
    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URL
    
    # Build image
    cd ../backend
    docker build -t $ECR_URL:latest .
    
    # Push image
    docker push $ECR_URL:latest
    
    cd ../terraform
}

# Deploy frontend
deploy_frontend() {
    echo -e "\n${YELLOW}Deploying frontend...${NC}"
    
    # Get outputs from Terraform
    BUCKET_NAME=$(terraform output -raw frontend_bucket_name)
    DISTRIBUTION_ID=$(terraform output -raw cloudfront_distribution_id)
    CF_DOMAIN=$(terraform output -raw cloudfront_distribution_domain)
    
    # Build frontend
    cd ../frontend
    npm install
    NEXT_PUBLIC_API_URL="https://$CF_DOMAIN/api" npm run build
    
    # Deploy to S3
    aws s3 sync out/ s3://$BUCKET_NAME/ --delete
    
    # Invalidate CloudFront cache
    aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
    
    cd ../terraform
}

# Update ECS service
update_ecs_service() {
    echo -e "\n${YELLOW}Updating ECS service...${NC}"
    
    CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)
    SERVICE_NAME=$(terraform output -raw ecs_service_name)
    REGION=$(terraform output -raw aws_region 2>/dev/null || echo "us-east-1")
    
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --force-new-deployment \
        --region $REGION
}

# Show deployment info
show_deployment_info() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN} Deployment Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    echo -e "\n${YELLOW}Application URLs:${NC}"
    terraform output application_url
    
    echo -e "\n${YELLOW}Deployment Commands:${NC}"
    terraform output deployment_commands
}

# Main menu
main() {
    check_prerequisites
    
    echo -e "\n${YELLOW}Select an action:${NC}"
    echo "1) Full deployment (init + plan + apply + build + deploy)"
    echo "2) Infrastructure only (init + plan + apply)"
    echo "3) Backend only (build + push image + update ECS)"
    echo "4) Frontend only (build + deploy to S3)"
    echo "5) Show deployment info"
    echo "6) Destroy infrastructure"
    echo "q) Quit"
    
    read -p "Enter choice: " choice
    
    case $choice in
        1)
            init_terraform
            plan_infrastructure
            apply_infrastructure
            build_and_push_image
            update_ecs_service
            deploy_frontend
            show_deployment_info
            ;;
        2)
            init_terraform
            plan_infrastructure
            apply_infrastructure
            show_deployment_info
            ;;
        3)
            cd terraform
            build_and_push_image
            update_ecs_service
            ;;
        4)
            cd terraform
            deploy_frontend
            ;;
        5)
            cd terraform
            show_deployment_info
            ;;
        6)
            echo -e "${RED}WARNING: This will destroy all infrastructure!${NC}"
            read -p "Are you sure? (yes/no): " confirm
            if [ "$confirm" == "yes" ]; then
                cd terraform
                terraform destroy
            fi
            ;;
        q)
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            ;;
    esac
}

main
