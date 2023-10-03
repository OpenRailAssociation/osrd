variable "OSRD_GIT_DESCRIBE" {}

group "default" {
  targets = [
    "core",
    "editoast",
    "front-dev",
    "front-nginx",
    "gateway",
    "gateway-embedded-front",
  ]
}

target "base" {
  args = {
    OSRD_GIT_DESCRIBE  = "${OSRD_GIT_DESCRIBE}"
  }
}

target "base-core" {}
target "core" {
  inherits = ["base", "base-core"]
  context = "core"
  dockerfile = "Dockerfile"
}

target "base-editoast" {}
target "editoast" {
  inherits = ["base", "base-editoast"]
  context = "editoast"
  dockerfile = "Dockerfile"
}

target "base-front-dev" {}
target "front-dev" {
  inherits = ["base", "base-front-dev"]
  context = "front"
  dockerfile = "docker/Dockerfile.dev"
}

target "base-front-nginx" {}
target "front-nginx" {
  inherits = ["base", "base-front-nginx"]
  context = "front"
  dockerfile = "docker/Dockerfile.nginx"
}

target "base-gateway" {}
target "gateway" {
  inherits = ["base", "base-gateway"]
  context = "gateway"
  dockerfile = "Dockerfile"
}

target "base-gateway-embedded-front" {}
target "gateway-embedded-front" {
  inherits = ["base", "base-gateway-embedded-front"]
  dockerfile = "gateway-embedded-front.dockerfile"
  context = "docker"
  contexts = {
    built_front = "target:front-nginx"
    gateway = "./gateway"
  }
}
