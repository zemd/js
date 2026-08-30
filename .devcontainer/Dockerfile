# syntax=docker/dockerfile:1

FROM ghcr.io/zizmorcore/zizmor:1.29.0@sha256:863026d54f91271b10b60b67ad8054cb37120167e162482597db102b3026a284 AS zizmor

FROM mcr.microsoft.com/devcontainers/javascript-node:5-26-bookworm@sha256:3171cac7c483b2dcbbab44b49e6cbc2d52e2b2b7faf81177c2bcb3648b957cf3

COPY --from=zizmor /usr/bin/zizmor /usr/local/bin/zizmor

RUN zizmor --version

USER node
