#!/usr/bin/env bash
# Yerelden sunucuya dağıtım. Kodu /opt/barmaksan/app'e gönderir, imajı derler,
# yalnızca barmaksan_api konteynerini yeniler. Veriye (/opt/barmaksan/data) dokunmaz.
#
#   deploy/deploy.sh            kodu gönder + derle + yeniden başlat
#   deploy/deploy.sh --seed     ek olarak örnek veriyi sıfırdan kur (veriyi siler!)
set -euo pipefail

HOST="${BARMAKSAN_HOST:-root@213.142.159.36}"
cd "$(dirname "$0")/.."

echo "→ kod gönderiliyor"
COPYFILE_DISABLE=1 tar --no-xattrs \
  --exclude='./node_modules' --exclude='./server/node_modules' --exclude='./web/node_modules' \
  --exclude='./web/dist' --exclude='./data' --exclude='./.git' --exclude='./.claude' \
  --exclude='./docs/brief/audio' --exclude='*.tiff' --exclude='.DS_Store' \
  -czf - . | ssh "$HOST" 'mkdir -p /opt/barmaksan/app && tar -xzf - -C /opt/barmaksan/app'

echo "→ imaj derleniyor"
ssh "$HOST" 'cd /opt/barmaksan/app/deploy && docker-compose build --quiet'

if [[ "${1:-}" == "--seed" ]]; then
  echo "→ örnek veri sıfırdan kuruluyor"
  ssh "$HOST" 'cd /opt/barmaksan/app/deploy && docker-compose stop api \
    && docker-compose run --rm --no-deps -T api node server/seed/seed.js --reset'
fi

echo "→ konteyner yenileniyor"
ssh "$HOST" 'cd /opt/barmaksan/app/deploy && docker-compose up -d && sleep 3 && curl -fsS http://127.0.0.1:8096/api/health && echo'
echo "✓ https://barmaksan.chenki.net"
