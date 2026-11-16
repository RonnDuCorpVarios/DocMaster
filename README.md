# Lector (app Android)

Lector de Word, Excel, PowerPoint y PDF con modo claro/oscuro, historial de archivos abiertos y buscador de palabras.

## Cómo compilar el APK sin instalar nada

1. En github.com crea un repositorio nuevo (puede ser privado).
2. Sube TODO el contenido de esta carpeta al repositorio (Add file → Upload files).
   - Debe quedar la carpeta `.github/workflows/build-apk.yml`. Si tu navegador no sube carpetas ocultas,
     crea el archivo a mano: Add file → Create new file, escribe `.github/workflows/build-apk.yml` como nombre y pega su contenido.
3. Entra en la pestaña **Actions**. La compilación arranca sola con cada cambio; también puedes lanzarla con
   **Compilar APK → Run workflow**. Tarda unos 5-8 minutos.
4. Al terminar, abre la ejecución y descarga el artefacto **Lector-APK** (un .zip con `app-debug.apk`).
5. Descomprime e instala el APK en el teléfono (permite instalar apps de origen desconocido).

## Notas

- El APK es de depuración (debug): sirve para instalar y usar, pero no para publicar en Google Play.
- El historial guarda una copia de cada archivo (hasta 30 MB por archivo y 40 archivos) para poder reabrirlo sin buscarlo.
- Para cambiar el nombre o el id de la app edita `capacitor.config.json` (`appName`, `appId`).
