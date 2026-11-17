# DocMaster – All-in-One Document Reader

Lector de Word, Excel, PowerPoint, PDF y TXT con modo claro/oscuro, historial de archivos abiertos,
buscador de palabras y pestaña «Acerca de».

Desarrollador y propietario: **RonnDu Corp**

## Cómo compilar el APK sin instalar nada

1. En github.com crea un repositorio nuevo (puede ser privado).
2. Sube TODO el contenido de esta carpeta al repositorio (Add file → Upload files).
   - Debe quedar `.github/workflows/build-apk.yml`. Si tu navegador no sube carpetas ocultas,
     crea el archivo a mano: Add file → Create new file, escribe `.github/workflows/build-apk.yml` como nombre y pega su contenido.
3. Abre la pestaña **Actions**. La compilación arranca con cada cambio, o con **Compilar APK → Run workflow** (5-8 min).
4. Descarga el artefacto **DocMaster-APK** (un .zip con `DocMaster-vX.Y.Z.apk`) e instálalo en el teléfono.

## Cómo comprobar que usas el workflow nuevo

En Actions, el artefacto debe llamarse **DocMaster-APK** y el log debe incluir la línea
`[docmaster] Icono de DocMaster aplicado`. Si el artefacto se llama `Lector-APK`, el repositorio conserva el workflow
antiguo (la carpeta oculta `.github` no se subió). El icono se aplica igualmente gracias a `scripts/apply-android.mjs`,
pero conviene reemplazar `.github/workflows/build-apk.yml` con el del zip.

## Versiones

- La versión visible (Acerca de) sale de `"version"` en `package.json`. En cada actualización súbela
  (1.0.0 → 1.0.1 → 1.1.0…).
- El número de compilación (`versionCode` de Android) sube solo con cada ejecución de GitHub Actions, así que
  Android siempre acepta instalar la nueva compilación encima de la anterior.
- Todas las compilaciones se firman con la misma clave (`resources/debug.keystore`), así que cada APK nuevo
  se instala encima del anterior sin perder datos ni historial.

## Notas

- El APK es de depuración: sirve para instalar y usar, no para publicar en Google Play.
- El logo original está en `resources/logo-original.jpg`; los iconos de Android ya están generados en `resources/android/res`.
