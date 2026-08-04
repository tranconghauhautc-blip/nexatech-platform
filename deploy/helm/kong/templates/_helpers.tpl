{{- define "nexatech-kong.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "nexatech-kong.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "nexatech-kong.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "nexatech-kong.labels" -}}
app.kubernetes.io/name: {{ include "nexatech-kong.name" . }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
nexatech.io/component: kong
{{- end -}}

{{- define "nexatech-kong.selectorLabels" -}}
app.kubernetes.io/name: {{ include "nexatech-kong.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
