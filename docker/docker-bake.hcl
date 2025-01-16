variable "OSRD_GIT_DESCRIBE" {}

group "default" {
  targets = [
    "core",
    "core-build",
    "editoast",
    "editoast-test",
    "front-tests",
    "gateway-standalone",
    "gateway-test",
    "gateway-front",
    "osrdyne",
    "osrdyne-test"
  ]
}

group "release" {
  targets = [
    "core",
    "editoast",
    "gateway-front",
    "osrdyne",
  ]
}

target "base" {
  args = {
    OSRD_GIT_DESCRIBE = "${OSRD_GIT_DESCRIBE}"
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
  contexts = {
    test_data = "./tests/data"
    static_assets = "./assets"
  }
}

target "base-core" {}

target "core" {
  inherits = ["base", "base-core"]
  context = "core"
  dockerfile = "Dockerfile"
  target = "running_env"
  contexts = {
    test_data = "./tests/data"
    static_assets = "./assets"
  }
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
  contexts = {
    test_data = "./tests/data"
    static_assets = "./assets"
  }
}

target "base-editoast" {}
target "editoast" {
  inherits = ["base", "base-editoast"]
  context = "editoast"
  dockerfile = "Dockerfile"
  target = "running_env"
  contexts = {
    static_assets = "./assets"
  }
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

target "base-gateway-front-build" {}
target "gateway-front-build" {
  inherits = ["base", "base-gateway-front-build"]
  context = "gateway"
  dockerfile = "Dockerfile"
  target = "front_build"
  contexts = {
    front_src = "./front"
  }
}

target "base-gateway-front" {}
target "gateway-front" {
  inherits = ["base", "base-gateway-front"]
  dockerfile = "Dockerfile"
  target = "front_running_env"
  context = "gateway"
  contexts = {
    front_src = "./front"
  }
}

#########
# Front #
#########

target "base-front-tests" {}
target "front-tests" {
  inherits = ["base", "base-front-tests"]
  context = "front"
  dockerfile = "docker/Dockerfile"
  target = "tests"
  contexts = {
    front_build = "target:gateway-front-build"
    test_data = "./tests/data"
  }
}

###########
# OSRDyne #
###########

target "base-osrdyne" {}
target "osrdyne" {
  inherits = ["base", "base-osrdyne"]
  context = "osrdyne"
  dockerfile = "Dockerfile"
  target = "running_env"
}

target "base-osrdyne-test" {}
target "osrdyne-test" {
  inherits = ["base", "base-osrdyne-test"]
  context = "osrdyne"
  dockerfile = "Dockerfile"
  target = "testing_env"
}
