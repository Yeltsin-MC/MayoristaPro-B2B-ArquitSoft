# Presentación del Sprint 01

[Abrir la presentación actualizada](MayoristaPro-Sprint-01-actualizado.pptx)

La presentación contiene 16 diapositivas principales y 5 anexos con los diagramas completos. Las notas de cada diapositiva incluyen explicaciones y referencias a la documentación del proyecto. En PowerPoint se pueden consultar desde **Vista > Página de notas** o durante la exposición con la **Vista Moderador**.

El texto, las tablas y los diagramas resumidos son editables. Los diagramas completos de los anexos están insertados como imágenes y sus fuentes SVG se encuentran en `img/fuentes-svg/`.

Para regenerar en Windows con PowerPoint instalado, desde la raíz del repositorio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File presentaciones/fuentes/generar-presentacion.ps1 -OutputPath "$PWD/presentaciones/MayoristaPro-Sprint-01-revision.pptx"
```

El generador crea una presentación nueva a partir del contenido de su script. Los cambios realizados directamente en el PowerPoint no se incorporan automáticamente al generador.

Escudo: Universidad Nacional de San Cristóbal de Huamanga, disponible en [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Escudo_de_la_UNSCH.png), licencia [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Imagen original conservada y escalada proporcionalmente. La atribución también figura en las notas de la carátula.
