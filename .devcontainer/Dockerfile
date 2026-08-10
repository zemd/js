# syntax=docker/dockerfile:1

FROM ghcr.io/zizmorcore/zizmor:1.29.0@sha256:863026d54f91271b10b60b67ad8054cb37120167e162482597db102b3026a284 AS zizmor

FROM mcr.microsoft.com/devcontainers/javascript-node:5-26-bookworm

COPY --from=zizmor /usr/bin/zizmor /usr/local/bin/zizmor

RUN zizmor --version
