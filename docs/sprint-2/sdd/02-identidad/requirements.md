# Requisitos — Identidad, empresas y permisos

## Introducción

MayoristaPro es B2B: quien compra o vende es una **empresa** identificada por su RUC, y las personas actúan en su nombre con permisos. Este módulo cubre el alta de empresas, la revisión por el administrador, el inicio de sesión, las invitaciones de usuarios y la verificación del proveedor antes de publicar.

Origen: [T2 — Identidad y vinculación empresarial](../../identidad.md), decisión D1 de la [preparación del Sprint 2](../../00-preparacion-sprint-2.md).

## Glosario

- **Empresa habilitada:** alta aprobada por el administrador (`companies.status = 'enabled'`).
- **Proveedor verificado:** verificación administrativa separada que permite publicar.
- **Permisos:** `manage` (responsable), `buy` (comprar) y `publish` (vender), asignados a la vinculación usuario-empresa.
- **Administrador de plataforma:** cuenta con `platform_admin`; no pertenece a ninguna empresa.

## Requisitos

### Requisito 1: Registrar una empresa

**Historia de usuario:** Como representante de una empresa, quiero solicitar el alta con mi RUC, para comprar y vender en la plataforma.

#### Criterios de aceptación

1. CUANDO se envíe `POST /auth/register` con correo, contraseña (12 a 128 caracteres), RUC de 11 dígitos, razón social y evidencia, EL sistema DEBERÁ crear la solicitud en estado `pending`.
2. SI el correo o el RUC ya existen, ENTONCES EL sistema DEBERÁ responder 409 sin crear registros parciales.
3. EL registro público NO DEBERÁ conceder administración ni permisos enviados en el cuerpo.
4. MIENTRAS la solicitud esté pendiente, EL usuario NO DEBERÁ acceder a operaciones empresariales.

### Requisito 2: Revisión del administrador

**Historia de usuario:** Como administrador, quiero aprobar altas y verificar proveedores, para que solo empresas revisadas operen.

#### Criterios de aceptación

1. CUANDO el administrador apruebe una solicitud, EL sistema DEBERÁ habilitar la empresa y asignar `manage`, `buy` y `publish` al solicitante en una transacción; repetirlo NO DEBERÁ duplicar vinculaciones.
2. EL sistema DEBERÁ etiquetar la empresa como «revisado manualmente» (no se consulta SUNAT).
3. CUANDO el administrador verifique al proveedor (`PATCH /providers/:id/verify`), EL sistema DEBERÁ permitir publicar; antes de eso, nadie de la empresa DEBERÁ poder publicar.

### Requisito 3: Sesión segura

**Historia de usuario:** Como usuario, quiero iniciar sesión de forma segura y que mi sesión se recupere al recargar.

#### Criterios de aceptación

1. EL sistema DEBERÁ almacenar contraseñas con scrypt y sal aleatoria.
2. CUANDO las credenciales sean correctas, EL sistema DEBERÁ emitir un token opaco de 256 bits válido por 8 horas y guardar solo su hash SHA-256.
3. SI las credenciales son incorrectas, ENTONCES EL sistema DEBERÁ responder 401 «Credenciales inválidas» sin revelar si el correo existe.
4. CUANDO se recargue el navegador, EL sistema DEBERÁ restaurar la sesión mediante una cookie HttpOnly (Secure en HTTPS) y rechazar orígenes ajenos.
5. CUANDO se cierre la sesión, EL sistema DEBERÁ invalidarla.

### Requisito 4: Invitar y revocar usuarios

**Historia de usuario:** Como responsable de la empresa, quiero invitar compañeros con permisos específicos y revocarlos, para trabajar en equipo.

#### Criterios de aceptación

1. CUANDO el responsable cree una invitación para un correo con permisos `buy`, `publish` o ambos, EL sistema DEBERÁ generar un enlace de un solo uso, válido por 1, 7 o 30 días según elija.
2. EL sistema DEBERÁ guardar solo el hash del token y consumirlo una sola vez, incluso con solicitudes simultáneas.
3. CUANDO el responsable revoque a un usuario de su empresa, EL sistema DEBERÁ eliminar sus sesiones y rechazar sus operaciones siguientes.
4. EL responsable NO DEBERÁ poder revocar a usuarios de otra empresa ni revocarse a sí mismo.
