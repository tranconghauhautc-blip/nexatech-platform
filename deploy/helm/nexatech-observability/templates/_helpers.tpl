{{- define "nexatech-observability.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "nexatech-observability.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "nexatech-observability.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "nexatech-observability.labels" -}}
helm.sh/chart: {{ include "nexatech-observability.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: nexatech-observability
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}

{{- define "nexatech-observability.componentLabels" -}}
{{- $ctx := index . 0 -}}
{{- $component := index . 1 -}}
{{- include "nexatech-observability.labels" $ctx }}
app.kubernetes.io/name: {{ include "nexatech-observability.name" $ctx }}
app.kubernetes.io/instance: {{ $ctx.Release.Name }}
app.kubernetes.io/component: {{ $component }}
{{- end -}}

{{- define "nexatech-observability.selectorLabels" -}}
{{- $ctx := index . 0 -}}
{{- $component := index . 1 -}}
app.kubernetes.io/name: {{ include "nexatech-observability.name" $ctx }}
app.kubernetes.io/instance: {{ $ctx.Release.Name }}
app.kubernetes.io/component: {{ $component }}
{{- end -}}

{{- define "nexatech-observability.prometheusUrl" -}}
http://{{ include "nexatech-observability.fullname" . }}-prometheus:{{ .Values.prometheus.service.port }}
{{- end -}}

{{- define "nexatech-observability.lokiUrl" -}}
http://{{ include "nexatech-observability.fullname" . }}-loki:{{ .Values.loki.service.port }}
{{- end -}}

{{- define "nexatech-observability.tempoUrl" -}}
http://{{ include "nexatech-observability.fullname" . }}-tempo:{{ .Values.tempo.service.port }}
{{- end -}}

{{- define "nexatech-observability.storageClass" -}}
{{- $sc := .Values.global.storageClass -}}
{{- if .storageClass -}}
{{- .storageClass -}}
{{- else -}}
{{- $sc -}}
{{- end -}}
{{- end -}}
