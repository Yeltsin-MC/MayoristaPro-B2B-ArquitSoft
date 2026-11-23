# Tareas — Avisos y «Volver a pedir»

- [x] 1. Migración `012_notifications.sql` con la tabla, los índices y la función `notify_trade_event()`
  - [x] 1.1 Triggers en `quotation_recipients`, `quotation_offers`, `quotation_requests` y `trade_orders`
  - _Requisitos: 1.1–1.6_
- [x] 2. `GET /notifications` (últimos 20 y no leídos) y `POST /notifications/read`, filtrados por empresa
  - _Requisitos: 2.2–2.4_
- [x] 3. Campana en Angular con contador, panel desplegable y consulta cada 30 s
  - [x] 3.1 Mostrarla solo a usuarios de empresa con permisos
  - _Requisitos: 2.1, 2.4_
- [x] 4. Extraer `createRequest()` y crear `POST /orders/:id/reorder`
  - _Requisitos: 3.1–3.4_
- [x] 5. Botón «↻ Volver a pedir» en pedidos entregados
  - _Requisitos: 3.1_
- [x] 6. Documentar en OpenAPI y agregar pruebas de integración
  - _Requisitos: todos_
- [ ] 7. Avisos por correo o WhatsApp (fuera de alcance de la demo)
