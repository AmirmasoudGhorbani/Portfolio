variable "region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-southeast-2"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "domain_name" {
  description = "Public domain for the platform"
  type        = string
  default     = "rentals.example.com"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "azs" {
  description = "Availability zones to spread subnets across"
  type        = list(string)
  default     = ["ap-southeast-2a", "ap-southeast-2b", "ap-southeast-2c"]
}

# Microservices that run as ECS services / behind the ALB.
variable "services" {
  description = "Application microservices and their desired counts"
  type = map(object({
    desired_count = number
    cpu           = number
    memory        = number
    path_pattern  = string
  }))
  default = {
    view    = { desired_count = 3, cpu = 256, memory = 512, path_pattern = "/listings/*" }
    guest   = { desired_count = 3, cpu = 512, memory = 1024, path_pattern = "/guests/*" }
    payment = { desired_count = 2, cpu = 512, memory = 1024, path_pattern = "/payments/*" }
    search  = { desired_count = 4, cpu = 512, memory = 1024, path_pattern = "/search/*" }
    host    = { desired_count = 2, cpu = 512, memory = 1024, path_pattern = "/host/*" }
    update  = { desired_count = 2, cpu = 512, memory = 1024, path_pattern = "" } # queue consumer, no ALB route
  }
}
