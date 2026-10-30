# Diagramas C4 de MayoristaPro

Los documentos de `docs/04-modelo-c4` muestran los PNG de `img/`. Esta carpeta contiene sus fuentes SVG editables y el generador para reproducirlas.

| Vista | Fuente | Imagen |
|---|---|---|
| Contexto | [nivel1-contexto.svg](nivel1-contexto.svg) | [PNG](../nivel1-contexto.png) |
| Contenedores | [nivel2-contenedores.svg](nivel2-contenedores.svg) | [PNG](../nivel2-contenedores.png) |
| Componentes | [nivel3-componentes.svg](nivel3-componentes.svg) | [PNG](../nivel3-componentes.png) |
| Clases | [nivel4-clases.svg](nivel4-clases.svg) | [PNG](../nivel4-clases.png) |
| Secuencia | [nivel4-secuencia.svg](nivel4-secuencia.svg) | [PNG](../nivel4-secuencia.png) |

## Regeneración

Desde la raíz del repositorio, con Python 3 y Microsoft Edge instalados:

```powershell
python img/fuentes-svg/generar_diagramas.py
powershell -ExecutionPolicy Bypass -File img/fuentes-svg/exportar-png.ps1
```

Para cambios reproducibles, editar el generador antes de regenerar los SVG. Los SVG también se pueden editar directamente con un editor vectorial; esos cambios manuales se sobrescriben al regenerar.

## Referencia visual

La presentación toma como referencia los [diagramas del repositorio Marketplace-arquitSoft-02](https://github.com/devlizbethjaico/Marketplace-arquitSoft-02/tree/main/docs/04-modelo-c4): personas en azul oscuro, contenedores en azul, componentes en azul claro, servicios externos en gris, límites discontinuos, leyendas y clases UML organizadas por capas.

Los gráficos se construyeron para MayoristaPro a partir de su documentación. No se incorporaron las imágenes ni la arquitectura del proyecto de referencia. Los diagramas representan un diseño propuesto, no una implementación verificada.
