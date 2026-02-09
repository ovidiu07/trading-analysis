#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${BACKEND_DIR}"

JAVA_21_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
if [[ -n "${JAVA_21_HOME}" ]]; then
  export JAVA_HOME="${JAVA_21_HOME}"
  export PATH="${JAVA_HOME}/bin:${PATH}"
fi

mvn -Dtest=VerificationEmailComposerTest#composeWritesPreviewHtmlFilesForManualClientChecks test

printf "\nPreview files generated:\n"
printf "%s\n" "- ${BACKEND_DIR}/target/mail-preview/verification-en.html"
printf "%s\n" "- ${BACKEND_DIR}/target/mail-preview/verification-ro.html"
