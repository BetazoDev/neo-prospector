# Despliegue seguro en Dokploy

La aplicación no guarda la base de datos dentro de su contenedor. Configure estas variables **solo en los secretos de runtime de Dokploy**:

- `DATABASE_URL`: URL interna del servicio PostgreSQL de Dokploy.
- `DATABASE_EXPECTED_HOST`: hostname interno de ese mismo servicio, sin puerto. Si no se define, la aplicación protege el hostname actual de Dokploy; configúralo si ese servicio cambia.
- `JWT_SECRET`, `APIFY_API_KEY`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

No agregue `.env` ni `.env.local` a la imagen. El contexto Docker los excluye deliberadamente; `.env.example` es solo una plantilla.

En producción el arranque verifica que la URL no apunte a `localhost`, que coincida con `DATABASE_EXPECTED_HOST`, que PostgreSQL responda, y ejecuta únicamente `prisma migrate deploy`. Si cualquiera de esos pasos falla, la aplicación no inicia.

Después del primer despliegue de una base nueva, ejecute una sola vez en la consola del contenedor:

```bash
npm run db:bootstrap-admin
```

El comando no crea tablas y no cambia un administrador existente. Las tablas pertenecen exclusivamente a las migraciones Prisma.

Para una comprobación de solo lectura de la conexión y los conteos actuales:

```bash
npm run db:check -- --require-schema
```

Configure copias semanales de PostgreSQL en Dokploy con una retención de 30 días y pruebe la restauración en una base separada.
