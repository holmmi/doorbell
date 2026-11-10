#!/bin/sh
set -eu

: "${PORT:=8000}"

sed "s/__PORT__/${PORT}/g" \
  /etc/nginx/templates/default.conf.template \
  > /etc/nginx/http.d/default.conf

npm run start --workspace=doorbell-backend &
backend_pid=$!

nginx -t
nginx -g 'daemon off;' &
nginx_pid=$!

cleanup() {
  kill "$backend_pid" "$nginx_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 1
done

if ! kill -0 "$backend_pid" 2>/dev/null; then
  wait "$backend_pid"
fi

if ! kill -0 "$nginx_pid" 2>/dev/null; then
  wait "$nginx_pid"
fi
