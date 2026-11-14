# Publicar la demo académica en EC2

GitHub Actions construye las imágenes Linux amd64. Una vez integrada la preparación, ejecutar **Preparar imágenes para AWS** desde Actions sobre `main`. La ejecución comprueba el arranque y los 450 productos antes de publicar las tres imágenes en GHCR. Usar el SHA completo de esa ejecución y su misma revisión de los archivos Compose en EC2.

Crear un archivo privado `.env.demo` a partir de `.env.demo.example`. Mantener los puertos predeterminados. Configurar `GHCR_IMAGE_PREFIX=ghcr.io/yeltsin-mc/mayoristapro-b2b-arquitsoft`, `RELEASE_SHA`, `PUBLIC_BASE_URL=https://mayoristapro.shop` y una contraseña PostgreSQL aleatoria. Dejar las credenciales de Mercado Pago vacías para la demo simulada. Si GHCR requiere autenticación, iniciar sesión con una credencial de solo lectura para paquetes.

Desde la raíz en EC2:

```bash
compose=(docker compose --env-file .env.demo -f compose.yaml -f compose.demo.yaml -f compose.aws.yaml --profile cache)
"${compose[@]}" config --quiet
"${compose[@]}" pull
"${compose[@]}" up -d --wait db redis
```

Solo al inicializar la base, proporcionar `ADMIN_PASSWORD` y `DEMO_PASSWORD` como variables de entorno exportadas, con valores distintos de 12 a 128 caracteres. Cargar el catálogo y retirar esas variables de la sesión:

```bash
"${compose[@]}" run --rm --no-deps -e ADMIN_PASSWORD -e DEMO_PASSWORD migrate node deployment/start.cjs load-demo
unset ADMIN_PASSWORD DEMO_PASSWORD
```

Luego iniciar los servicios y comprobar Nginx:

```bash
"${compose[@]}" up -d --no-build --wait
curl --fail 'http://127.0.0.1:8080/api/v1/products?limit=1'
```

En actualizaciones, respaldar PostgreSQL, cambiar el SHA, descargar las imágenes y repetir el arranque. El volumen guarda los datos entre versiones. Cuando Cloudflare active el dominio, conectar un túnel ejecutado en el host a `http://127.0.0.1:8080`. Sustituir el registro A importado que ocupa el nombre raíz y validar catálogo, acceso y cotización desde la URL HTTPS.
