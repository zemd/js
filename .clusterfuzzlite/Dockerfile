# Digest pinned for reproducibility; the tag keeps dependabot able to track it.
FROM gcr.io/oss-fuzz-base/base-builder-javascript:v1@sha256:2e218dedc1603f15e34cec784030789e06db1df8eb5356f0a8e27285619ac8c2

# The base image ships Node.js 20, but pnpm 11 needs at least Node.js 22.13 (it imports
# node:sqlite). Jazzer.js only uses N-API, so the runner image's Node.js stays compatible.
ENV NODE_VERSION=22.23.2
ENV NODE_SHA256=b294a556e639d64338823920e5866c21c02741742d2e1529ee1a225c1ec9252a
RUN curl -fsSLo /tmp/node.tar.gz "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz" \
  && echo "${NODE_SHA256}  /tmp/node.tar.gz" | sha256sum -c - \
  && mkdir -p /opt/node \
  && tar -xzf /tmp/node.tar.gz -C /opt/node --strip-components=1 \
  && rm /tmp/node.tar.gz
ENV PATH="/opt/node/bin:${PATH}"

COPY . $SRC/js
COPY ./.clusterfuzzlite/build.sh $SRC/

COPY ./.clusterfuzzlite/compile /opt/cflite/compile
RUN chmod +x /opt/cflite/compile
ENV PATH="/opt/cflite:${PATH}"

WORKDIR $SRC/js
