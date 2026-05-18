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

## Schema generation

The `values.schema.json` is generated using the [helm-schema plugin](https://github.com/dadav/helm-schema).

From the `chart/` directory, run:

```bash
helm schema -a -p
```

The CI will fail if the committed schema doesn't match the generated output.

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| affinity | object | `{}` |  |
| annotations | object | `{}` |  |
| endpoints.amqp | object | `{"management":"http://osrd:password@rabbitmq:15672","managementWithVhost":"http://osrd:password@rabbitmq:15672/%2f","url":"amqp://osrd:password@rabbitmq:5672/%2f"}` | amqp configuration |
| endpoints.amqp.management | string, object | `"http://osrd:password@rabbitmq:15672"` | amqp management url |
| endpoints.amqp.managementWithVhost | string, object | `"http://osrd:password@rabbitmq:15672/%2f"` | amqp management url including vhost |
| endpoints.amqp.url | string, object | `"amqp://osrd:password@rabbitmq:5672/%2f"` | amqp server url text or reference to a secret |
| endpoints.postgresql | string, object | `"postgres://osrd:password@postgres:5432/osrd"` | postgresql url |
| endpoints.postgresqlOpenFGA | string, object | `"postgres://osrd:password@postgres:5432/osrd?search_path=openfga"` | postgresql url for openFGA |
| endpoints.public | string | `"https://my-osrd-instance.org"` | Public url of the application |
| endpoints.redis | string, object | `"redis://username:pwd@redis:6379/0"` | redis/valkey url |
| fullnameOverride | string | `""` |  |
| imagePullSecrets | list | `[]` | list of imagePullSecrets to use |
| images.core | string | `"ghcr.io/openrailassociation/osrd-REPOSITORY_VERSION_REPLACE_ME/osrd-core:IMAGES_VERSION_REPLACE_ME"` |  |
| images.editoast | string | `"ghcr.io/openrailassociation/osrd-REPOSITORY_VERSION_REPLACE_ME/osrd-editoast:IMAGES_VERSION_REPLACE_ME"` |  |
| images.gateway | string | `"ghcr.io/openrailassociation/osrd-REPOSITORY_VERSION_REPLACE_ME/osrd-gateway:IMAGES_VERSION_REPLACE_ME-front"` |  |
| images.openfga | string | `"openfga/openfga:v1.8.6"` |  |
| images.osrdyne | string | `"ghcr.io/openrailassociation/osrd-REPOSITORY_VERSION_REPLACE_ME/osrd-osrdyne:IMAGES_VERSION_REPLACE_ME"` |  |
| labels | object | `{}` |  |
| nameOverride | string | `""` |  |
| nodeSelector | object | `{}` |  |
| pullPolicy | string | `"IfNotPresent"` |  |
| services | object | `{"core":{"affinity":{},"annotations":{},"autoscaling":{"type":"NoScaling"},"config":{"telemetry":null},"env":[],"labels":{},"nodeSelector":{},"resources":{},"service_account_name":null,"tolerations":[]},"editoast":{"affinity":{},"annotations":{},"cronjob":{"env":[],"extend":"","schedule":"3 1 * * mon-fri"},"enabled":true,"env":[],"hpa":{"annotations":{},"enabled":true,"labels":{},"maxReplicas":10,"minReplicas":2,"targetCPUUtilizationPercentage":80},"init":{"enabled":true,"extend":"","labels":{}},"labels":{},"livenessProbe":{"disabled":false,"initialDelaySeconds":0,"periodSeconds":10,"timeoutSeconds":3},"nodeSelector":{},"permanent_storage_class":null,"permanent_storage_size":null,"readinessProbe":{"disabled":false,"initialDelaySeconds":5,"periodSeconds":10,"timeoutSeconds":3},"replicaCount":2,"resources":{},"service":{"port":80,"targetPort":80,"type":"ClusterIP"},"tolerations":[]},"gateway":{"affinity":{},"annotations":{},"config":{"auth":{"providers":[{"provider_id":"mocked","type":"Mocked","username":"osrd-admin"}]},"railway_manager_interface":{"enabled":false,"prefix":"/railway-manager","upstream":""},"secret_key":null,"tracing":{"config":{},"enabled":false,"type":""},"trusted_proxies":["10.0.0.0/8","172.16.0.0/12","192.168.0.0/16"]},"enabled":true,"env":[],"ingress":{"annotations":{},"className":"","domains":["osrd.local"],"enabled":false,"secretName":"osrd-gateway-tls","tls":true},"labels":{},"livenessProbe":{"disabled":false},"nodeSelector":{},"readinessProbe":{"disabled":false},"replicaCount":1,"resources":{},"service":{"port":80,"targetPort":80,"type":"ClusterIP"},"tolerations":[],"volumeMounts":[],"volumes":[]},"images":{"affinity":{},"annotations":{},"enabled":true,"env":[],"labels":{},"nodeSelector":{},"replicaCount":1,"resources":{},"service":{"port":80,"targetPort":80,"type":"ClusterIP"},"tolerations":[]},"openfga":{"affinity":{},"annotations":{},"enabled":false,"env":[],"labels":{},"nodeSelector":{},"readinessProbe":{"disabled":false,"initialDelaySeconds":5,"periodSeconds":10,"timeoutSeconds":3},"replicaCount":2,"resources":{},"service":{"port":80,"targetPort":8080,"type":"ClusterIP"},"tolerations":[]},"osrdyne":{"affinity":{},"annotations":{},"config":{"api_address":"0.0.0.0:80","default_message_ttl":null,"max_length":null,"max_length_bytes":null,"pool_id":"core"},"enabled":true,"env":[],"labels":{},"livenessProbe":{"disabled":false,"initialDelaySeconds":5,"periodSeconds":10,"timeoutSeconds":3},"nodeSelector":{},"readinessProbe":{"disabled":false},"replicaCount":1,"resources":{},"service":{"port":80,"targetPort":80,"type":"ClusterIP"},"tolerations":[]},"statefulEditoast":{"affinity":{},"annotations":{},"enabled":true,"env":[],"labels":{},"livenessProbe":{"disabled":false,"initialDelaySeconds":0,"periodSeconds":10,"timeoutSeconds":3},"nodeSelector":{},"readinessProbe":{"disabled":false,"initialDelaySeconds":5,"periodSeconds":10,"timeoutSeconds":3},"replicaCount":1,"resources":{},"service":{"port":80,"targetPort":80,"type":"ClusterIP"},"tolerations":[]}}` | Services direct settings and overides |
| services.core.autoscaling | object | `{"type":"NoScaling"}` | autoscaling configuration of osrdyne KubernetesDriver detail in https://github.com/OpenRailAssociation/osrd/blob/dev/osrdyne/src/drivers/kubernetes.rs |
| services.core.autoscaling.type | string | `"NoScaling"` | Type of autoscaling |
| services.core.service_account_name | string, null | `nil` | Service account name to mount in case of kubernetes deployment |
| services.editoast.cronjob | object | `{"env":[],"extend":"","schedule":"3 1 * * mon-fri"}` | cronjob configuration. Runs editoast gc |
| services.editoast.cronjob.env | list | `[]` | list of env variable to pass to cronjob script. Editoast default service variables are already set |
| services.editoast.cronjob.extend | string, null | `""` | shell commands to be executed before editoast gc |
| services.editoast.cronjob.schedule | string, null | `"3 1 * * mon-fri"` | cronjob format time of execution. Set to null to disable |
| services.editoast.init | object | `{"enabled":true,"extend":"","labels":{}}` | Init job configuration |
| services.editoast.init.enabled | bool | `true` | Wheter to run editoast init pod for diesel migration |
| services.editoast.init.extend | string | `""` | Command to run after diesel migration |
| services.editoast.init.labels | object | `{}` | Labels for init pod |
| services.editoast.permanent_storage_class | string, null | `nil` | storage class for permanent storage |
| services.editoast.permanent_storage_size | string, null | `nil` | size in Kubernetes format for editoast shared storage mount in all hosts. null to disable permanent storage |
| services.gateway.config | object | `{"auth":{"providers":[{"provider_id":"mocked","type":"Mocked","username":"osrd-admin"}]},"railway_manager_interface":{"enabled":false,"prefix":"/railway-manager","upstream":""},"secret_key":null,"tracing":{"config":{},"enabled":false,"type":""},"trusted_proxies":["10.0.0.0/8","172.16.0.0/12","192.168.0.0/16"]}` | gateway authentication configuration see https://github.com/OpenRailAssociation/osrd/blob/dev/gateway/README.md |
| services.gateway.config.auth.providers | array | `[{"provider_id":"mocked","type":"Mocked","username":"osrd-admin"}]` | List of authentication providers |
| services.gateway.config.secret_key | string, null | `nil` | A secret key if not provided throug environment variable |
| services.gateway.ingress | object | `{"annotations":{},"className":"","domains":["osrd.local"],"enabled":false,"secretName":"osrd-gateway-tls","tls":true}` | Gateway ingress configuration |
| services.gateway.ingress.domains | list | `["osrd.local"]` | List of domains to serve |
| services.gateway.ingress.secretName | string | `"osrd-gateway-tls"` | Secret containing the tls certificates can be null |
| tolerations | list | `[]` |  |

## Contributing

To comply with the [DCO](http://developercertificate.org/), all commits must
include a Signed-off-by line. You can find more information about this [here](https://osrd.fr/en/docs/guides/contribute/contribute-code/commit-conventions/#the-developer-certificate-of-origin)

For more advice on how to contribute, follow that link:
https://osrd.fr/en/docs/guides/contribute/contribute-code
