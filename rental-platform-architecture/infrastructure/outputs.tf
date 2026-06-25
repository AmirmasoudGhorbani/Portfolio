output "alb_dns_name" {
  description = "Public DNS of the application load balancer"
  value       = aws_lb.main.dns_name
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain for static assets & photos"
  value       = aws_cloudfront_distribution.cdn.domain_name
}

output "db_endpoint" {
  description = "Primary RDS endpoint"
  value       = aws_db_instance.primary.address
}

output "search_endpoint" {
  description = "OpenSearch / Elasticsearch endpoint"
  value       = aws_opensearch_domain.search.endpoint
}

output "updates_queue_url" {
  description = "SQS queue URL for asynchronous listing updates"
  value       = aws_sqs_queue.updates.url
}

output "photos_bucket" {
  description = "S3 bucket holding listing photos"
  value       = aws_s3_bucket.photos.bucket
}
