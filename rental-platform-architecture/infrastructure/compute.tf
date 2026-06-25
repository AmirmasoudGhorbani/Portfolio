# ---------------------------------------------------------------------------
# Compute: ECS (Fargate) cluster running the stateless microservices.
# Each service is wired to its ALB target group (where applicable). The
# `update` worker has no ALB route — it scales on SQS queue depth instead.
# ---------------------------------------------------------------------------

resource "aws_ecs_cluster" "main" {
  name = "rental-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_security_group" "service" {
  name_prefix = "svc-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "From the ALB only"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_task_definition" "svc" {
  for_each = var.services

  family                   = "rental-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = "REGISTRY/rental-${each.key}:latest" # push images to ECR
      essential = true
      portMappings = each.value.path_pattern != "" ? [
        { containerPort = 8080, protocol = "tcp" }
      ] : []
      environment = [
        { name = "SERVICE_NAME", value = each.key },
        { name = "DB_HOST", value = aws_db_instance.primary.address },
        { name = "QUEUE_URL", value = aws_sqs_queue.updates.url },
        { name = "SEARCH_ENDPOINT", value = aws_opensearch_domain.search.endpoint },
        { name = "PHOTOS_BUCKET", value = aws_s3_bucket.photos.bucket }
      ]
    }
  ])
}

resource "aws_ecs_service" "svc" {
  for_each = var.services

  name            = each.key
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.svc[each.key].arn
  desired_count   = each.value.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.service.id]
  }

  # ALB-facing services attach to their target group.
  dynamic "load_balancer" {
    for_each = each.value.path_pattern != "" ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.svc[each.key].arn
      container_name   = each.key
      container_port   = 8080
    }
  }
}

# --- Auto scaling -----------------------------------------------------------
# ALB services scale on CPU; the queue consumer scales on SQS backlog.

resource "aws_appautoscaling_target" "svc" {
  for_each = var.services

  max_capacity       = each.value.desired_count * 4
  min_capacity       = each.value.desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.svc[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  for_each = { for k, v in var.services : k => v if v.path_pattern != "" }

  name               = "cpu-${each.key}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.svc[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.svc[each.key].scalable_dimension
  service_namespace  = "ecs"

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 65
  }
}

# The update worker scales on how many messages are waiting in the queue.
resource "aws_appautoscaling_policy" "queue_depth" {
  name               = "queue-depth-update"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.svc["update"].resource_id
  scalable_dimension = aws_appautoscaling_target.svc["update"].scalable_dimension
  service_namespace  = "ecs"

  target_tracking_scaling_policy_configuration {
    customized_metric_specification {
      metric_name = "ApproximateNumberOfMessagesVisible"
      namespace   = "AWS/SQS"
      statistic   = "Average"
      dimensions {
        name  = "QueueName"
        value = aws_sqs_queue.updates.name
      }
    }
    target_value = 100 # messages per task
  }
}
