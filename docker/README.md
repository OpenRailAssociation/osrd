# Building and tagging images

Images are built using docker buildx:

```sh
# # Controls how built images are tagged. By default, tags with what docker-compose uses
# export TAG_VERSION=pr-XXXX
export OSRD_GIT_DESCRIBE=$(git describe)
docker buildx bake -f docker/docker-bake.hcl -f docker/docker-bake-simple.hcl
```

Add `--pull` to load built images into docker (or `--push` if you really know what you're doing).
