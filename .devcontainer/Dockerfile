# syntax=docker/dockerfile:1

FROM ghcr.io/zizmorcore/zizmor:1.32.0@sha256:3014cc8f68f663935f69b3c3e0e41f5ce102b268d97db13db0f62208747f860d AS zizmor

FROM mcr.microsoft.com/devcontainers/javascript-node:5-26-bookworm@sha256:c801953dbbf8b631da22f62e8897e997d5f2c02f0b03e6d0b845a288b579a112

COPY --from=zizmor /usr/bin/zizmor /usr/local/bin/zizmor

RUN zizmor --version

USER node
