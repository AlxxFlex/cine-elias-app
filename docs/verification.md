# Verificación de Cine Elías

Revisión realizada el 2 de noviembre de 2026 sobre Expo SDK 58.

## Comprobaciones automáticas

- `npx expo lint`: sin errores ni advertencias de código.
- `npx tsc --noEmit`: correcto con TypeScript estricto.
- `npm run api:test`: 10 pruebas correctas. Cubren paginación, deduplicación, validación de respuestas, errores HTTP y de red, cuerpos de boletos y resolución de URLs.
- `npx expo install --check`: dependencias compatibles.
- `npx expo-doctor`: 18 de 18 comprobaciones correctas.
- `npx expo export --platform all`: bundles de Android, iOS y web generados correctamente.

El Node.js instalado en esta computadora es 22.8.0: Expo advierte que se debe actualizar a una versión compatible, desde 22.13.0. Las comprobaciones anteriores terminaron correctamente en este entorno.

## API real

Se consultaron Swagger/OpenAPI, `/health`, los ocho listados y CORS. La API es accesible tanto por `localhost:8000` como por la IP LAN configurada en `.env.local`. Todos los recursos estaban vacíos al inicio y continuaron vacíos al terminar la revisión. No se insertaron datos de prueba en Docker.

Se comprobó la navegación con el catálogo real vacío, el acceso a gestión y la validación del formulario de visitante. La aplicación no introduce películas, ocupación ni precios de demostración.

## Recorrido visual y funcional

Se abrió la aplicación en Chrome con anchos de 320, 390 y 768 píxeles. Para probar un catálogo poblado se interceptaron las peticiones exclusivamente en el navegador de pruebas; esos registros nunca formaron parte del código de producción ni de la base real.

Recorrido comprobado:

1. Cartelera, búsqueda sin distinción de acentos, detalle y horarios.
2. Selección de asientos reales según el contrato, desplazamiento horizontal y asientos ocupados deshabilitados. Estado seleccionado expuesto a accesibilidad.
3. Creación de visitante y conservación de asientos al navegar al perfil y volver al resumen.
4. Emisión de dos boletos interrumpida después del primero. El reintento recuperó los folios existentes y emitió únicamente el restante.
5. Confirmación e historial con los dos folios, sin duplicados.
6. Alta y edición de categoría mediante los cuerpos documentados.
7. Rechazo de cambios de película en una función con boletos emitidos.
8. Error de conexión y recuperación mediante Reintentar.

Las respuestas 503 y la conexión interrumpida de estos escenarios fueron errores introducidos deliberadamente por la prueba. No se observaron errores de ejecución adicionales.

Capturas representativas: [catálogo real vacío](qa/live-home-390.png), [cartelera de prueba a 320 px](qa/fixture-catalog-320.png), [sala de prueba](qa/fixture-seats-390.png) y [resumen de prueba](qa/fixture-confirmation-390.png).

No se ejecutó la aplicación en un dispositivo físico ni se verificaron VoiceOver/TalkBack o el teclado nativo. La exportación de ambas plataformas comprueba la resolución y compilación de sus módulos; la prueba final en Expo Go sigue siendo necesaria para verificar el comportamiento nativo.

## Actualización visual de la cartelera y marca

Se adaptó la estructura de la cartelera a la referencia pública de [Cinépolis GO](https://play.google.com/store/apps/details?id=com.cinepolis.go): pestañas Películas/Horarios, carteles en dos columnas, metadatos compactos y acciones azules. Se conservó una identidad propia en negro y blanco y se sustituyó la antigua tira de película por la nueva marca C/E, disponible en PNG y SVG. El proceso de la marca está en [brand.md](brand.md).

La búsqueda y los filtros se despliegan a petición para dejar visibles los carteles antes del primer desplazamiento. La lista ahora está virtualizada. La vista Horarios consulta las funciones existentes y permite seleccionar fecha, sala y horario.

Se repitió el recorrido del navegador sobre la versión actualizada, incluyendo cambio entre Películas y Horarios, búsqueda, asientos, emisión parcial, reintento, historial y recuperación de errores. Las capturas vigentes están en [qa/redesign](qa/redesign/). Los registros utilizados en esas capturas continúan siendo respuestas aisladas del navegador de pruebas; no se añadieron datos a la API real.
