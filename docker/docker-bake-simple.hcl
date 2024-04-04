variable "OSRD_GIT_DESCRIBE" {}

variable "TAG_PATTERNS" {
}

function "tags" {
  params = [image_name]
  result = [for pat in split(",", TAG_PATTERNS): format(pat, image_name)]
}

target "base-core" {
  tags = tags("core")
}

target "base-core-build" {
  tags = tags("core-build")
}

target "base-editoast" {
  tags = tags("editoast")
}

target "base-front-dev" {
  tags = tags("front-dev")
}

target "base-front-nginx" {
  tags = tags("front-nginx")
}

target "base-front-build" {
  tags = tags("front-build")
}

target "base-front-tests" {
  tags = tags("front-tests")
}

target "base-gateway-standalone" {
  tags = tags("gateway-standalone")
}

target "base-gateway-test" {
  tags = tags("gateway-test")
}

target "base-gateway-front" {
  tags = tags("gateway-front")
}

target "base-core_controller" {
  tags = tags("core_controller")
}

target "base-core_controller-test" {
  tags = tags("core_controller")
}
