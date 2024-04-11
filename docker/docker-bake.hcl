variable "OSRD_GIT_DESCRIBE" {}

group "default" {
  targets = [
    "core",
    "core-build",
    "train-sim-rust-test",
    "train-sim-bindings-test",
    "editoast",
    "editoast-test",
    "front-devel",
    "front-nginx",
    "front-build",
    "front-tests",
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
  contexts = {
    test_data = "./tests/data"
    train_sim_dir = "./train-sim"
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
    train_sim_dir = "./train-sim"
  }
}

#############
# Train-sim #
#############

target "base-train-sim-rust-test" {}

target "train-sim-rust-test" {
  inherits = ["base", "base-train-sim-rust-test"]
  context = "core"
  dockerfile = "Dockerfile"
  target = "train_sim_rust_env"
  contexts = {
    test_data = "./tests/data"
    train_sim_dir = "./train-sim"
  }
}

target "base-train-sim-bindings-test" {}

target "train-sim-bindings-test" {
  inherits = ["base", "base-train-sim-bindings-test"]
  context = "core"
  dockerfile = "Dockerfile"
  target = "train_sim_gradle_env"
  contexts = {
    test_data = "./tests/data"
    train_sim_dir = "./train-sim"
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
  }
}

target "base-editoast" {}
target "editoast" {
  inherits = ["base", "base-editoast"]
  context = "editoast"
  dockerfile = "Dockerfile"
  target = "running_env"
  contexts = {
    test_data = "./tests/data"
  }
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

target "base-front-nginx" {}
target "front-nginx" {
  inherits = ["base", "base-front-nginx"]
  context = "front"
  dockerfile = "docker/Dockerfile.nginx"
}

target "base-front-build" {}
target "front-build" {
  inherits = ["base", "base-front-build"]
  context = "front"
  dockerfile = "docker/Dockerfile.nginx"
  target = "build"
}

target "base-front-tests" {}
target "front-tests" {
  inherits = ["base", "base-front-tests"]
  context = "front"
  dockerfile = "docker/Dockerfile.nginx"
  target = "tests"
  contexts = {
    test_data = "./tests/data"
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
