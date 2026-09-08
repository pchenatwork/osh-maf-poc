# syntax=docker/dockerfile:1
#
# Build context is this folder (api/). On Render set:
#   Language        = Docker
#   Root Directory  = api
#   Dockerfile Path = ./Dockerfile

# ---- build ------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore on the project files alone, so a source-only change reuses the
# cached NuGet layer. Both Directory.Build.props files take part in restore.
COPY Directory.Build.props ./
COPY Osh.Maf.Data/Osh.Maf.Data.csproj  Osh.Maf.Data/
COPY Osh.Maf.Api/Osh.Maf.Api.csproj    Osh.Maf.Api/
COPY Osh.Maf.Api/Directory.Build.props Osh.Maf.Api/
RUN dotnet restore Osh.Maf.Api/Osh.Maf.Api.csproj

COPY Osh.Maf.Data/ Osh.Maf.Data/
COPY Osh.Maf.Api/  Osh.Maf.Api/

# _formDef/*.json rides along because Osh.Maf.Data.csproj marks it
# CopyToOutputDirectory — publish honours that. The tests project is not
# referenced here, so it is neither restored nor built.
RUN dotnet publish Osh.Maf.Api/Osh.Maf.Api.csproj -c Release -o /app --no-restore

# ---- runtime ----------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app .

# Fail fast if the form definitions did not make it into the image: without
# them every GET /fhir/Questionnaire returns a DirectoryNotFoundException,
# and a container that starts and then 500s is harder to diagnose than one
# that refuses to build.
RUN test -d /app/_formDef && ls /app/_formDef/*.json

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

# Render injects PORT at runtime. Shell form so ${PORT} is expanded then,
# not baked in at build time.
CMD ASPNETCORE_HTTP_PORTS=${PORT:-8080} dotnet Osh.Maf.Api.dll
