"""Genera los SVG C4 de MayoristaPro sin dependencias externas.

Ejecutar desde cualquier directorio: python img/fuentes-svg/generar_diagramas.py
Los PNG se exportan con exportar-png.ps1 (Microsoft Edge).
"""
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parent
INK, MUTED = '#1E293B', '#64748B'
PERSON, SYSTEM, CONTAINER, COMPONENT, EXTERNAL = '#0B4175', '#1168BD', '#438DD2', '#85B9EA', '#999999'


class Diagram:
    def __init__(self, name, w, h, title, subtitle):
        self.name, self.w, self.h = name, w, h
        self.parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" font-family="Segoe UI,Arial,sans-serif" role="img" aria-labelledby="title desc">',
                      f'<title id="title">{escape(title)}</title><desc id="desc">{escape(subtitle)}</desc>',
                      '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10" fill="#64748B"/></marker>',
                      '<marker id="open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L9 5 L0 10" fill="none" stroke="#475569" stroke-width="1.4"/></marker>',
                      '<marker id="triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto"><path d="M0 0 L11 6 L0 12 Z" fill="white" stroke="#475569"/></marker>',
                      '<marker id="diamond" viewBox="0 0 16 10" refX="1" refY="5" markerWidth="14" markerHeight="9" orient="auto"><path d="M1 5 L8 1 L15 5 L8 9 Z" fill="#475569"/></marker></defs>',
                      '<rect width="100%" height="100%" fill="white"/>']
        self.text(36, 40, title, 24, bold=True)
        self.text(36, 69, subtitle, 16, color=MUTED)
        self.text(w-36, 40, 'Diseño propuesto · v1.0', 14, color=MUTED, anchor='end')

    def text(self, x, y, value, size=16, color=INK, bold=False, anchor='start', halo=False):
        attrs = ' paint-order="stroke" stroke="white" stroke-width="6" stroke-linejoin="round"' if halo else ''
        self.parts.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{700 if bold else 400}" text-anchor="{anchor}"{attrs}>{escape(value)}</text>')

    def rect(self, x, y, w, h, fill='white', stroke='#64748B', dash=False, radius=0):
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="1.5"'+(' stroke-dasharray="9 6"' if dash else '')+'/>')

    def boundary(self, x, y, w, h, title):
        self.rect(x, y, w, h, fill='none', dash=True)
        self.text(x+16, y+26, title, 17, bold=True)

    def box(self, x, y, w, h, title, kind, lines, color=CONTAINER, person=False, db=False):
        if person:
            self.parts.append(f'<circle cx="{x+w/2}" cy="{y-24}" r="26" fill="{color}"/>')
        if db:
            self.parts.append(f'<path d="M{x},{y+18} C{x},{y-6} {x+w},{y-6} {x+w},{y+18} V{y+h-18} C{x+w},{y+h+6} {x},{y+h+6} {x},{y+h-18} Z" fill="{color}" stroke="#367DBD"/>')
            self.parts.append(f'<ellipse cx="{x+w/2}" cy="{y+18}" rx="{w/2}" ry="18" fill="{color}" stroke="#367DBD"/>')
        else:
            self.rect(x,y,w,h,color,color,radius=18 if person else 6)
        fg = INK if color == COMPONENT else 'white'
        cy = y+h/2-(len(lines)*20+20)/2+5
        self.text(x+w/2,cy,title,19,fg,True,'middle')
        self.text(x+w/2,cy+21,kind,14,fg,anchor='middle')
        for i,line in enumerate(lines):
            self.text(x+w/2,cy+44+i*20,line,15,fg,anchor='middle')

    def edge(self, points, label='', at=None, dash=False, marker='arrow', start=None, size=14):
        path = 'M'+' L'.join(f'{x},{y}' for x,y in points)
        self.parts.append(f'<path d="{path}" fill="none" stroke="#64748B" stroke-width="1.6"'+(' stroke-dasharray="7 5"' if dash else '')+(f' marker-end="url(#{marker})"' if marker else '')+(f' marker-start="url(#{start})"' if start else '')+'/>')
        if label:
            x,y=at or points[len(points)//2]
            for i,line in enumerate(label.split('\n')):
                self.text(x,y+i*18,line,size,MUTED,anchor='middle',halo=True)

    def footer(self, y, notes):
        self.rect(36,y,660,125,stroke='#B8BDC5')
        self.text(52,y+25,'Leyenda',16,bold=True)
        keys = [(52,PERSON,'Persona'),(207,CONTAINER,'Contenedor'),(362,COMPONENT,'Componente'),(517,EXTERNAL,'Externo')]
        if self.name == 'nivel1-contexto':
            keys = [(52,PERSON,'Persona'),(257,SYSTEM,'Sistema propio'),(462,EXTERNAL,'Sistema externo')]
        for x,c,t in keys:
            self.rect(x,y+40,140,30,c,c,radius=3)
            self.text(x+70,y+60,t,13,'white' if c!=COMPONENT else INK,anchor='middle')
        self.text(52,y+99,'Flecha: relación dirigida · Línea discontinua: límite del sistema/contenedor',13,MUTED)
        self.rect(716,y,self.w-752,125,stroke='#B8BDC5')
        self.text(732,y+25,'Alcance y lectura',16,bold=True)
        for i,line in enumerate(notes): self.text(732,y+49+i*21,line,14)

    def save(self):
        (ROOT/(self.name+'.svg')).write_text('\n'.join(self.parts+['</svg>']),encoding='utf-8')


def contexto():
    d=Diagram('nivel1-contexto',1800,1320,'[Diagrama de contexto del sistema] MayoristaPro','Modelo C4 · Nivel 1 · Marketplace B2B de Ayacucho y sus sistemas externos')
    for x,title,lines in [(130,'Comprador empresarial',['Busca, cotiza y compra','para su negocio']),(755,'Proveedor mayorista',['Publica ofertas y','gestiona pedidos']),(1380,'Administrador',['Verifica proveedores y','supervisa la operación'])]:
        d.box(x,165,260,140,title,'[Persona]',lines,PERSON,person=True)
    d.box(580,485,640,175,'MayoristaPro','[Sistema de software]',['Conecta empresas compradoras y proveedores mayoristas.','Gestiona catálogo, cotizaciones, pedidos y pagos.'],SYSTEM)
    d.edge([(260,305),(260,555),(580,555)],'Busca, solicita cotizaciones\ny realiza pedidos',(350,475))
    d.edge([(885,305),(885,485)],'Publica ofertas y\natiende pedidos',(885,390))
    d.edge([(1510,305),(1510,555),(1220,555)],'Verifica y supervisa',(1440,475))
    titles=[('Pasarela de pago',['Procesa cobros y comunica','resultados verificables']),('Consulta de RUC',['Consulta y valida','datos empresariales']),('PSE de facturación',['Emite comprobantes','electrónicos']),('Notificaciones',['Entrega avisos por','canales contratados']),('Mapas',['Presenta ubicaciones','de los proveedores'])]
    labels=['Inicia/consulta pagos;\nrecibe resultados','Consulta datos\nempresariales','Solicita\ncomprobantes','Solicita avisos','Consulta mapas\ny ubicaciones']
    for i,((title,lines),label) in enumerate(zip(titles,labels)):
        x=45+i*350; cx=x+150; sx=650+i*120; yy=715+i*33
        d.box(x,960,300,130,title,'[Sistema externo]',lines,EXTERNAL)
        d.edge([(sx,660),(sx,yy),(cx,yy),(cx,960)],label,(cx,880))
    d.footer(1150,['Azul: alcance propio. Gris: servicios de terceros.','La recomendación Python es interna; se abre en el nivel 2.','No incluye transporte propio ni custodia de fondos.'])
    d.save()


def contenedores():
    d=Diagram('nivel2-contenedores',2000,1630,'[Diagrama de contenedores] MayoristaPro','Modelo C4 · Nivel 2 · Aplicaciones, procesos auxiliares y almacenes de datos')
    d.box(750,145,360,120,'Usuarios de MayoristaPro','[Personas]',['Comprador, proveedor y administrador'],PERSON,person=True)
    d.boundary(45,330,1500,1090,'MayoristaPro [Sistema de software]')
    d.box(750,390,360,120,'Aplicación web','[Contenedor: Angular]',['Interfaz del navegador; sin secretos'])
    d.edge([(930,265),(930,390)],'Usa [HTTPS]',(930,305))
    d.box(700,620,460,180,'API MayoristaPro','[Contenedor: NestJS · monolito modular]',['Autoriza y ejecuta los casos de uso.','Coordina reglas de negocio e integraciones.'])
    d.edge([(930,510),(930,620)],'Invoca API [HTTPS / JSON]',(930,565))
    d.box(100,620,340,140,'Recomendación','[Contenedor: Python / FastAPI]',['Puntúa proveedores por reglas.','Lectura limitada; no modifica pedidos.'])
    d.edge([(700,675),(440,675)],'Solicita recomendación\n[HTTP privado]',(565,630))
    d.box(100,1000,340,150,'Base de datos','[Contenedor: PostgreSQL / RDS]',['Pedidos, stock e intentos de pago.','Fuente de verdad y outbox.'],db=True)
    d.box(580,1000,280,150,'Caché','[Contenedor: Redis]',['Copias temporales y sesiones.','No confirma stock.'],db=True)
    d.box(1020,1000,280,150,'Objetos','[Contenedor: Amazon S3]',['Imágenes y documentos.','Visibilidad según el uso.'],db=True)
    d.edge([(760,800),(760,865),(360,865),(360,1000)],'Lee / escribe [SQL]',(450,855))
    d.edge([(850,800),(850,915),(720,915),(720,1000)],'Lee / escribe [Redis]',(720,950))
    d.edge([(1080,800),(1080,900),(1160,900),(1160,1000)],'Guarda / obtiene [HTTPS]',(1160,950))
    d.edge([(190,760),(190,1000)],'Lectura autorizada\n[SQL]',(190,885))
    d.box(500,1240,360,125,'Worker / publicador','[Contenedor: procesos NestJS]',['Publica outbox, consume tareas,','reintenta y reconoce duplicados.'])
    d.box(1050,1240,280,125,'Cola de mensajes','[Contenedor: Amazon SQS]',['Entrega tareas al consumidor.'])
    d.edge([(500,1300),(475,1300),(475,1090),(440,1090)],'Lee outbox;\nregistra resultado [SQL]',(330,1220))
    d.edge([(860,1275),(1050,1275)],'Publica [HTTPS]',(955,1255))
    d.edge([(1050,1330),(860,1330)],'Consume [HTTPS]',(955,1355))
    d.box(1640,620,315,130,'Pasarela de pago','[Sistema externo]',['Cobros y resultados verificables.'],EXTERNAL)
    d.box(1640,920,315,150,'Servicios de negocio','[Sistemas externos]',['PSE, consulta RUC,','notificaciones y mapas.'],EXTERNAL)
    d.edge([(1160,660),(1640,660)],'Inicia y consulta [HTTPS]',(1390,638))
    d.edge([(1640,720),(1160,720)],'Notificación verificada [HTTPS]',(1390,746))
    d.edge([(1160,775),(1470,775),(1470,975),(1640,975)],'Solicita servicios [HTTPS]',(1430,885))
    d.edge([(680,1365),(680,1390),(1590,1390),(1590,1040),(1640,1040)],'Ejecuta tareas\n[HTTPS]',(1720,1225))
    d.footer(1465,['PostgreSQL, Redis y Python requieren acceso privado autorizado.','API y workers: despliegue propuesto en EC2; datos en RDS.','Publicador y consumidores pueden ejecutarse por separado.'])
    d.save()


def componentes():
    d=Diagram('nivel3-componentes',2000,1660,'[Diagrama de componentes] MayoristaPro — API NestJS','Modelo C4 · Nivel 3 · Módulos del monolito modular; colaboración en ejecución')
    d.box(690,120,400,105,'Aplicación web','[Contenedor: Angular]',['Interfaz de usuarios empresariales'])
    d.boundary(45,295,1510,1120,'API MayoristaPro [Contenedor: NestJS · monolito modular]')
    d.box(680,365,420,115,'Controladores HTTP','[Componente: presentación NestJS]',['Valida entrada e invoca casos de uso.'],COMPONENT)
    d.edge([(890,225),(890,365)],'Invoca API [HTTPS / JSON]',(890,265))
    xs=[90,460,830,1200]
    row1=[('Usuarios',['Identidad, empresa y permisos.']),('Proveedores',['Perfil y verificación comercial.']),('Cotizaciones',['Solicitudes y ofertas aceptadas.']),('Recomendaciones',['Coordina Python y alternativa.'])]
    for x,(title,lines) in zip(xs,row1): d.box(x,620,300,110,title,'[Componente: módulo]',lines,COMPONENT)
    d.edge([(890,480),(890,550),(240,550),(240,620)],'Invoca casos de uso',(500,535))
    for cx in [610,980,1350]: d.edge([(cx,550),(cx,620)])
    d.edge([(890,550),(1350,550)],marker=None)
    for x,title,lines in [(90,'Productos',['Catálogo, precios y reservas.']),(460,'Pedidos',['Condiciones, ítems y estados.']),(830,'Pagos',['Intentos y reconciliación.'])]:
        d.box(x,900,300,120,title,'[Componente: módulo]',lines,COMPONENT)
    d.edge([(610,900),(610,825),(240,825),(240,900)],'Reserva / libera stock',(420,810))
    d.edge([(660,900),(660,780),(980,780),(980,730)],'Obtiene oferta aceptada',(810,766))
    d.edge([(760,935),(830,935)],'Inicia / consulta',(795,918),size=12)
    d.edge([(830,995),(760,995)],'Resultado verificado',(795,1045),size=12)
    d.box(1200,900,300,160,'Gestión operativa','[Componentes: módulos]',['Entregas · Incidencias','Reportes · Administración'],COMPONENT)
    d.edge([(680,420),(65,420),(65,1090)],marker=None)
    d.edge([(65,1090),(1350,1090),(1350,1060)],'Controladores invocan también Productos, Pedidos, Pagos y gestión operativa',(710,1115))
    d.edge([(240,1090),(240,1020)])
    for cx in [610,980]: d.edge([(cx,1090),(cx,1020)])
    d.box(1630,615,325,115,'Recomendación','[Contenedor: Python / FastAPI]',['Puntuación y explicación.'])
    d.box(1630,900,325,120,'Pasarela de pago','[Sistema externo]',['Procesa cobros y consultas.'],EXTERNAL)
    d.edge([(1500,675),(1630,675)],'HTTP privado',(1565,640),size=12)
    # La salida a pasarela evita atravesar los componentes operativos.
    d.edge([(980,900),(980,850),(1585,850),(1585,960),(1630,960)],'Cobro / consulta y notificación verificada [HTTPS]',(1300,835))
    d.box(240,1220,360,145,'Persistencia de módulos','[Adaptadores: PostgreSQL]',['Cada módulo posee sus datos.','Transacción común para pedido y stock.'],COMPONENT)
    d.box(870,1220,420,145,'Eventos posteriores','[Adaptadores: outbox / SQS]',['Eventos persistidos atómicamente.','Publicador y workers en el nivel 2.'],COMPONENT)
    d.edge([(420,1090),(420,1220)],'Usa puertos internos',(420,1170))
    d.edge([(1080,1090),(1080,1220)],'Persiste eventos',(1080,1170))
    d.footer(1480,['Los módulos se despliegan juntos; no son microservicios.','Colaboran por contratos / API pública, sin tablas privadas ajenas.','Persistencia y eventos son infraestructura compartida, no negocio.'])
    d.save()


def clases():
    d=Diagram('nivel4-clases',1900,1510,'[Diagrama de código] MayoristaPro — Pedidos','Modelo C4 · Nivel 4 · UML de clases · Diseño propuesto; firmas por completar en Sprint 02')
    cols=[(35,270,'PRESENTACIÓN','#EDF3FC','#2F5FA7'),(325,440,'APLICACIÓN','#F0F8F2','#2F7D4F'),(785,560,'DOMINIO','#FEF8EE','#B7791F'),(1365,500,'INFRAESTRUCTURA','#F6F1FC','#6D4AA8')]
    for x,w,title,fill,stroke in cols:
        d.rect(x,100,w,1220,fill,stroke,True)
        d.text(x+w/2,130,title,17,stroke,True,'middle')
    def cls(x,y,w,name,attrs,methods,kind=''):
        head=52 if kind else 34
        height=head+max(24,len(attrs)*22+12)+max(24,len(methods)*22+12)
        d.rect(x,y,w,height,'white','#475569')
        if kind: d.text(x+w/2,y+19,kind,13,MUTED,anchor='middle')
        d.text(x+w/2,y+head-12,name,17,bold=True,anchor='middle')
        sep=y+head; d.edge([(x,sep),(x+w,sep)],marker=None)
        for i,line in enumerate(attrs): d.text(x+10,sep+23+i*22,line,15)
        sep+=max(24,len(attrs)*22+12); d.edge([(x,sep),(x+w,sep)],marker=None)
        for i,line in enumerate(methods): d.text(x+10,sep+23+i*22,line,15)
        return height
    cls(50,185,240,'OrderController',[],['+ crear()'])
    cls(345,185,400,'CrearPedidoUseCase',[],['+ ejecutar()'])
    cls(345,365,400,'ConfirmarPagoPedidoUseCase',[],['+ ejecutar()'])
    cls(810,175,510,'Pedido',['+ id','+ compradorEmpresaId','+ proveedorId','- estado'],['+ crear()','+ confirmarPagoVerificado()','+ solicitarCancelacion()','+ marcarDespachado()'],'«entity»')
    cls(810,520,510,'ItemPedido',['+ productoId','+ cantidad','+ precioUnitario'],['+ subtotal()'])
    cls(810,745,510,'OrderRepository',[],['+ guardar()','+ buscarPorId()'],'«interface»')
    cls(345,650,400,'StockPort',[],['+ reservar()','+ liberarUnaVez()'],'«interface»')
    cls(345,870,400,'CotizacionesPort',[],['+ obtenerOfertaAceptada()'],'«interface»')
    cls(345,1130,400,'UnidadTrabajoPort',[],['+ ejecutar()'],'«interface»')
    cls(1390,745,450,'PostgresOrderRepository',[],['+ guardar()','+ buscarPorId()'])
    cls(1390,1130,450,'PostgresUnidadTrabajo',[],['+ ejecutar()'])
    d.edge([(290,230),(345,230)],marker='open')
    d.edge([(745,215),(810,215)],'«crea»',(777,201),dash=True,marker='open',size=12)
    d.edge([(1065,427),(1065,520)],'1     1..*',(1140,490),start='diamond',marker=None)
    # Dependencias con canales separados, fuera de las cajas.
    d.edge([(745,245),(775,245),(775,805),(810,805)],marker='open')
    d.edge([(745,260),(755,260),(755,710),(745,710)],marker='open')
    d.edge([(745,275),(765,275),(765,930),(745,930)],marker='open')
    d.edge([(345,250),(335,250),(335,1085),(460,1085),(460,1130)],marker='open')
    d.edge([(745,405),(780,405),(780,825),(810,825)],marker='open')
    d.edge([(545,457),(545,650)],marker='open')
    d.edge([(345,405),(330,405),(330,1100),(390,1100),(390,1130)],marker='open')
    d.edge([(1390,805),(1320,805)],dash=True,marker='triangle')
    d.edge([(1390,1190),(1350,1190),(1350,1290),(545,1290),(545,1240)],dash=True,marker='triangle')
    d.rect(60,650,225,220,'#FFFBEA','#B7A54A')
    for i,line in enumerate(['Puertos de aplicación:','StockPort, CotizacionesPort','y UnidadTrabajoPort.','','Coordinan otros módulos','y el límite transaccional.','','Los adaptadores comparten','la transacción del pedido.']): d.text(72,675+i*21,line,14)
    d.rect(1390,200,450,190,'#FFFBEA','#B7A54A')
    for i,line in enumerate(['Regla de dependencia','La infraestructura implementa interfaces.','El dominio no importa NestJS ni PostgreSQL.','','La llamada a la pasarela ocurre fuera','de la transacción de pedido y reserva.']): d.text(1405,228+i*25,line,16,bold=i==0)
    d.rect(35,1360,1830,105,stroke='#B8BDC5')
    d.text(55,1388,'Notación UML',16,bold=True)
    d.text(55,1416,'Flecha abierta: asociación · Discontinua: dependencia · Triángulo hueco: realización · Rombo relleno: composición',16)
    d.text(55,1442,'Alcance: clases principales de Pedidos. Las interfaces de coordinación pertenecen a Aplicación; OrderRepository pertenece a Dominio.',15,MUTED)
    d.save()


def secuencia():
    d=Diagram('nivel4-secuencia',2000,1650,'[Diagrama de secuencia] Crear pedido e iniciar pago','Modelo C4 · Nivel 4 · UML · Pedido y reserva atómicos; pasarela fuera de la transacción SQL')
    centers=[150,465,790,1110,1430,1810]
    titles=[('Comprador','Cliente web'),('CrearPedido','Caso de uso'),('Unidad de trabajo','Y adaptadores'),('PostgreSQL','Persistencia'),('Módulo Pagos','API pública'),('Pasarela','Sistema externo')]
    for i,(x,(title,sub)) in enumerate(zip(centers,titles)):
        d.rect(x-135,120,270,80,['#EDF3FC','#EDF8F0','#F4EFFA','#EEF4FC','#EDF8F0','#F2F3F5'][i],'#64748B',radius=5)
        d.text(x,152,title,18,bold=True,anchor='middle'); d.text(x,179,sub,14,MUTED,anchor='middle')
        d.edge([(x,200),(x,1465)],dash=True,marker=None)
    def msg(a,b,y,label,ret=False):
        if a==b:
            x=centers[a]; d.edge([(x,y),(x+70,y),(x+70,y+38),(x,y+38)],label,(x+170,y+15),dash=ret,marker='open' if ret else 'arrow',size=14)
        else: d.edge([(centers[a],y),(centers[b],y)],label,((centers[a]+centers[b])/2,y-10),dash=ret,marker='open' if ret else 'arrow',size=14)
    msg(0,1,250,'1. Oferta aceptada e identidad autenticada')
    msg(1,1,295,'2. Autorizar y comprobar idempotencia')
    msg(1,2,385,'3. Crear pedido y reserva atómicos')
    msg(2,3,440,'4. BEGIN; revalidar y bloquear productos')
    d.rect(25,480,1940,900,'none','#475569')
    d.rect(25,480,65,28,'#F1F5F9','#475569'); d.text(38,500,'alt',16,bold=True)
    d.text(105,505,'[Stock y condiciones válidos]',16,bold=True)
    msg(2,3,560,'5. Guardar pedido, ítems y reserva')
    msg(2,3,610,'6. COMMIT')
    msg(1,0,670,'7. Pedido pendiente y vencimiento',True)
    msg(0,4,740,'8. Iniciar pago del pedido')
    msg(4,3,805,'9. Persistir intento y referencia')
    msg(4,5,865,'10. Solicitar pago [HTTPS]')
    msg(5,4,925,'11. Resultado verificable o pendiente',True)
    msg(4,3,985,'12. Guardar estado del intento')
    d.rect(420,1025,1505,135,'#FFFBEA','#B7A54A')
    d.text(440,1052,'Solo ante un resultado definitivo y verificado:',16,bold=True)
    msg(4,2,1095,'13. Aplicar resultado al pedido por contrato')
    msg(2,3,1140,'14. Cambio de pedido, reserva y outbox atómicos')
    d.edge([(25,1200),(1965,1200)],dash=True,marker=None)
    d.text(45,1230,'[Stock insuficiente o conflicto]',16,bold=True)
    msg(2,3,1280,'ROLLBACK')
    msg(1,0,1340,'Rechazo controlado; no se inicia pago',True)
    d.rect(35,1500,1930,110,'#FFFBEA','#B7A54A')
    d.text(55,1530,'Resultado pendiente: no confirma ni cancela el pedido. Pagos consulta la pasarela hasta resolver la incertidumbre.',17)
    d.text(55,1558,'Un rechazo definitivo libera la reserva una sola vez; una confirmación tardía exige reconciliación.',16)
    d.text(55,1585,'Reintentos persistidos permiten recuperarse entre el registro del intento y la actualización del pedido. Flecha discontinua: respuesta.',15,MUTED)
    d.save()


if __name__ == '__main__':
    for build in [contexto, contenedores, componentes, clases, secuencia]: build()
    print('Generados 5 SVG en',ROOT)
