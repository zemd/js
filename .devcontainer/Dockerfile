# syntax=docker/dockerfile:1

FROM ghcr.io/zizmorcore/zizmor:1.30.0@sha256:1ba0035c343f50e85fde29beb0d78e4db448eaa0c762a11a09805d241424ee03 AS zizmor

FROM mcr.microsoft.com/devcontainers/javascript-node:5-26-bookworm@sha256:3171cac7c483b2dcbbab44b49e6cbc2d52e2b2b7faf81177c2bcb3648b957cf3

COPY --from=zizmor /usr/bin/zizmor /usr/local/bin/zizmor

RUN zizmor --version

USER node
