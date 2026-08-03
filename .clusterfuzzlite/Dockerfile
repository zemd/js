# Digest pinned for reproducibility; the tag keeps dependabot able to track it.
FROM gcr.io/oss-fuzz-base/base-builder-javascript:v1@sha256:2e218dedc1603f15e34cec784030789e06db1df8eb5356f0a8e27285619ac8c2

COPY . $SRC/js
COPY ./.clusterfuzzlite/build.sh $SRC/

WORKDIR $SRC/js
