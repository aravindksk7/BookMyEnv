# =============================================================================
# CloudFront Module - Main Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# Origin Access Identity for S3
# -----------------------------------------------------------------------------

resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "OAI for ${var.name_prefix} frontend"
}

# -----------------------------------------------------------------------------
# Cache Policies
# -----------------------------------------------------------------------------

# Cache policy for static assets
resource "aws_cloudfront_cache_policy" "static_assets" {
  name        = "${var.name_prefix}-static-assets"
  comment     = "Cache policy for static assets"
  default_ttl = 86400    # 1 day
  max_ttl     = 31536000 # 1 year
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# Cache policy for API - no caching
resource "aws_cloudfront_cache_policy" "api" {
  name        = "${var.name_prefix}-api"
  comment     = "Cache policy for API (no caching)"
  default_ttl = 0
  max_ttl     = 0
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "all"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Authorization", "Origin", "Accept", "Content-Type"]
      }
    }
    query_strings_config {
      query_string_behavior = "all"
    }
  }
}

# -----------------------------------------------------------------------------
# Origin Request Policies
# -----------------------------------------------------------------------------

resource "aws_cloudfront_origin_request_policy" "api" {
  name    = "${var.name_prefix}-api-origin-request"
  comment = "Origin request policy for API"

  cookies_config {
    cookie_behavior = "all"
  }

  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["Authorization", "Origin", "Accept", "Content-Type", "Accept-Language"]
    }
  }

  query_strings_config {
    query_string_behavior = "all"
  }
}

# -----------------------------------------------------------------------------
# CloudFront Distribution
# -----------------------------------------------------------------------------

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.name_prefix} distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # US, Canada, Europe

  aliases = var.domain_name != "" ? [var.domain_name] : []

  # S3 Origin (Frontend)
  origin {
    domain_name = var.s3_bucket_domain_name
    origin_id   = "S3-${var.s3_bucket_id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }
  }

  # ALB Origin (API)
  origin {
    domain_name = var.alb_dns_name
    origin_id   = "ALB-Backend"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only" # Change to https-only if ALB has certificate
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default behavior - S3 (Frontend)
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.s3_bucket_id}"

    cache_policy_id = aws_cloudfront_cache_policy.static_assets.id

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
  }

  # API behavior
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Backend"

    cache_policy_id          = aws_cloudfront_cache_policy.api.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api.id

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
  }

  # Static assets behavior
  ordered_cache_behavior {
    path_pattern     = "/_next/static/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.s3_bucket_id}"

    cache_policy_id = aws_cloudfront_cache_policy.static_assets.id

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
  }

  # Custom error responses for SPA routing
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  # SSL Configuration
  viewer_certificate {
    cloudfront_default_certificate = var.certificate_arn == ""
    acm_certificate_arn            = var.certificate_arn != "" ? var.certificate_arn : null
    ssl_support_method             = var.certificate_arn != "" ? "sni-only" : null
    minimum_protocol_version       = var.certificate_arn != "" ? "TLSv1.2_2021" : "TLSv1"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # WAF (optional - can be enabled for additional security)
  # web_acl_id = aws_wafv2_web_acl.main.arn

  tags = var.tags
}
