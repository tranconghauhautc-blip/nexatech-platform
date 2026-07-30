{{- define "nexatech.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "nexatech.fullname" -}}
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

{{- define "nexatech.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "nexatech.labels" -}}
helm.sh/chart: {{ include "nexatech.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: nexatech
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}

{{- define "nexatech.selectorLabels" -}}
app.kubernetes.io/name: {{ include "nexatech.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "nexatech.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "nexatech.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "nexatech.appImage" -}}
{{- $root := index . 0 -}}
{{- $app := index . 1 -}}
{{- $registry := $root.Values.global.imageRegistry -}}
{{- $repo := $root.Values.global.imageRepository -}}
{{- $tag := default $root.Values.global.imageTag $app.image.tag -}}
{{- $name := $app.image.name -}}
{{- if $registry -}}
{{- printf "%s/%s/%s:%s" $registry $repo $name $tag -}}
{{- else -}}
{{- printf "%s/%s:%s" $repo $name $tag -}}
{{- end -}}
{{- end -}}
