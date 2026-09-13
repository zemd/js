# syntax=docker/dockerfile:1

FROM ghcr.io/zizmorcore/zizmor:1.30.1@sha256:a2eb396d886c053073405c7a980f2139ba2248ec172243cfa3841e57196e8101 AS zizmor

FROM mcr.microsoft.com/devcontainers/javascript-node:5-26-bookworm@sha256:4187a9d50e7a208659e9b56677ae764edb98cb6dc243f21e851aab2ca4d103ba

COPY --from=zizmor /usr/bin/zizmor /usr/local/bin/zizmor

RUN zizmor --version

USER node
