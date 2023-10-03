variable "OSRD_GIT_DESCRIBE" {}

variable "TAG_PATTERNS" {
  default = "ghcr.io/osrd-project/unstable/osrd-%s:latest"
}

function "tags" {
  params = [image_name]
  result = [for pat in split(",", TAG_PATTERNS): format(pat, image_name)]
}

target "base-core" {
  tags = tags("core")
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

target "base-gateway" {
  tags = tags("gateway")
}

target "base-gateway-embedded-front" {
  tags = tags("gateway-embedded-front")
}
