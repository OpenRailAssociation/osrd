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

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| affinity | object | `{}` |  |
| annotations | object | `{}` |  |
| endpoints.amqp.management | string | `"http://osrd:password@rabbitmq:15672"` |  |
| endpoints.amqp.managementWithVhost | string | `"http://osrd:password@rabbitmq:15672/%2f"` |  |
| endpoints.amqp.url | string | `"amqp://osrd:password@rabbitmq:5672/%2f"` |  |
| endpoints.postgresql | string | `"postgres://osrd:password@postgres:5432/osrd"` |  |
| endpoints.postgresqlOpenFGA | string | `"postgres://osrd:password@postgres:5432/osrd?search_path=openfga"` |  |
| endpoints.public | string | `"https://my-osrd-instance.org"` |  |
| endpoints.redis | string | `"redis://username:pwd@redis:6379/0"` |  |
| fullnameOverride | string | `""` |  |
| imagePullSecrets | list | `[]` |  |
| images.core | string | `"ghcr.io/openrailassociation/osrd-REPOSITORY_VERSION_REPLACE_ME/osrd-core:IMAGES_VERSION_REPLACE_ME"` |  |
| images.editoast | string | `"ghcr.io/openrailassociation/osrd-REPOSITORY_VERSION_REPLACE_ME/osrd-editoast:IMAGES_VERSION_REPLACE_ME"` |  |
| images.gateway | string | `"ghcr.io/openrailassociation/osrd-REPOSITORY_VERSION_REPLACE_ME/osrd-gateway:IMAGES_VERSION_REPLACE_ME-front"` |  |
| images.openfga | string | `"openfga/openfga:v1.8.6"` |  |
| images.osrdyne | string | `"ghcr.io/openrailassociation/osrd-REPOSITORY_VERSION_REPLACE_ME/osrd-osrdyne:IMAGES_VERSION_REPLACE_ME"` |  |
| labels | object | `{}` |  |
| nameOverride | string | `""` |  |
| nodeSelector | object | `{}` |  |
| pullPolicy | string | `"IfNotPresent"` |  |
| services.core.affinity | object | `{}` |  |
| services.core.annotations | object | `{}` |  |
| services.core.autoscaling.type | string | `"NoScaling"` |  |
| services.core.config.telemetry | string | `nil` |  |
| services.core.env | list | `[]` |  |
| services.core.labels | object | `{}` |  |
| services.core.nodeSelector | object | `{}` |  |
| services.core.resources | object | `{}` |  |
| services.core.service_account_name | string | `nil` | Service account name to mount in case of kubernetes deployment |
| services.core.tolerations | list | `[]` |  |
| services.editoast.affinity | object | `{}` |  |
| services.editoast.annotations | object | `{}` |  |
| services.editoast.cronjob.env | list | `[]` |  |
| services.editoast.cronjob.extend | string | `""` |  |
| services.editoast.cronjob.schedule | string | `"3 1 * * mon-fri"` |  |
| services.editoast.enabled | bool | `true` |  |
| services.editoast.env | list | `[]` |  |
| services.editoast.hpa.annotations | object | `{}` |  |
| services.editoast.hpa.enabled | bool | `true` |  |
| services.editoast.hpa.labels | object | `{}` |  |
| services.editoast.hpa.maxReplicas | int | `10` |  |
| services.editoast.hpa.minReplicas | int | `2` |  |
| services.editoast.hpa.targetCPUUtilizationPercentage | int | `80` |  |
| services.editoast.init.enabled | bool | `true` |  |
| services.editoast.init.extend | string | `""` |  |
| services.editoast.labels | object | `{}` |  |
| services.editoast.livenessProbe.disabled | bool | `false` |  |
| services.editoast.livenessProbe.initialDelaySeconds | int | `0` |  |
| services.editoast.livenessProbe.periodSeconds | int | `10` |  |
| services.editoast.livenessProbe.timeoutSeconds | int | `3` |  |
| services.editoast.nodeSelector | object | `{}` |  |
| services.editoast.permanent_storage_class | string | `nil` |  |
| services.editoast.permanent_storage_size | string | `nil` |  |
| services.editoast.readinessProbe.disabled | bool | `false` |  |
| services.editoast.readinessProbe.initialDelaySeconds | int | `5` |  |
| services.editoast.readinessProbe.periodSeconds | int | `10` |  |
| services.editoast.readinessProbe.timeoutSeconds | int | `3` |  |
| services.editoast.replicaCount | int | `2` |  |
| services.editoast.resources | object | `{}` |  |
| services.editoast.service.port | int | `80` |  |
| services.editoast.service.targetPort | int | `80` |  |
| services.editoast.service.type | string | `"ClusterIP"` |  |
| services.editoast.tolerations | list | `[]` |  |
| services.gateway.affinity | object | `{}` |  |
| services.gateway.annotations | object | `{}` |  |
| services.gateway.config.auth.providers[0].provider_id | string | `"mocked"` |  |
| services.gateway.config.auth.providers[0].type | string | `"Mocked"` |  |
| services.gateway.config.auth.providers[0].username | string | `"osrd-admin"` |  |
| services.gateway.config.railway_manager_interface.enabled | bool | `false` |  |
| services.gateway.config.railway_manager_interface.prefix | string | `"/railway-manager"` |  |
| services.gateway.config.railway_manager_interface.upstream | string | `""` |  |
| services.gateway.config.tracing.config | object | `{}` |  |
| services.gateway.config.tracing.enabled | bool | `false` |  |
| services.gateway.config.tracing.type | string | `""` |  |
| services.gateway.config.trusted_proxies[0] | string | `"10.0.0.0/8"` |  |
| services.gateway.config.trusted_proxies[1] | string | `"172.16.0.0/12"` |  |
| services.gateway.config.trusted_proxies[2] | string | `"192.168.0.0/16"` |  |
| services.gateway.enabled | bool | `true` |  |
| services.gateway.env | list | `[]` |  |
| services.gateway.ingress.annotations | object | `{}` |  |
| services.gateway.ingress.className | string | `""` |  |
| services.gateway.ingress.domains[0] | string | `"osrd.local"` |  |
| services.gateway.ingress.enabled | bool | `false` |  |
| services.gateway.ingress.secretName | string | `"osrd-gateway-tls"` |  |
| services.gateway.ingress.tls | list | `[]` |  |
| services.gateway.labels | object | `{}` |  |
| services.gateway.livenessProbe.disabled | bool | `false` |  |
| services.gateway.nodeSelector | object | `{}` |  |
| services.gateway.readinessProbe.disabled | bool | `false` |  |
| services.gateway.replicaCount | int | `1` |  |
| services.gateway.resources | object | `{}` |  |
| services.gateway.service.port | int | `80` |  |
| services.gateway.service.targetPort | int | `80` |  |
| services.gateway.service.type | string | `"ClusterIP"` |  |
| services.gateway.tolerations | list | `[]` |  |
| services.gateway.volumeMounts | list | `[]` |  |
| services.gateway.volumes | list | `[]` |  |
| services.images.affinity | object | `{}` |  |
| services.images.annotations | object | `{}` |  |
| services.images.enabled | bool | `true` |  |
| services.images.env | list | `[]` |  |
| services.images.labels | object | `{}` |  |
| services.images.nodeSelector | object | `{}` |  |
| services.images.replicaCount | int | `1` |  |
| services.images.resources | object | `{}` |  |
| services.images.service.port | int | `80` |  |
| services.images.service.targetPort | int | `80` |  |
| services.images.service.type | string | `"ClusterIP"` |  |
| services.images.tolerations | list | `[]` |  |
| services.openfga.affinity | object | `{}` |  |
| services.openfga.annotations | object | `{}` |  |
| services.openfga.enabled | bool | `false` |  |
| services.openfga.env | list | `[]` |  |
| services.openfga.labels | object | `{}` |  |
| services.openfga.nodeSelector | object | `{}` |  |
| services.openfga.readinessProbe.disabled | bool | `false` |  |
| services.openfga.readinessProbe.initialDelaySeconds | int | `5` |  |
| services.openfga.readinessProbe.periodSeconds | int | `10` |  |
| services.openfga.readinessProbe.timeoutSeconds | int | `3` |  |
| services.openfga.replicaCount | int | `2` |  |
| services.openfga.resources | object | `{}` |  |
| services.openfga.service.port | int | `80` |  |
| services.openfga.service.targetPort | int | `8080` |  |
| services.openfga.service.type | string | `"ClusterIP"` |  |
| services.openfga.tolerations | list | `[]` |  |
| services.osrdyne.affinity | object | `{}` |  |
| services.osrdyne.annotations | object | `{}` |  |
| services.osrdyne.config.api_address | string | `"0.0.0.0:80"` |  |
| services.osrdyne.config.default_message_ttl | string | `nil` |  |
| services.osrdyne.config.max_length | string | `nil` |  |
| services.osrdyne.config.max_length_bytes | string | `nil` |  |
| services.osrdyne.config.pool_id | string | `"core"` |  |
| services.osrdyne.enabled | bool | `true` |  |
| services.osrdyne.env | list | `[]` |  |
| services.osrdyne.labels | object | `{}` |  |
| services.osrdyne.livenessProbe.disabled | bool | `false` |  |
| services.osrdyne.livenessProbe.initialDelaySeconds | int | `5` |  |
| services.osrdyne.livenessProbe.periodSeconds | int | `10` |  |
| services.osrdyne.livenessProbe.timeoutSeconds | int | `3` |  |
| services.osrdyne.nodeSelector | object | `{}` |  |
| services.osrdyne.readinessProbe.disabled | bool | `false` |  |
| services.osrdyne.replicaCount | int | `1` |  |
| services.osrdyne.resources | object | `{}` |  |
| services.osrdyne.service.port | int | `80` |  |
| services.osrdyne.service.targetPort | int | `80` |  |
| services.osrdyne.service.type | string | `"ClusterIP"` |  |
| services.osrdyne.tolerations | list | `[]` |  |
| services.statefulEditoast.affinity | object | `{}` |  |
| services.statefulEditoast.annotations | object | `{}` |  |
| services.statefulEditoast.enabled | bool | `true` |  |
| services.statefulEditoast.env | list | `[]` |  |
| services.statefulEditoast.labels | object | `{}` |  |
| services.statefulEditoast.livenessProbe.disabled | bool | `false` |  |
| services.statefulEditoast.livenessProbe.initialDelaySeconds | int | `0` |  |
| services.statefulEditoast.livenessProbe.periodSeconds | int | `10` |  |
| services.statefulEditoast.livenessProbe.timeoutSeconds | int | `3` |  |
| services.statefulEditoast.nodeSelector | object | `{}` |  |
| services.statefulEditoast.readinessProbe.disabled | bool | `false` |  |
| services.statefulEditoast.readinessProbe.initialDelaySeconds | int | `5` |  |
| services.statefulEditoast.readinessProbe.periodSeconds | int | `10` |  |
| services.statefulEditoast.readinessProbe.timeoutSeconds | int | `3` |  |
| services.statefulEditoast.replicaCount | int | `1` |  |
| services.statefulEditoast.resources | object | `{}` |  |
| services.statefulEditoast.service.port | int | `80` |  |
| services.statefulEditoast.service.targetPort | int | `80` |  |
| services.statefulEditoast.service.type | string | `"ClusterIP"` |  |
| services.statefulEditoast.tolerations | list | `[]` |  |
| tolerations | list | `[]` |  |

## Contributing

To comply with the [DCO](http://developercertificate.org/), all commits must
include a Signed-off-by line. You can find more information about this [here](https://osrd.fr/en/docs/guides/contribute/contribute-code/commit-conventions/#the-developer-certificate-of-origin)

For more advice on how to contribute, follow that link:
https://osrd.fr/en/docs/guides/contribute/contribute-code
