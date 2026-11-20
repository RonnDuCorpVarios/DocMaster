# DocMaster 2.0 – All-in-One Document Reader

Lector local para Word (.docx), Excel (.xlsx, .xls, .csv), PowerPoint (.pptx), PDF y TXT.

## Funciones

- Apertura local de documentos, también desde «Abrir con» en Android.
- Búsqueda de palabras en documentos y hojas de cálculo.
- Zoom mediante botones y gestos de pellizco.
- Tema claro y oscuro.
- Historial de documentos y reapertura de archivos guardados en IndexedDB (hasta 30 MB por archivo).
- Biblioteca de favoritos.
- Marcadores para recordar posiciones de lectura y saltar a ellas.
- Progreso y última posición de lectura guardados localmente.
- Compartir el archivo mediante el menú nativo del dispositivo cuando el WebView admite compartir archivos.
- Guardar fragmentos de texto seleccionados en documentos con texto seleccionable.
- Ajustes de lectura: tamaño de letra, interlineado y fondo sepia.
- Los datos de biblioteca, marcadores, progreso y preferencias se guardan en el dispositivo.

## Notas de compatibilidad

- Se mantiene Vite, JavaScript y Capacitor 6, sin migración de framework.
- Los PDF se representan con PDF.js en canvas; por eso la selección y el guardado de fragmentos PDF no están incluidos en esta versión.
- Los marcadores PDF apuntan a páginas. En Word/TXT/PowerPoint guardan una posición aproximada de desplazamiento.
- Excel continúa mostrando hasta 1.000 filas por hoja para limitar el consumo de memoria.
- PowerPoint muestra el texto de las diapositivas; imágenes y diseños complejos no se reproducen íntegramente.
- El compartir archivos depende de la compatibilidad de Web Share del Android System WebView instalado.
- No se han añadido cuentas, servidores, sincronización en nube ni permisos de red adicionales.

## Cómo compilar el APK sin instalar nada

1. En GitHub crea un repositorio nuevo (puede ser privado).
2. Sube TODO el contenido de esta carpeta al repositorio, incluida `.github/workflows/build-apk.yml`.
3. Abre la pestaña **Actions**. La compilación arranca con cada cambio, o con **Compilar APK → Run workflow**.
4. Descarga el artefacto **DocMaster-APK** e instala el APK en el teléfono.

## Versiones

- La versión visible en «Acerca de» sale de `version` en `package.json` (esta entrega: 2.0.0).
- El número de compilación Android se incrementa con cada ejecución de GitHub Actions.
- Las compilaciones usan la clave incluida en `resources/debug.keystore` para permitir instalar actualizaciones sobre la misma instalación, siempre que se conserve esa clave.

## Propietario

**RonnDu Corp**
