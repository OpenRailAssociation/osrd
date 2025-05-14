{{/*
Expand the name of the chart.
*/}}
{{- define "osrd.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "osrd.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "osrd.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels OpenFGA
*/}}
{{- define "osrd.labels.openfga" -}}
helm.sh/chart: {{ include "osrd.chart" . }}
{{ include "osrd.selectorLabels.openfga" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels OpenFGA
*/}}
{{- define "osrd.selectorLabels.openfga" -}}
app.kubernetes.io/name: {{ include "osrd.name" . }}-openfga
app.kubernetes.io/instance: {{ .Release.Name }}-openfga
{{- end }}

{{/*
Common labels Osrdyne
*/}}
{{- define "osrd.labels.osrdyne" -}}
helm.sh/chart: {{ include "osrd.chart" . }}
{{ include "osrd.selectorLabels.osrdyne" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels Osrdyne
*/}}
{{- define "osrd.selectorLabels.osrdyne" -}}
app.kubernetes.io/name: {{ include "osrd.name" . }}-osrdyne
app.kubernetes.io/instance: {{ .Release.Name }}-osrdyne
{{- end }}

{{/*
Common labels Editoast
*/}}
{{- define "osrd.labels.editoast" -}}
helm.sh/chart: {{ include "osrd.chart" . }}
{{ include "osrd.selectorLabels.editoast" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels Editoast
*/}}
{{- define "osrd.selectorLabels.editoast" -}}
app.kubernetes.io/name: {{ include "osrd.name" . }}-editoast
app.kubernetes.io/instance: {{ .Release.Name }}-editoast
{{- end }}

{{/*
Common labels stateful Editoast
*/}}
{{- define "osrd.labels.statefulEditoast" -}}
helm.sh/chart: {{ include "osrd.chart" . }}
{{ include "osrd.selectorLabels.statefulEditoast" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels stateful Editoast
*/}}
{{- define "osrd.selectorLabels.statefulEditoast" -}}
app.kubernetes.io/name: {{ include "osrd.name" . }}-stateful-editoast
app.kubernetes.io/instance: {{ .Release.Name }}-stateful-editoast
{{- end }}

{{/*
Common labels Gateway
*/}}
{{- define "osrd.labels.gateway" -}}
helm.sh/chart: {{ include "osrd.chart" . }}
{{ include "osrd.selectorLabels.gateway" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels Gateway
*/}}
{{- define "osrd.selectorLabels.gateway" -}}
app.kubernetes.io/name: {{ include "osrd.name" . }}-gateway
app.kubernetes.io/instance: {{ .Release.Name }}-gateway
{{- end }}


{{/*
Common labels Images
*/}}
{{- define "osrd.labels.images" -}}
helm.sh/chart: {{ include "osrd.chart" . }}
{{ include "osrd.selectorLabels.images" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels Images
*/}}
{{- define "osrd.selectorLabels.images" -}}
app.kubernetes.io/name: {{ include "osrd.name" . }}-images
app.kubernetes.io/instance: {{ .Release.Name }}-images
{{- end }}
