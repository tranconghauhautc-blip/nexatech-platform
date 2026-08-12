{{- define "vulncart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "vulncart.fullname" -}}
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

{{- define "vulncart.labels" -}}
app.kubernetes.io/name: {{ include "vulncart.name" . }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: vulncart
{{- end -}}

{{- define "vulncart.databaseUrl" -}}
{{- if .Values.secret.databaseUrl -}}
{{- .Values.secret.databaseUrl -}}
{{- else -}}
postgresql://{{ .Values.postgres.username }}:{{ .Values.secret.postgresPassword }}@{{ include "vulncart.fullname" . }}-postgres:5432/{{ .Values.postgres.database }}
{{- end -}}
{{- end -}}
