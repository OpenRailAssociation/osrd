# Building and tagging images

Images are built using docker buildx:

```sh
# # Controls how built images are tagged. By default, tags with what docker-compose uses
# export TAG_PATTERNS=osrd-%s:latest,osrd-%s:foobar
export OSRD_GIT_DESCRIBE=$(git describe)
docker buildx bake --file=docker/docker-bake.hcl --file=docker/docker-bake-simple.hcl
```
