"""Diagramas de estilo y enfoque de MayoristaPro. SVG editables, sin dependencias.

python img/fuentes-svg/generar_arquitectura.py
powershell -ExecutionPolicy Bypass -File img/fuentes-svg/exportar-png.ps1 -Filter '*arquitectonico.svg'
"""
from generar_diagramas import Diagram
from pathlib import Path
from base64 import b64encode

REPO = Path(__file__).resolve().parents[2]


def icon(d, path, x, y, size=42, color=None):
    svg = path.read_text(encoding='utf-8')
    if color:
        svg = svg.replace('currentColor', color)
    encoded = b64encode(svg.encode('utf-8')).decode('ascii')
    d.parts.append(f'<image x="{x}" y="{y}" width="{size}" height="{size}" href="data:image/svg+xml;base64,{encoded}"/>')


def logo(d, key, x, y, size=48):
    icon(d, REPO/'presentaciones/recursos/tecnologias'/f'{key}.svg', x, y, size)

BLUE = ('#EDF5FF', '#2467AD')
GREEN = ('#EDF8F0', '#36814B')
GOLD = ('#FFF7DD', '#AB7A12')
PURPLE = ('#F4EEFC', '#7954A7')
GRAY = ('#F3F5F7', '#607080')


def panel(d, x, y, w, h, title, lines, palette=BLUE, size=20):
    fill, stroke = palette
    d.rect(x, y, w, h, fill, stroke, radius=12)
    d.text(x+18, y+31, title, size, stroke, True)
    for i, line in enumerate(lines):
        d.text(x+18, y+61+i*25, line, 18)


def note(d, y, title, lines, x=36, w=None):
    w = w or d.w-72
    panel(d, x, y, w, 125, title, lines, GRAY)


def estilo():
    d = Diagram('estilo-arquitectonico', 1840, 1390,
                'MayoristaPro B2B — Estilo arquitectónico',
                'Cliente-servidor con backend monolítico modular · Colaboración en ejecución')
    d.text(36, 112, 'Una aplicación comercial desplegable; módulos internos con contratos públicos', 22, '#2467AD', True)

    for y, name, lines in [
        (195, 'Comprador empresarial', ['Busca productos por volumen.', 'Solicita y acepta cotizaciones.']),
        (390, 'Proveedor mayorista', ['Importa el catálogo por bloques.', 'Define mínimos y atiende pedidos.']),
        (585, 'Administrador', ['Verifica proveedores.', 'Supervisa accesos y operaciones.'])]:
        panel(d, 36, y, 330, 145, name, lines)

    panel(d, 410, 355, 240, 195, 'Cliente web',
          ['Angular + TypeScript', 'Catálogo y tarjetas', 'Carga CSV / Excel', 'Cotizaciones y pedidos'], GREEN, 23)
    for y in [270, 465, 660]:
        d.edge([(366, y), (385, y), (385, 450), (410, 450)])
    d.text(392, 326, 'Usa la plataforma', 16, '#607080')

    d.boundary(700, 160, 760, 770, 'BACKEND NESTJS · MONOLITO MODULAR')
    panel(d, 730, 210, 700, 110, 'API REST y controles de acceso',
          ['Controladores HTTP, validación, roles y autorización por empresa.'], BLUE, 23)
    d.edge([(650, 450), (675, 450), (675, 265), (730, 265)],
           'Solicitudes y respuestas\nHTTPS / JSON', (560, 610), size=17)

    modules = [
        (730, 370, 'Identidad y proveedores', ['Cuentas, permisos y verificación.'], GREEN),
        (1100, 370, 'Productos', ['Importación, SKU, mínimos y stock.'], GREEN),
        (730, 535, 'Cotizaciones', ['Solicitudes y ofertas por proveedor.'], GREEN),
        (1100, 535, 'Pedidos', ['Acuerdos, reservas y estados.'], GREEN),
        (730, 700, 'Gestión operativa', ['Despacho y recepción básicos.'], GREEN),
        (1100, 700, 'Recomendaciones', ['Elegibilidad y motivo del orden.'], PURPLE)]
    for x, y, title, lines, color in modules:
        panel(d, x, y, 330, 110, title, lines, color, 19)

    d.edge([(1080, 320), (1080, 345)], marker=None)
    d.edge([(895, 345), (1265, 345)], marker=None)
    d.edge([(895, 345), (895, 370)])
    d.edge([(1265, 345), (1265, 370)])
    d.text(735, 512, 'Casos de uso y colaboración mediante APIs públicas internas', 18, '#36814B', True)
    d.edge([(1265, 645), (1265, 665), (895, 665), (895, 645)],
           'Consulta oferta aceptada', (1080, 689), size=15)
    d.edge([(1265, 535), (1265, 480)], 'Reserva', (1328, 516), size=15)
    d.text(1118, 838, 'Según alcance validado', 17, '#7954A7')
    d.text(735, 875, 'Persistencia mediante puertos, adaptadores y unidad de trabajo', 18, '#607080', True)

    panel(d, 1530, 210, 275, 175, 'Integraciones previstas',
          ['Pasarela de pago', 'Consulta de RUC', 'PSE, avisos y mapas'], PURPLE, 18)
    d.edge([(1430, 280), (1530, 280)], 'HTTPS', (1496, 253), dash=True, size=15)
    panel(d, 1530, 475, 275, 175, 'Procesos auxiliares',
          ['Python / FastAPI', 'SQS y workers', 'Incorporación por etapas'], PURPLE, 19)
    d.edge([(1430, 755), (1495, 755), (1495, 565), (1530, 565)], dash=True)

    panel(d, 730, 1010, 700, 130, 'PostgreSQL · Fuente de verdad comercial',
          ['Propiedad de datos por módulo. SKU único por proveedor.',
           'Pedido y reserva comparten una transacción y conexión.'], GOLD, 23)
    d.edge([(1080, 930), (1080, 1010)], 'SQL', (1120, 975), size=18)
    panel(d, 1530, 850, 275, 185, 'Recursos según necesidad',
          ['Redis: datos temporales', 'S3: imágenes / documentos', 'CloudWatch: observación', 'No sustituyen PostgreSQL.'], GRAY, 17)

    note(d, 1180, 'Lectura del diagrama', [
        'Límite discontinuo: una aplicación backend. Flechas: colaboración en ejecución; no son imports del código.',
        'Verde: responsabilidades del núcleo. Morado y gris: capacidades previstas que se incorporan según alcance.',
        'Ejemplo: importar cajas con mínimo de compra; aceptar una cotización y crear un pedido sin sobreventa.'])
    d.text(36, 1347, 'El despliegue puede replicar el backend completo. La capacidad y el alcance final siguen pendientes de validación.', 18, '#607080')
    d.save()


def enfoque():
    d = Diagram('enfoque-arquitectonico', 1940, 1630,
                'MayoristaPro B2B — Enfoque arquitectónico',
                'Clean Architecture dentro de cada módulo · Dependencias del código y adaptadores')
    panel(d, 660, 115, 620, 115, 'Angular · Cliente externo al backend',
          ['Importa catálogos, muestra mínimos y solicita pedidos.'], BLUE, 23)
    logo(d, 'angular', 1155, 185, 30)
    logo(d, 'typescript', 1205, 185, 30)
    d.boundary(36, 300, 1868, 790, 'APLICACIÓN BACKEND · API MAYORISTAPRO · MONOLITO MODULAR')
    logo(d, 'nodejs', 1480, 307, 29)
    d.text(1520, 329, 'Node.js ejecuta todo el backend', 17, '#36814B', True)
    d.edge([(970, 230), (970, 330), (265, 330), (265, 350)],
           'Comunicación en ejecución: HTTPS / JSON', (770, 258), size=17)

    cols = [(65, 400, 'PRESENTACIÓN', BLUE), (535, 400, 'APLICACIÓN', GREEN),
            (1005, 400, 'DOMINIO', GOLD), (1475, 400, 'INFRAESTRUCTURA', PURPLE)]
    symbols = ['monitor', 'settings', 'boxes', 'database']
    for (x, w, title, palette), symbol in zip(cols, symbols):
        d.rect(x, 350, w, 650, palette[0], palette[1], radius=12)
        icon(d, REPO/'img/recursos-arquitectura'/f'{symbol}.svg', x+18, 365, 30, palette[1])
        d.text(x+62, 387, title, 22, palette[1], True)

    panel(d, 85, 420, 360, 185, 'Controladores HTTP',
          ['Reciben solicitudes y archivos.', 'Validan el formato de entrada.',
           'Traducen errores a respuestas.', 'No definen mínimos comerciales.'], BLUE, 21)
    logo(d, 'nestjs', 105, 566, 29)
    d.text(147, 588, 'NestJS: controladores REST', 17, '#2467AD', True)
    panel(d, 85, 655, 360, 230, 'Ejemplos de entrada',
          ['Lote de productos por CSV / XLSX', 'Identificador de oferta aceptada',
           'Cantidad y presentación', 'Identidad autenticada',
           'La interfaz no fija precios finales.'], BLUE, 21)

    panel(d, 555, 420, 360, 185, 'Casos de uso',
          ['ImportarCatalogo', 'CrearPedido', 'ConsultarRecomendaciones',
           'Autorizan y coordinan pasos.'], GREEN, 22)
    d.text(575, 631, 'Código TypeScript independiente del ORM', 16, '#36814B')
    panel(d, 555, 655, 360, 230, 'Puertos de aplicación',
          ['UnidadTrabajoPort', 'StockPort y CotizacionesPort',
           'Puerto de recomendación', 'Puerto de lectura de archivos',
           'Definen lo que el caso necesita.'], GREEN, 21)

    panel(d, 1025, 420, 360, 185, 'Entidades y reglas',
          ['Producto, Pedido e ItemPedido', 'Presentación, mínimo y múltiplo',
           'Cantidades y estados válidos', 'Precios y condiciones aceptados'], GOLD, 22)
    panel(d, 1025, 655, 360, 230, 'Contratos del dominio',
          ['OrderRepository', 'Guardar y recuperar pedidos.',
           'Sin imports de NestJS ni SQL.', 'Sin SDK de pasarela o Excel.',
           'Reglas comprobables sin servicios.'], GOLD, 21)

    panel(d, 1495, 420, 360, 150, 'Adaptadores de persistencia',
          ['Repositorios y unidad de trabajo.', 'SQL, bloqueos y transacciones.'], PURPLE, 20)
    logo(d, 'postgresql', 1513, 525, 29)
    d.text(1555, 546, 'PostgreSQL: datos comerciales', 16, '#7954A7', True)
    panel(d, 1495, 595, 360, 155, 'Adaptadores de archivos',
          ['CSV / XLSX: lectura del catálogo.', 'S3: imágenes y documentos previstos.'], PURPLE, 20)
    logo(d, 'amazonwebservices', 1513, 703, 29)
    d.text(1555, 724, 'Amazon S3, según necesidad', 16, '#7954A7', True)
    panel(d, 1495, 775, 360, 155, 'Cliente de recomendación',
          ['Llama a un proceso propio separado.', 'Python / FastAPI, según alcance.'], PURPLE, 20)
    logo(d, 'python', 1513, 882, 29)
    logo(d, 'fastapi', 1555, 882, 29)
    d.text(1597, 904, 'Servicio fuera del backend', 15, '#7954A7')

    d.edge([(445, 510), (555, 510)], 'Usa', (500, 495), size=17)
    d.edge([(915, 510), (1025, 510)], 'Usa', (970, 495), size=17)
    d.edge([(1495, 490), (1440, 490), (1440, 745), (1385, 745)],
           'Implementa', (1440, 729), dash=True, marker='triangle', size=16)
    # El adaptador de aplicación se conecta por debajo de las cajas, sin atravesar el dominio.
    d.edge([(1675, 930), (1675, 975), (735, 975), (735, 885)],
           'Implementa los puertos de aplicación', (1160, 963), dash=True, marker='triangle', size=17)
    d.text(85, 1045, 'Dependencias del código: Presentación → Aplicación → Dominio. Infraestructura implementa interfaces internas.', 22, '#2467AD', True)

    panel(d, 36, 1125, 910, 155, 'Composición y ejecución', [
        'El módulo NestJS conecta controladores, casos de uso y adaptadores.',
        'En ejecución, el caso de uso invoca el objeto conectado al puerto.',
        'Esto no requiere importar su clase concreta de infraestructura.'], GRAY, 22)
    logo(d, 'nestjs', 878, 1142, 36)
    panel(d, 974, 1125, 930, 155, 'Ejemplo: pedido de 4 cajas', [
        'Aplicación autoriza y obtiene la oferta. Dominio valida condiciones.',
        'El adaptador reserva stock y guarda el pedido en una transacción.',
        'Si falla un paso, revierte todo. La pasarela se llama después.'], GRAY, 22)
    panel(d, 36, 1300, 1868, 155, 'ENTORNO DE DESPLIEGUE PREVISTO · AWS', [
        'EC2: ejecuta la API NestJS y, si se incorpora, el proceso Python. RDS: aloja PostgreSQL.',
        'S3: conserva archivos. CloudWatch: observa métricas y registros. Incorporación según alcance y presupuesto.',
        'Este entorno aloja los componentes; no es una quinta capa de Clean Architecture.'], GRAY, 22)
    logo(d, 'amazonwebservices', 1812, 1315, 55)
    note(d, 1480, 'Leyenda y regla de diseño', [
        'Flecha continua entre capas: dependencia de código. Discontinua con triángulo hueco: implementación de interfaz.',
        'La conexión desde Angular muestra comunicación HTTP, no una dependencia del dominio. Los puertos viven en la capa interna que los necesita.',
        'Producto mínimo ilustrativo: caja de 12 artículos, mínimo de 2 cajas. La lectura de Excel no pertenece a las reglas del negocio.'])
    d.save()


if __name__ == '__main__':
    estilo()
    enfoque()
    print('Generados estilo-arquitectonico.svg y enfoque-arquitectonico.svg')
