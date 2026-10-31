param([string]$OutputPath, [string]$PreviewDir)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $OutputPath) { $OutputPath = Join-Path $repoRoot 'presentaciones/MayoristaPro-Sprint-01-tecnologias.pptx' }
if (-not $PreviewDir) { $PreviewDir = Join-Path $env:TEMP 'mayoristapro-ppt-preview' }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath),$PreviewDir | Out-Null

function Color([string]$hex) { return [Convert]::ToInt32($hex.Substring(0,2),16) + 256*[Convert]::ToInt32($hex.Substring(2,2),16) + 65536*[Convert]::ToInt32($hex.Substring(4,2),16) }
$navy=Color '102D4E'; $blue=Color '1269B0'; $teal=Color '0F776F'; $ink=Color '203447'; $muted=Color '52677A'; $white=Color 'FFFFFF'; $light=Color 'EDF4FA'; $gray=Color '6C7782'
$app=New-Object -ComObject PowerPoint.Application
$deck=$app.Presentations.Add(0)
$deck.PageSetup.SlideWidth=960
$deck.PageSetup.SlideHeight=540
$font='Aptos'

function Text($s,[string]$value,[double]$x,[double]$y,[double]$w,[double]$h,[double]$size=20,[int]$color=$ink,[bool]$bold=$false) {
    $o=$s.Shapes.AddTextbox(1,$x,$y,$w,$h)
    $o.TextFrame.MarginLeft=0; $o.TextFrame.MarginRight=0; $o.TextFrame.MarginTop=0; $o.TextFrame.MarginBottom=0
    $o.TextFrame.WordWrap=-1
    $o.TextFrame.TextRange.Text=$value
    $o.TextFrame.TextRange.Font.Name=$font
    $o.TextFrame.TextRange.Font.Size=$size
    $o.TextFrame.TextRange.Font.Color.RGB=$color
    $o.TextFrame.TextRange.Font.Bold=if($bold){-1}else{0}
    return $o
}
function NewSlide([string]$title,[string]$notes,[string]$source='README.md') {
    $s=$deck.Slides.Add($deck.Slides.Count+1,12)
    $s.FollowMasterBackground=0; $s.Background.Fill.ForeColor.RGB=$white
    $null=Text $s $title 42 28 870 53 32 $navy $true
    $null=Text $s ('MAYORISTAPRO  /  SPRINT 01') 42 510 500 18 10 $muted
    $null=Text $s ([string]$s.SlideIndex) 880 510 35 18 11 $muted
    $s.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text=$notes+"`r`n`r`nFuente: "+$source
    return $s
}
function Box($s,[string]$name,[string]$detail,[double]$x,[double]$y,[double]$w,[double]$h,[int]$fill=$blue,[double]$size=20) {
    $o=$s.Shapes.AddShape(1,$x,$y,$w,$h)
    $o.Fill.ForeColor.RGB=$fill; $o.Line.Visible=0
    $null=Text $s $name ($x+12) ($y+12) ($w-24) 30 $size $white $true
    if($detail) { $null=Text $s $detail ($x+12) ($y+48) ($w-24) ($h-52) 16 $white }
    return $o
}
function Arrow($s,[double]$x1,[double]$y1,[double]$x2,[double]$y2,[string]$label='',[double]$lx=0,[double]$ly=0,[double]$lw=160) {
    $o=$s.Shapes.AddLine($x1,$y1,$x2,$y2); $o.Line.ForeColor.RGB=$muted; $o.Line.Weight=1.5; $o.Line.EndArrowheadStyle=3
    if($label) { $null=Text $s $label $lx $ly $lw 38 14 $muted }
}
function Table($s,$headers,$rows,[double]$x=42,[double]$y=120,[double]$w=876,[double]$h=325,[double]$size=20,$widths=$null) {
    $o=$s.Shapes.AddTable($rows.Count+1,$headers.Count,$x,$y,$w,$h)
    if($widths) { for($c=1;$c -le $headers.Count;$c++) { $o.Table.Columns.Item($c).Width=$widths[$c-1] } }
    for($r=1;$r -le $rows.Count+1;$r++) {
        for($c=1;$c -le $headers.Count;$c++) {
            $cell=$o.Table.Cell($r,$c).Shape
            $cell.Fill.ForeColor.RGB=if($r -eq 1){$navy}elseif($r%2 -eq 0){$light}else{$white}
            $cell.TextFrame.MarginLeft=12; $cell.TextFrame.MarginRight=10; $cell.TextFrame.MarginTop=10; $cell.TextFrame.MarginBottom=8
            $cell.TextFrame.TextRange.Text=if($r -eq 1){[string]$headers[$c-1]}else{[string]$rows[$r-2][$c-1]}
            $cell.TextFrame.TextRange.Font.Name=$font; $cell.TextFrame.TextRange.Font.Size=$size
            $cell.TextFrame.TextRange.Font.Color.RGB=if($r -eq 1){$white}else{$ink}
            $cell.TextFrame.TextRange.Font.Bold=if($r -eq 1){-1}else{0}
        }
    }
    return $o
}
function ClassBox($s,$name,$body,$x,$y,$w,$h) {
    $o=$s.Shapes.AddShape(1,$x,$y,$w,$h); $o.Fill.ForeColor.RGB=$light; $o.Line.ForeColor.RGB=$blue
    $null=Text $s $name ($x+10) ($y+10) ($w-20) 28 18 $navy $true
    $line=$s.Shapes.AddLine($x,($y+40),($x+$w),($y+40)); $line.Line.ForeColor.RGB=$blue
    $null=Text $s $body ($x+10) ($y+50) ($w-20) ($h-55) 17 $ink
}

# 01. Caratula
$s=NewSlide 'MayoristaPro B2B' 'Presentar el proyecto como una propuesta de plataforma mayorista para empresas en Ayacucho. Esta entrega corresponde al diseño del Sprint 01. Las funcionalidades y metas aún requieren implementación y validación.'
while($s.Shapes.Count -gt 0) { $s.Shapes.Item(1).Delete() }
$s.Background.Fill.ForeColor.RGB=(Color 'FAF8F4')
$guindo=Color '74283D'
function CenterText([string]$value,[double]$y,[double]$h,[double]$size,[int]$color,[bool]$bold=$false) {
    $o=Text $s $value 55 $y 850 $h $size $color $bold
    $o.TextFrame.TextRange.ParagraphFormat.Alignment=2
}
CenterText 'UNIVERSIDAD NACIONAL DE SAN CRISTÓBAL DE HUAMANGA' 25 36 23 $guindo $true
CenterText 'Escuela Profesional de Ingeniería de Sistemas' 67 28 18 $muted
$crest=Join-Path $repoRoot 'presentaciones/recursos/escudo-unsch.png'
$null=$s.Shapes.AddPicture($crest,0,-1,419.5,105,121,162)
CenterText 'MayoristaPro B2B' 285 64 48 $guindo $true
CenterText 'Plataforma de comercialización mayorista en Ayacucho' 352 32 22 $ink
CenterText 'Arquitectura de Software' 397 30 22 $guindo $true
CenterText 'Yeltsin Wilber Muñoz Corichahua' 439 27 20 $ink
CenterText 'Docente: Ing. Lizbeth Jaico Quispe' 471 27 18 $muted
CenterText 'Ayacucho, Perú  /  2026' 510 22 15 $muted
$s.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text += "`r`nEscudo: Universidad Nacional de San Cristóbal de Huamanga. Archivo original sin alteraciones, escalado proporcionalmente. Fuente: https://commons.wikimedia.org/wiki/File:Escudo_de_la_UNSCH.png . Licencia CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/ . Referencia institucional: https://enlinea.unsch.edu.pe/identidad/"

# 02. Problema
$s=NewSlide 'El problema de abastecimiento' 'Explicar las necesidades que motivan la propuesta: encontrar proveedores y reunir precios, mínimos y condiciones para decidir una compra. Ejemplo: una librería necesita útiles de varios tipos y busca una oferta que pueda atender su pedido. Estos supuestos requieren validación con negocios locales. No presentar estadísticas de mercado que el proyecto no ha medido.'
$null=Text $s 'Situación que aborda el proyecto' 42 108 876 34 25 $blue $true
$null=Text $s 'Los negocios compradores de Ayacucho necesitan encontrar proveedores mayoristas y reunir información sobre productos, precios por volumen y condiciones de entrega antes de abastecerse.' 42 157 876 88 23 $ink
$null=Text $s 'Dificultad principal' 42 260 260 32 23 $blue $true
$null=Text $s 'La decisión de compra requiere comparar ofertas, confirmar existencias y conservar las condiciones acordadas. El seguimiento también exige que comprador y proveedor conozcan el estado del pedido.' 320 258 598 119 22 $ink
$null=Text $s 'Ejemplo' 42 393 260 32 23 $blue $true
$null=Text $s 'Una librería busca útiles al por mayor y necesita saber quién puede atender su solicitud, a qué precio y bajo qué condiciones.' 320 391 598 85 22 $ink
$null=Text $s 'Supuestos del proyecto pendientes de validación con negocios locales' 42 480 876 24 16 $muted

# 03. Propuesta
$s=NewSlide 'La propuesta de MayoristaPro' 'Describir una plataforma web entre empresas. El comprador reúne su solicitud y acepta condiciones; el proveedor responde y atiende el pedido. El sistema conserva los precios acordados y reserva existencias al crear el pedido. La plataforma no ofrece transporte propio ni custodia fondos.'
$null=Text $s 'Una plataforma web para la compra entre empresas' 42 108 876 34 25 $blue $true
$null=Text $s 'MayoristaPro propone reunir el catálogo, las cotizaciones y los pedidos en un mismo sistema. El comprador podrá consultar productos y solicitar una oferta; el proveedor responderá con sus precios y condiciones.' 42 157 876 93 23 $ink
$null=Text $s 'Proceso de compra' 42 270 260 32 23 $teal $true
$null=Text $s 'Al aceptar una oferta, el comprador podrá generar un pedido. El sistema verificará el stock y guardará las cantidades y los precios acordados para que ambas partes consulten la operación.' 320 268 598 119 22 $ink
$null=Text $s 'Resultado esperado' 42 404 260 32 23 $teal $true
$null=Text $s 'Contar con información organizada para decidir la compra y dar seguimiento al pedido, evitando reservar más unidades de las disponibles.' 320 402 598 88 22 $ink

# 04. Actores
$s=NewSlide 'Actores y funciones principales' 'Distinguir personas de sistemas externos. El proveedor es una empresa que puede tener varios usuarios autorizados. Comprador y proveedor comparten acceso a su pedido, pero no a información privada de otras empresas. El administrador verifica y supervisa.' 'docs/01-analisis-de-sistema/01-actores.md'
$null=Table $s @('Actor','Funciones principales') @(
    @('Comprador empresarial','Consulta catálogo, solicita cotizaciones y realiza pedidos.'),
    @('Proveedor mayorista','Importa catálogos CSV/Excel, responde cotizaciones y atiende pedidos.'),
    @('Administrador','Verifica proveedores y supervisa las operaciones.')
) 42 120 876 310 23 @(255,621)
$null=Text $s 'El acceso depende de la empresa, el rol y la participación en cada operación' 42 453 876 44 19 $muted

. (Join-Path $PSScriptRoot 'contenido-requisitos.ps1')

# 05. MVP
$s=NewSlide 'Alcance de la primera versión' 'MVP significa producto mínimo viable. El núcleo propuesto conserva el proceso de compra y reduce integraciones iniciales. La modalidad de pagos y la inclusión de IA deben validarse con la docente según la rúbrica. La primera versión puede abarcar varios sprints. No prometer fecha o costo sin estimar horas y recursos.'
$null=Text $s 'MVP propuesto' 42 115 420 40 27 $blue $true
$null=Text $s "Registro y permisos por empresa`r`rCatálogo por CSV/Excel y verificación`r`rCotización a un proveedor`r`rPedido y reserva de stock`r`rAtención y estados básicos" 42 174 415 270 22 $ink
$null=Text $s 'Entregas posteriores' 520 115 398 40 27 $teal $true
$null=Text $s "Recomendaciones de proveedores`r`rFacturación y avisos externos`r`rReportes y reclamos avanzados`r`rMapas y automatizaciones" 520 174 398 240 22 $ink
$null=Text $s 'Pagos e IA: alcance sujeto a los requisitos del curso y validación docente' 42 463 876 35 18 $muted

# Catálogo mayorista
$s=NewSlide 'Catálogo y ofertas al ingresar' 'El catálogo público muestra ofertas registradas por proveedores verificados. Cada tarjeta del MVP corresponde a un proveedor y una presentación. No se extraen precios de tiendas externas. El precio desde debe indicar el volumen al que aplica; el pedido conserva la cotización aceptada. Un comparador que agrupe varias tiendas requeriría identificar productos equivalentes y no forma parte del núcleo inicial. Solicitar cotización requiere cuenta empresarial.' 'docs/03-diseno-de-software/reglas-comerciales-mayoristas.md'
$null=Table $s @('Elemento','Comportamiento propuesto') @(
    @('Inicio público','Productos, imágenes, categorías y buscador antes de iniciar sesión.'),
    @('Oferta visible','Proveedor, precio por presentación, mínimo, múltiplo y disponibilidad.'),
    @('Precio publicado','Lo registra el proveedor. Si dice desde, indica el volumen necesario.'),
    @('Detalle y cotización','El clic abre la oferta en MayoristaPro; cotizar requiere cuenta empresarial.')
) 42 115 876 325 21 @(210,666)
$null=Text $s 'Ejemplo: caja de 12 cuadernos a S/ 48; mínimo 2 cajas = S/ 96, envío aparte' 42 463 876 38 18 $blue $true

# 14. Metas
$s=NewSlide 'Atributos de calidad prioritarios' 'Todas las cifras son metas propuestas, no resultados. p95 significa que al menos 95% de solicitudes medidas cumple el límite. Los dos mil usuarios son usuarios virtuales activos con pausas, no dos mil solicitudes por segundo. La disponibilidad requiere observación mensual. Para seguridad, la aprobación se limita a la matriz de casos ejecutada.' 'docs/01-analisis-de-sistema/04-atributos-de-calidad.md; docs/01-analisis-de-sistema/08-escenarios-atributos-calidad.md'
$null=Table $s @('Atributo','Meta propuesta','Herramienta') @(
    @('Rendimiento','p95 de hasta 500 ms por endpoint local.','k6'),
    @('Escalabilidad','Evaluar hasta 2,000 usuarios virtuales.','k6 + CloudWatch'),
    @('Concurrencia','Sin sobreventa ni stock negativo.','k6 + SQL'),
    @('Seguridad','Rechazar accesos indebidos de la matriz.','Jest + HTTP'),
    @('Disponibilidad','99.5% mensual, RTO 4 h y RPO 1 h.','Sondas + CloudWatch')
) 42 111 876 342 19 @(196,445,235)
$null=Text $s 'Metas pendientes de validación sobre el software implementado' 42 473 876 28 19 $blue $true

# 15. Medicion
$s=NewSlide 'Medición después del despliegue' 'Describir el procedimiento y las herramientas. k6 se ejecuta separado del backend. El perfil propone mesetas de cinco minutos en 500, mil y dos mil usuarios, con subidas de dos minutos y pausas de dos segundos. Se evalúa por endpoint y meseta, separando calentamiento. CloudWatch correlaciona recursos y latencia. La prueba de stock usa quinientos compradores distintos, una creación por comprador y cien unidades iniciales. Las respuestas de negocio esperadas se contabilizan aparte de los errores técnicos. Disponibilidad se observa un mes. Guardar versión, configuración, scripts, métricas y consultas. Los casos de desarrollo comienzan antes del despliegue.' 'docs/01-analisis-de-sistema/09-plan-de-medicion-calidad.md'
$null=Table $s @('Prueba','Cómo se realizará','Evidencia') @(
    @('Carga con k6',"500, 1,000 y 2,000 usuarios.`rMesetas de 5 min y pausas de 2 s.",'p95 y errores por endpoint y etapa.'),
    @('Stock concurrente',"500 compradores y 100 cajas.`rUna caja de 12 artículos por intento.",'100 aceptados, 400 rechazos y stock 0.'),
    @('Infraestructura','Correlacionar carga con CPU, memoria instrumentada y conexiones.','Métricas y registros en CloudWatch.'),
    @('Disponibilidad','Sondas cada minuto durante un mes.','Historial, incidentes y cobertura.')
) 42 113 876 330 19 @(190,405,281)
$null=Text $s 'Ejecución pendiente. El informe incluirá versión, entorno y resultados reales' 42 466 876 34 18 $muted

AddDriversSlide

. (Join-Path $PSScriptRoot 'contenido-tecnologias.ps1')

# 06. Estilos
$s=NewSlide 'Estilos y decisiones arquitectónicas' 'Explicar que las decisiones corresponden a perspectivas diferentes y se combinan. Cliente-servidor separa navegador y API. El monolito modular reúne los módulos comerciales en un backend desplegable. Clean Architecture separa reglas y tecnología dentro de cada módulo. El procesamiento asíncrono se propone para tareas posteriores si entran en el alcance. Se evita dividir todo el negocio en microservicios por el esfuerzo operativo adicional.' 'docs/02-arquitectura-software/estilo-arquitectonico.md; docs/02-arquitectura-software/enfoque-arquitectonico.md'
$null=Table $s @('Decisión','Aplicación','Justificación') @(
    @('Cliente-servidor','Angular consume la API REST.','Separar la interfaz del backend.'),
    @('Monolito modular','Módulos comerciales en NestJS.','Simplificar despliegue y coordinación.'),
    @('Clean Architecture','Capas dentro de cada módulo.','Aislar las reglas de negocio.'),
    @('Tareas asíncronas','Outbox, SQS y workers previstos.','Ejecutar tareas con reintentos.')
) 42 115 876 335 20 @(222,327,327)
$null=Text $s 'Base del núcleo inicial: Angular, NestJS y PostgreSQL' 42 466 876 32 20 $blue $true

# 07. Capas
$s=NewSlide 'Organización interna del módulo' 'Recorrer el ejemplo: el controlador recibe HTTP, el caso de uso autoriza y coordina, el dominio valida cantidades y estados y los adaptadores ejecutan persistencia e integraciones. Las flechas muestran dependencias del código: infraestructura implementa puertos internos. La composición de NestJS conecta las implementaciones. El dominio no importa el ORM ni SDK de pagos.' 'docs/02-arquitectura-software/enfoque-arquitectonico.md'
$null=Box $s 'Presentación' "Controladores HTTP`rValidación de entrada" 42 145 260 118 $blue
$null=Box $s 'Aplicación' "Casos de uso`rAutorización y coordinación" 350 145 260 118 $teal
$null=Box $s 'Dominio' "Pedido e ítems`rReglas y contratos" 658 145 260 118 $navy
Arrow $s 302 204 350 204
Arrow $s 610 204 658 204
$null=Box $s 'Infraestructura' 'PostgreSQL y adaptadores externos' 350 350 568 108 $gray
Arrow $s 485 350 485 263 'Implementa puertos' 345 291 200
Arrow $s 785 350 785 263 'Implementa repositorios' 693 291 225
$null=Text $s 'Las reglas de negocio permanecen independientes de NestJS y PostgreSQL' 42 474 876 30 18 $muted

# 12. Datos
$s=NewSlide 'Diseño de datos del flujo principal' 'Modelo resumido del flujo, con relaciones y entidades editables. Cada empresa agrupa usuarios. El proveedor publica productos. Una cotización tiene respuestas y una oferta aceptada origina como máximo un pedido. Los ítems conservan precios históricos y las reservas vinculan pedido y producto. El esquema completo incluye destinatarios, detalles de cotización, pagos y auditoría. Cada pedido corresponde a un comprador y un proveedor.' 'docs/03-diseno-de-software/esquema-base-de-datos.md'
$null=Table $s @('Grupo de datos','Relaciones principales') @(
    @('Empresas y usuarios','Una empresa agrupa usuarios con roles y permisos.'),
    @('Proveedores y productos','Un proveedor publica varios productos y precios por volumen.'),
    @('Cotizaciones y respuestas','La oferta aceptada define condiciones y precios del pedido.'),
    @('Pedidos e ítems','Un pedido conserva sus productos, cantidades y precios.'),
    @('Reservas de stock','Cada reserva relaciona un pedido con un producto.')
) 42 113 876 343 20 @(290,586)
$null=Text $s 'PostgreSQL: relaciones, restricciones y transacciones para proteger la integridad' 42 472 876 30 18 $muted

# 13. Flujo critico
$s=NewSlide 'Creación de pedido y reserva de stock' 'Explicar la regla crítica: pedido, ítems, reserva y descuento de stock disponible pertenecen a una misma transacción y conexión. Ante fallo se revierte todo. Bloquear productos de forma ordenada y validar condiciones evita sobreventa. El pago externo sucede después del commit y necesita referencias persistidas, idempotencia y reconciliación. Un timeout de pago conserva incertidumbre y no autoriza liberar automáticamente la reserva.' 'docs/03-diseno-de-software/esquema-base-de-datos.md; docs/04-modelo-c4/Nivel4-Diagrama-de-Codigo.md'
$null=Table $s @('Paso','Responsabilidad') @(
    @('1. Autorizar','Validar comprador y oferta aceptada vigente.'),
    @('2. Iniciar transacción','Revalidar condiciones y bloquear los productos.'),
    @('3. Guardar','Crear pedido, ítems, reserva y descontar stock disponible.'),
    @('4. Confirmar o revertir','COMMIT completo o ROLLBACK ante fallo.')
) 42 118 876 285 21 @(245,631)
$null=Text $s 'La llamada a la pasarela ocurre después de guardar el pedido' 42 438 876 45 24 $blue $true

# 16. Cierre
$s=NewSlide 'Siguiente etapa: implementación' 'Cerrar conectando la documentación con el trabajo posterior. El Sprint 01 entrega análisis, decisiones y diseño. A continuación se valida el alcance del MVP y se implementa el núcleo con sus pruebas. Swagger/OpenAPI pertenece al Sprint 02. La evaluación real de capacidad requiere desplegar el software y conservar evidencias. El presupuesto y las horas disponibles todavía requieren estimación. No prometer todas las integraciones de la visión general en una sola entrega.'
$null=Text $s 'Sprint 01' 42 116 420 40 28 $blue $true
$null=Text $s "Análisis y alcance propuesto`r`rArquitectura y diagramas C4`r`rDiseño de datos y módulos`r`rPlan de medición de calidad" 42 180 400 250 23 $ink
$null=Text $s 'Sprint 02 y siguientes' 520 116 398 40 28 $teal $true
$null=Text $s "Validar el MVP e implementar el núcleo`r`rDocumentar la API con Swagger`r`rDesplegar el entorno de pruebas`r`rEjecutar y registrar mediciones" 520 180 398 250 23 $ink

$deck.SaveAs($OutputPath,24)
for($i=1;$i -le $deck.Slides.Count;$i++) {
    $deck.Slides.Item($i).Export((Join-Path $PreviewDir ('slide-{0:D2}.png' -f $i)),'PNG',1600,900)
}
$result=@{path=$OutputPath; previews=$PreviewDir; slides=$deck.Slides.Count}
$deck.Close()
if($app.Presentations.Count -eq 0){$app.Quit()}
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($deck) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
$result | ConvertTo-Json
