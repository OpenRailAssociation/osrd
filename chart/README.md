# OSRD Helm Chart Repository

This repository contains Helm charts for deploying OSRD.

## Deploying

### Prerequisites

- Kubernetes cluster
- Helm installed

### Deploying the application

You can deploy the application using the following command:

```
helm install osrd oci://ghcr.io/openrailassociation/osrd-charts/osrd --version 0.1.0
```

If you want to use the latest build of the helm chart (not the latest released) you can use

```
helm install osrd oci://ghcr.io/openrailassociation/osrd-charts/osrd-dev --version 0.0.1-branch-commit_hash
```

## Configuration

Check the `values.yaml` file.


## Contributing

To comply with the [DCO](http://developercertificate.org/), all commits must
include a Signed-off-by line. You can find more information about this [here](https://osrd.fr/en/docs/guides/contribute/contribute-code/commit-conventions/#the-developer-certificate-of-origin)

For more advice on how to contribute, follow that link:
https://osrd.fr/en/docs/guides/contribute/contribute-code
