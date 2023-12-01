variable "OSRD_GIT_DESCRIBE" {}

variable "TAG_VERSION" {
  default = "dev"
}

variable "TAG_PREFIX" {
  default = "ghcr.io/osrd-project/edge/"
}

function "tags" {
  params = [image_name, suffix]
  result = [format("%sosrd-%s:%s%s", TAG_PREFIX, image_name, TAG_VERSION, suffix)]
}

target "base-core" {
  tags = tags("core", "")
}

target "base-core-build" {
  tags = tags("core", "-build")
}

target "base-editoast" {
  tags = tags("editoast", "")
}

target "base-editoast-test" {
  tags = tags("editoast", "-test")
}

target "base-front-devel" {
  tags = tags("front", "-devel")
}

target "base-front-test" {
  tags = tags("front", "-test")
}

target "base-front-build" {
  tags = tags("front", "-build")
}

target "base-gateway-standalone" {
  tags = tags("gateway", "-standalone")
}

target "base-gateway-test" {
  tags = tags("gateway", "-test")
}

target "base-gateway-front" {
  tags = tags("gateway", "-front")
}
