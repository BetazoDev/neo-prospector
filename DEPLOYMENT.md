# Despliegue seguro en Dokploy

La aplicación no guarda la base de datos dentro de su contenedor. Configure estas variables **solo en los secretos de runtime de Dokploy**:

- `DATABASE_URL`: URL interna del servicio PostgreSQL de Dokploy.
- `DATABASE_EXPECTED_HOST`: hostname interno de ese mismo servicio, sin puerto. Si no se define, la aplicación protege el hostname actual de Dokploy; configúralo si ese servicio cambia.
- `JWT_SECRET`, `APIFY_API_KEY`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
- `APP_URL` (opcional): URL pública de la aplicación, por ejemplo
  `https://prospector.diabolicalservices.tech`. Si está definida, cada búsqueda adjunta un
  webhook y Apify avisa en cuanto termina, así que los leads aparecen de inmediato. Si no
  lo está, las búsquedas terminadas se recuperan igual al abrir el panel, solo que con
  algo de retraso.
- `ALLOW_DATABASE_INITIALIZATION=false`: déjelo así en operación normal. Sólo se
  permite `true` en el único arranque que inicializa una base nueva de forma
  deliberada; elimínelo inmediatamente cuando el log confirme la inicialización.

No agregue `.env` ni `.env.local` a la imagen. El contexto Docker los excluye deliberadamente; `.env.example` es solo una plantilla.

En producción el arranque verifica que la URL no apunte a `localhost`, que coincida con `DATABASE_EXPECTED_HOST`, que PostgreSQL responda, y ejecuta únicamente `prisma migrate deploy`. Si cualquiera de esos pasos falla, la aplicación no inicia. Después exige un marcador persistente de inicialización. Una base nueva, vacía o restaurada sin ese marcador queda bloqueada, en vez de crear silenciosamente un administrador y aparentar una recuperación.

En un arranque normal no se crea ningún usuario. Sólo durante una inicialización autorizada, la aplicación exige `ADMIN_EMAIL` y `ADMIN_PASSWORD`, crea el administrador si falta y guarda el marcador. El comando manual `npm run db:bootstrap-admin` sigue disponible para operaciones controladas, pero no sustituye esa protección.

Para una comprobación de solo lectura de la conexión y los conteos actuales:

```bash
npm run db:check -- --require-schema
```

## PostgreSQL en Dokploy

El servicio `neodatabase` debe usar un **volumen Docker nombrado persistente** en su
`PGDATA` real (normalmente `/var/lib/postgresql/data`). No use un directorio del
contenedor ni un volumen anónimo. Antes de tocar montajes, identifique el volumen
actual, haga un backup y no ejecute ninguna acción que lo elimine o lo reemplace.

Configure restart policy y health checks en el servicio PostgreSQL y en la app. El
health check de PostgreSQL debe usar `pg_isready`; configure el de la app como
`GET /api/health` en el puerto `3000`. Este endpoint responde `200` sólo si
PostgreSQL es accesible y contiene el marcador de inicialización; en los demás
casos responde `503`.

## Backup local diario (VPS)

Instale `ops/backup-postgres.sh` y `ops/verify-postgres-backup.sh` en el VPS con
permisos de ejecución. Se ejecutan desde el host Docker, no desde el contenedor de
la aplicación. Configure secretos y valores de conexión en un archivo root-only,
por ejemplo `/etc/neoprospector-backup.env`:

```bash
POSTGRES_CONTAINER='nombre-real-del-contenedor-postgres'
POSTGRES_USER='usuario-postgres'
POSTGRES_DATABASE='postgres'
POSTGRES_CLIENT_IMAGE='postgres:17-alpine'
BACKUP_DIR='/var/backups/neoprospector'
KEEP_DAYS='30'
RESTORE_TEST_DATABASE='neoprospector_restore_verify'
```

Programe el backup diario y la comprobación de restauración semanal con cron:

```cron
15 02 * * * root . /etc/neoprospector-backup.env && /ruta/al/repositorio/ops/backup-postgres.sh >> /var/log/neoprospector-backup.log 2>&1
30 03 * * 0 root . /etc/neoprospector-backup.env && /ruta/al/repositorio/ops/verify-postgres-backup.sh >> /var/log/neoprospector-backup-verify.log 2>&1
```

El script de verificación restaura el último backup en una base temporal del mismo
clúster, comprueba las tablas y el marcador, y la elimina al finalizar. El resultado
queda en el log de cron. Estos backups viven sólo en el VPS y no protegen ante la
pérdida completa de ese servidor.

## Recuperación

1. Detenga la aplicación y restaure el backup a PostgreSQL.
2. Verifique `npm run db:check -- --require-schema` desde la app y confirme los conteos.
3. Arranque la app sin `ALLOW_DATABASE_INITIALIZATION`; debe reconocer el marcador existente.
4. Use `ALLOW_DATABASE_INITIALIZATION=true` sólo al crear intencionalmente una base sin datos, y retírelo después de ese único arranque.
