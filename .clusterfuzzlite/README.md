# ClusterFuzzLite build integration

[ClusterFuzzLite](https://google.github.io/clusterfuzzlite/) builds and runs the fuzz
targets from [`../internal/fuzz`](../internal/fuzz) directly in this repository's CI. It
reuses the OSS-Fuzz build toolchain, but the project is self-hosted: nothing is registered
with, or reported to, the OSS-Fuzz infrastructure.

| File           | Purpose                                                          |
| -------------- | ---------------------------------------------------------------- |
| `project.yaml` | Language, sanitizer and fuzzing engine used to build the targets |
| `Dockerfile`   | Build image; copies the working tree into the container          |
| `build.sh`     | Builds the workspace and compiles each target into `$OUT`        |

The workflows that drive it are `.github/workflows/cflite_pr.yml` (fuzz code changed by a
pull request), `cflite_batch.yml` (nightly batch fuzzing) and `cflite_cron.yml` (weekly
corpus pruning and coverage report). Crashing inputs, corpora and coverage reports are
uploaded as workflow artifacts.

## Testing the integration locally

Requires Docker and a checkout of [OSS-Fuzz](https://github.com/google/oss-fuzz), which
provides the `helper.py` driver. `--external` is what makes it read `.clusterfuzzlite`
from this repository instead of looking the project up in the OSS-Fuzz project list.

```shell
git clone https://github.com/google/oss-fuzz.git
cd oss-fuzz
export PATH_TO_PROJECT=/path/to/js

python3 infra/helper.py build_image --external "$PATH_TO_PROJECT"
python3 infra/helper.py build_fuzzers --external "$PATH_TO_PROJECT" --sanitizer none
python3 infra/helper.py check_build --external "$PATH_TO_PROJECT" --sanitizer none
python3 infra/helper.py run_fuzzer --external --corpus-dir=/tmp/corpus \
  "$PATH_TO_PROJECT" fuzz_http_client_headers
```

For quick iteration on a target itself, run Jazzer.js directly instead — see
[`../internal/fuzz/README.md`](../internal/fuzz/README.md).
