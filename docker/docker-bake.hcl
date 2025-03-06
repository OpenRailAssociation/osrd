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

target "core-build" {
  inherits = ["base"]
  context = "core"
  dockerfile = "Dockerfile"
  target = "build_env"
  contexts = {
    test_data = "./tests/data"
    static_assets = "./assets"
  }
}

target "core" {
  inherits = ["base"]
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

target "editoast-test" {
  inherits = ["base"]
  context = "editoast"
  dockerfile = "Dockerfile"
  target = "test_builder"
  contexts = {
    test_data = "./tests/data"
    static_assets = "./assets"
  }
}

target "editoast" {
  inherits = ["base"]
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

target "gateway-standalone" {
  inherits = ["base"]
  context = "gateway"
  dockerfile = "Dockerfile"
  target = "running_env"
}

target "gateway-test" {
  inherits = ["base"]
  context = "gateway"
  dockerfile = "Dockerfile"
  target = "testing_env"
}

target "gateway-front-build" {
  inherits = ["base"]
  context = "gateway"
  dockerfile = "Dockerfile"
  target = "front_build"
  contexts = {
    front_src = "./front"
  }
}

target "gateway-front" {
  inherits = ["base"]
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

target "front-tests" {
  inherits = ["base"]
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

target "osrdyne" {
  inherits = ["base"]
  context = "osrdyne"
  dockerfile = "Dockerfile"
  target = "running_env"
}

target "osrdyne-test" {
  inherits = ["base"]
  context = "osrdyne"
  dockerfile = "Dockerfile"
  target = "testing_env"
}
