variable "OSRD_GIT_DESCRIBE" {}

group "default" {
  targets = [
    "core",
    "core-build",
    "editoast",
    "editoast-test",
    "front-devel",
    "front-test",
    "front-build",
    "gateway-standalone",
    "gateway-test",
    "gateway-front",
  ]
}

group "release" {
  targets = [
    "core",
    "editoast",
    "gateway-front",
  ]
}

target "base" {
  args = {
    OSRD_GIT_DESCRIBE  = "${OSRD_GIT_DESCRIBE}"
  }
}

########
# Core #
########

target "base-core-build" {}
target "core-build" {
  inherits = ["base", "base-core-build"]
  context = "core"
  dockerfile = "Dockerfile"
  target = "build_env"
}

target "base-core" {}
target "core" {
  inherits = ["base", "base-core"]
  context = "core"
  dockerfile = "Dockerfile"
  target = "running_env"
}

############
# Editoast #
############

target "base-editoast-test" {}
target "editoast-test" {
  inherits = ["base", "base-editoast-test"]
  context = "editoast"
  dockerfile = "Dockerfile"
  target = "test_builder"
}

target "base-editoast" {}
target "editoast" {
  inherits = ["base", "base-editoast"]
  context = "editoast"
  dockerfile = "Dockerfile"
  target = "running_env"
}

#########
# Front #
#########

target "base-front-devel" {}
target "front-devel" {
  inherits = ["base", "base-front-devel"]
  context = "front"
  dockerfile = "docker/Dockerfile.devel"
}

target "base-front-test" {}
target "front-test" {
  inherits = ["base", "base-front-test"]
  context = "front"
  dockerfile = "docker/Dockerfile"
  target = "test_serve"
}

target "base-front-build" {}
target "front-build" {
  inherits = ["base", "base-front-build"]
  context = "front"
  dockerfile = "docker/Dockerfile"
  target = "prod_build"
}

###########
# Gateway #
###########

target "base-gateway-standalone" {}
target "gateway-standalone" {
  inherits = ["base", "base-gateway-standalone"]
  context = "gateway"
  dockerfile = "Dockerfile"
  target = "running_env"
}

target "base-gateway-test" {}
target "gateway-test" {
  inherits = ["base", "base-gateway-test"]
  context = "gateway"
  dockerfile = "Dockerfile"
  target = "testing_env"
}

target "base-gateway-front" {}
target "gateway-front" {
  inherits = ["base", "base-gateway-front"]
  dockerfile = "gateway-front.dockerfile"
  context = "docker"
  contexts = {
    gateway_src = "./gateway"
    gateway_build = "target:gateway-standalone"
    front_build = "target:front-build"
  }
}
