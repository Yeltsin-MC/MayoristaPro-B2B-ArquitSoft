# Tareas — Identidad, empresas y permisos

- [x] 1. Migración `002_identity.sql` con empresas, cuentas, vinculaciones, solicitudes, sesiones, invitaciones y auditoría
  - _Requisitos: 1.1, 2.1, 3.2, 4.2_
- [x] 2. Registro de empresa con validación de RUC, correo y contraseña; 409 sin altas parciales
  - _Requisitos: 1.1–1.4_
- [x] 3. Script `npm run identity:admin` para crear al administrador sin exponer la contraseña
  - _Requisitos: 2.1_
- [x] 4. Aprobación transaccional e idempotente, y verificación separada del proveedor
  - _Requisitos: 2.1–2.3_
- [x] 5. Inicio de sesión con scrypt, token opaco y sesión de 8 horas
  - [x] 5.1 Cookie HttpOnly y `GET /auth/restore` para recuperar la sesión al recargar
  - [x] 5.2 Cierre de sesión e invalidación
  - _Requisitos: 3.1–3.5_
- [x] 6. Invitaciones de un solo uso con vigencia de 1, 7 o 30 días, y revocación de miembros
  - _Requisitos: 4.1–4.4_
- [x] 7. Pantallas Angular: Mi cuenta en paneles, Registrar mi empresa, Aceptar invitación y Panel de administración
  - _Requisitos: 1.1, 2.1, 4.1_
- [x] 8. Pruebas de integración con esquema aislado y pruebas de navegador por rol
  - _Requisitos: todos_
