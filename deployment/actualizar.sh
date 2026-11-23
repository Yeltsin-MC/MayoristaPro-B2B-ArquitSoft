#!/usr/bin/env bash
# Actualiza la demo publicada en EC2 a un commit de main cuyas imágenes ya publicó
# «Preparar imágenes para AWS». Uso, desde la terminal de EC2:
#   bash ~/mayoristapro/deployment/actualizar.sh <SHA-completo> [--fotos]
# --fotos vuelve a cargar el catálogo demo (fotos y descripciones); pide las dos contraseñas sin mostrarlas.
set -euo pipefail

sha="${1:-}"
if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Indica el SHA completo (40 caracteres) de la ejecución en verde de «Preparar imágenes para AWS»." >&2
  exit 1
fi
cd "$(dirname "$0")/.."
compose=(sudo docker compose --env-file .env.demo -f compose.yaml -f compose.demo.yaml -f compose.aws.yaml --profile cache)

echo "1/5 Respaldo de la base de datos"
mkdir -p ~/respaldos
respaldo=~/respaldos/antes-$(date +%Y%m%d-%H%M).sql.gz
"${compose[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$respaldo"
ls -lh "$respaldo"

echo "2/5 Código de la versión $sha"
git fetch -q origin main
git checkout -q --detach "$sha"
sed -i "s/^RELEASE_SHA=.*/RELEASE_SHA=$sha/" .env.demo

echo "3/5 Descarga de imágenes"
"${compose[@]}" pull -q

echo "4/5 Arranque (las migraciones se aplican solas)"
sudo docker ps -aq --filter name=migrate-run | xargs -r sudo docker rm -f
"${compose[@]}" up -d --no-build --wait

if [[ "${2:-}" == "--fotos" ]]; then
  echo "Carga del catálogo demo"
  read -rsp "Contraseña del admin: " ADMIN_PASSWORD; echo
  read -rsp "Contraseña de las empresas demo: " DEMO_PASSWORD; echo
  export ADMIN_PASSWORD DEMO_PASSWORD
  sudo --preserve-env=ADMIN_PASSWORD,DEMO_PASSWORD timeout 300 "${compose[@]:1}" run --rm --no-deps \
    -e ADMIN_PASSWORD -e DEMO_PASSWORD migrate node deployment/start.cjs load-demo
  unset ADMIN_PASSWORD DEMO_PASSWORD
fi

echo "5/5 Comprobación"
curl -fsS 'http://127.0.0.1:8080/api/v1/products?limit=1' > /dev/null && echo "La API responde."
"${compose[@]}" ps --format 'table {{.Name}}\t{{.Status}}'
echo "Listo. Si algo falla, el respaldo está en $respaldo"
