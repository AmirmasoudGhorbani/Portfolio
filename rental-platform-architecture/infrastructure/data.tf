# ---------------------------------------------------------------------------
# Data tier: primary RDS database, SQS queue (+ DLQ) for async writes,
# OpenSearch (Elasticsearch) for catalog search, and the S3 photos bucket.
# ---------------------------------------------------------------------------

# --- RDS (source of truth) --------------------------------------------------

resource "aws_db_subnet_group" "main" {
  name       = "rental-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_security_group" "db" {
  name_prefix = "db-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from services"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.service.id]
  }
}

resource "aws_db_instance" "primary" {
  identifier             = "rental-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.r6g.large"
  allocated_storage      = 100
  max_allocated_storage  = 1000 # storage autoscaling
  multi_az               = var.environment == "prod"
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  storage_encrypted      = true
  backup_retention_period = 7
  skip_final_snapshot     = var.environment != "prod"
  username                = "app"
  manage_master_user_password = true
}

# Read replica to scale read traffic off the primary.
resource "aws_db_instance" "replica" {
  count               = var.environment == "prod" ? 2 : 0
  identifier          = "rental-${var.environment}-replica-${count.index}"
  replicate_source_db = aws_db_instance.primary.identifier
  instance_class      = "db.r6g.large"
  skip_final_snapshot = true
}

# --- SQS (decouples writes) -------------------------------------------------

resource "aws_sqs_queue" "updates_dlq" {
  name                      = "rental-updates-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "updates" {
  name                       = "rental-updates-${var.environment}"
  visibility_timeout_seconds = 60
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.updates_dlq.arn
    maxReceiveCount     = 5
  })
}

# --- OpenSearch / Elasticsearch (search index) ------------------------------

resource "aws_opensearch_domain" "search" {
  domain_name    = "rental-${var.environment}"
  engine_version = "OpenSearch_2.13"

  cluster_config {
    instance_type          = "r6g.large.search"
    instance_count         = var.environment == "prod" ? 3 : 1
    zone_awareness_enabled = var.environment == "prod"
  }

  ebs_options {
    ebs_enabled = true
    volume_size = 50
  }

  encrypt_at_rest { enabled = true }
  node_to_node_encryption { enabled = true }
}

# --- S3 (listing photos, CDN origin) ---------------------------------------

resource "aws_s3_bucket" "photos" {
  bucket = "rental-photos-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "photos" {
  bucket                  = aws_s3_bucket.photos.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Move older media to cheaper storage automatically.
resource "aws_s3_bucket_lifecycle_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id

  rule {
    id     = "archive-old-media"
    status = "Enabled"
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }
}
