# Historias seleccionadas del alcance documentado.
$s=NewSlide 'Historias de usuario: comprador' 'Las historias expresan la necesidad desde el punto de vista del usuario. Leer actor, acción y beneficio. Se presenta una selección del recorrido principal y se conservan los identificadores del documento. La prioridad alta no implica que ya esté implementada la funcionalidad.' 'docs/01-analisis-de-sistema/02-historias-del-usuario.md'
$null=Table $s @('ID','Historia de usuario') @(
    @('HU-09','Como comprador empresarial, quiero buscar productos por nombre, categoría, precio o proveedor, para encontrar lo que necesito rápidamente.'),
    @('HU-11','Como comprador empresarial, quiero solicitar cotización a uno o varios proveedores, para obtener precios y condiciones antes de comprar.'),
    @('HU-15','Como comprador empresarial, quiero confirmar un pedido a partir de una cotización aceptada, para concretar la compra.')
) 42 115 876 342 22 @(112,764)
$null=Text $s 'Selección de historias de prioridad alta del alcance general' 42 474 876 28 18 $muted

$s=NewSlide 'Historias de usuario: proveedor y administrador' 'El proveedor publica su oferta y responde solicitudes. El administrador verifica proveedores antes de que operen. Se conservan las historias del alcance general. Las condiciones exactas y los criterios de aceptación se encuentran en la documentación del repositorio.' 'docs/01-analisis-de-sistema/02-historias-del-usuario.md'
$null=Table $s @('ID','Historia de usuario') @(
    @('HU-04','Como administrador, quiero verificar y aprobar proveedores antes de que operen, para garantizar la confianza en la plataforma.'),
    @('HU-05','Como proveedor, quiero publicar productos con nombre, descripción, categoría, precio, stock e imágenes, para ofrecerlos a compradores empresariales.'),
    @('HU-12','Como proveedor, quiero responder cotizaciones indicando precio, disponibilidad y condiciones, para ofrecer mis productos.')
) 42 115 876 342 22 @(112,764)
$null=Text $s 'Selección de historias de prioridad alta del alcance general' 42 474 876 28 18 $muted

$s=NewSlide 'Requisitos funcionales del proceso de compra' 'Los requisitos describen el comportamiento esperado del sistema. Esta tabla resume el contenido, conservando los identificadores originales. RF-13 y RF-14 concretan la solicitud y respuesta de cotización. RF-18 y RF-19 conectan la oferta aceptada con el pedido y la validación de stock. Presentar las metas de rendimiento aparte, como atributos de calidad.' 'docs/01-analisis-de-sistema/03-requisitos-funcionales.md'
$null=Table $s @('ID','Comportamiento esperado') @(
    @('RF-07','Publicar productos con precio, mínimo de compra, stock e imágenes.'),
    @('RF-11','Buscar productos por nombre, categoría, precio y proveedor.'),
    @('RF-13 / RF-14','Solicitar cotizaciones y responder con precios y condiciones.'),
    @('RF-15 / RF-18','Aceptar una oferta y generar el pedido correspondiente.'),
    @('RF-19 / RF-21','Validar stock con control de concurrencia y consultar pedidos.')
) 42 115 876 342 21 @(185,691)
$null=Text $s 'Resumen de requisitos documentados. Implementación por etapas' 42 474 876 28 18 $muted

$s=NewSlide 'Requisitos de acceso e integraciones' 'Distinguir alcance general y primera implementación. La autenticación y los permisos pertenecen al núcleo propuesto. Los requisitos de pago, facturación e IA permanecen en la visión documentada, pero su inclusión en el MVP debe validarse con la docente. El registro manual de un pago no cumple por sí solo el requisito de integración con una pasarela.' 'docs/01-analisis-de-sistema/03-requisitos-funcionales.md; README.md'
$null=Table $s @('ID','Comportamiento esperado') @(
    @('RF-03 / RF-04','Autenticar usuarios y asignar permisos según su rol.'),
    @('RF-05','Permitir la verificación y aprobación de proveedores.'),
    @('RF-22 / RF-24','Integrar una pasarela y registrar los estados del pago.'),
    @('RF-25','Integrar un PSE para emitir comprobantes electrónicos.'),
    @('RF-16 / RF-17','Recomendar proveedores y mantener la consulta ante fallas.')
) 42 115 876 342 21 @(185,691)
$null=Text $s 'Pagos, facturación e IA: priorización sujeta al alcance académico acordado' 42 474 876 28 17 $muted

function AddDriversSlide {
    $s=NewSlide 'Drivers que orientan la arquitectura' 'Un driver es una necesidad que condiciona el diseño. Explicar la relación entre necesidad y decisión técnica. El stock exige transacciones y control de concurrencia. Los permisos requieren autorización por empresa y participación. La mantenibilidad orienta modularidad y capas. El presupuesto limitado exige priorizar el núcleo y medir antes de añadir recursos.' 'docs/01-analisis-de-sistema/06-driver-arquitectonicos.md'
    $null=Table $s @('Driver','Necesidad','Respuesta de diseño') @(
        @('DA03 / DA11','Mantener pedidos y stock consistentes.','Transacción local y recuperación.'),
        @('DA04','Proteger la información comercial.','Autorización por empresa y rol.'),
        @('DA09','Modificar funcionalidades con menor acoplamiento.','Módulos y Clean Architecture.'),
        @('DA12','Trabajar con presupuesto limitado.','MVP y despliegue por etapas.')
    ) 42 115 876 335 21 @(170,353,353)
    $null=Text $s 'Las decisiones responden a necesidades concretas del sistema' 42 472 876 30 19 $blue $true
}
