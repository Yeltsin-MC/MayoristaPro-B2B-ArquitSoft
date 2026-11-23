# Requisitos — Moderación del administrador

## Introducción

Un marketplace abierto necesita control: si un proveedor publica algo prohibido o engañoso, o una empresa comete abusos, el administrador de la plataforma debe poder actuar rápido, explicar el motivo y dejar constancia. Este módulo agrega retiro de productos, suspensión de empresas y una bitácora de moderación.

## Glosario

- **Producto retirado:** producto que el administrador ocultó (`retired_at`); su dueño no puede volver a publicarlo.
- **Empresa suspendida:** empresa con `status = 'suspended'`; sus usuarios no pueden ingresar y su catálogo se oculta.
- **Bitácora de moderación:** registro inmutable `moderation_actions` con quién, qué, sobre qué, por qué y cuándo.

## Requisitos

### Requisito 1: Retirar y restaurar productos

**Historia de usuario:** Como administrador, quiero retirar un producto indebido del catálogo con un motivo, para proteger a los compradores.

#### Criterios de aceptación

1. CUANDO el administrador retire un producto con un motivo de 5 a 500 caracteres, EL sistema DEBERÁ despublicarlo, guardar fecha y motivo, y registrar la acción en la bitácora en la misma transacción.
2. MIENTRAS un producto esté retirado, EL catálogo público NO DEBERÁ mostrarlo, y SI su dueño intenta publicarlo (manualmente o por carga masiva), ENTONCES EL sistema DEBERÁ rechazarlo con el motivo: «El administrador retiró este producto. Motivo: …».
3. CUANDO el administrador restaure el producto con un motivo, EL sistema DEBERÁ quitar el retiro y volver a publicarlo solo si su stock alcanza el pedido mínimo.
4. EL administrador DEBERÁ ver la lista de productos retirados con su motivo.
5. SI quien retira no es administrador, ENTONCES EL sistema DEBERÁ responder 403; SI el motivo es muy corto, DEBERÁ responder 400.

### Requisito 2: Suspender y reactivar empresas

**Historia de usuario:** Como administrador, quiero suspender a una empresa que incumple las reglas, para cortar su acceso de inmediato.

#### Criterios de aceptación

1. CUANDO el administrador suspenda una empresa habilitada con un motivo, EL sistema DEBERÁ cambiar su estado, cerrar todas las sesiones de sus usuarios y registrar la acción.
2. MIENTRAS esté suspendida, SI uno de sus usuarios intenta ingresar, ENTONCES EL sistema DEBERÁ responder 403 «Tu empresa está suspendida por el administrador. Motivo: …».
3. MIENTRAS esté suspendida, EL catálogo y sus opciones de filtro NO DEBERÁN mostrar sus productos.
4. CUANDO el administrador la reactive con un motivo, EL sistema DEBERÁ habilitarla de nuevo y registrar la acción.
5. EL administrador DEBERÁ poder buscar empresas registradas por razón social o RUC, con las suspendidas primero.

### Requisito 3: Bitácora

**Historia de usuario:** Como administrador, quiero ver el historial de acciones de moderación, para rendir cuentas.

#### Criterios de aceptación

1. EL sistema DEBERÁ listar las acciones más recientes primero, con administrador, acción, recurso, motivo y fecha.
2. Las acciones NO DEBERÁN poder editarse ni borrarse desde la aplicación.
