terraform {
  required_version = ">= 1.5"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "docker" {}

# Random suffix to avoid naming collisions
resource "random_pet" "suffix" {}

# Build the Docker image
resource "docker_image" "owl_compass" {
  name = "owl-compass:${random_pet.suffix.id}"
  build {
    context    = "${path.module}/.."
    dockerfile = "${path.module}/../Dockerfile"
  }
}

# Run the container (useful for local dev; Railway runs the image automatically)
resource "docker_container" "owl_compass" {
  name  = "owl-compass-${random_pet.suffix.id}"
  image = docker_image.owl_compass.name
  env = [
    "SUPABASE_URL=${var.supabase_url}",
    "SUPABASE_KEY=${var.supabase_key}"
  ]
  ports {
    internal = 3000
    external = var.http_port
  }
}
