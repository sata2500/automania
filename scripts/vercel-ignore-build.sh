#!/usr/bin/env bash
# Vercel "Ignored Build Step": çıkış 0 = derlemeyi atla, 1 = derle.
# Son başarılı dağıtımdan bu yana yalnızca uygulamaya girmeyen dosyalar (testler, belgeler, CI) değiştiyse
# derleme yapılmaz; derleme dakikası harcanmaz. Karşılaştırılacak sürüm bulunamazsa her zaman derlenir.
PREVIOUS="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$PREVIOUS" ] || ! git cat-file -e "${PREVIOUS}^{commit}" 2>/dev/null; then
  exit 1
fi

if git diff --quiet "$PREVIOUS" HEAD -- . \
  ':(exclude)*.md' \
  ':(exclude)**/*.md' \
  ':(exclude)**/*.test.ts' \
  ':(exclude)**/*.test.tsx' \
  ':(exclude).github/**' \
  ':(exclude)e2e/**' \
  ':(exclude)playwright.config.*' \
  ':(exclude)vitest.config.*'; then
  echo "Yalnızca test, belge veya CI dosyaları değişti; derleme atlandı."
  exit 0
fi
exit 1
