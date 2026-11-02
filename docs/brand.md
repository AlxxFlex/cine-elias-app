# Marca Cine Elías

El símbolo combina una C exterior con una E en negativo y cortes de diafragma cinematográfico. Se utiliza en blanco puro sobre negro, sin contenedor pastel, efectos ni ilustraciones decorativas.

## Archivos finales

- `assets/cinema/mark.svg`: contornos vectoriales finales, con relleno uniforme `#FFFFFF` y fondo transparente.
- `assets/cinema/mark.png`: marca transparente de 512 × 512 para encabezados y splash.
- `assets/cinema/monochrome.svg` y `.png`: versión transparente de 512 × 512 con zona segura para el icono temático de Android.
- `assets/cinema/icon.svg` y `.png`: composición de 1024 × 1024 para el icono. El PNG tiene fondo opaco `#080808` y marca centrada.
- `src/components/brand-logo.tsx`: componente compartido que consume la marca local con `expo-image`.

El concepto se generó con la herramienta integrada ImageGen. Después se trazó automáticamente la silueta mediante Potrace: se retuvieron los píxeles con alfa de al menos 128 y canales RGB de al menos 180, se suprimieron partículas de hasta 40 píxeles y se optimizaron las curvas con tolerancia 0.35. No se reconstruyó el símbolo a mano.

Los contornos resultantes se rellenaron con blanco puro y se exportaron con resvg. Así se eliminaron las variaciones de color, la textura y los píxeles fantasma del original; el alfa parcial del PNG final solo suaviza los bordes. Las herramientas de trazado y exportación se instalaron fuera del proyecto y no añadieron dependencias a la app.

Se revisó la marca sobre negro y gris medio. La comprobación de píxeles del PNG de marca encontró cero píxeles visibles de color distinto a `#FFFFFF`. Los SVG actuales sustituyen la antigua tira de película y contienen los contornos de esta identidad.

## Prompt final

```text
Use case: logo-brand. Asset type: production logo symbol for a premium independent movie theater mobile app called Cine Elías. Create ONE original, extremely polished compact geometric monogram symbol combining a cinematic C with a subtle E in negative space and the visual rhythm of a projector aperture. The mark should feel designed by a meticulous contemporary identity studio: simple, confident, exact optical balance, a memorable silhouette with few bold forms and generous clean negative space, readable at 32 pixels. Use only solid warm white/off-white ink (#F6F5F1) with genuinely transparent negative space and a genuinely transparent background. Single flat logo symbol centered on a 1024x1024 canvas, tightly composed to occupy roughly 75% of the square, with a little breathing room; no wordmark or letters as separate text. Do not resemble an existing cinema brand logo. Do not use a stock film-strip outline, clapperboard, popcorn, play triangle, generic letter in rounded square, generic camera, star, sparkle, blue-purple AI swoosh, gradient, shine, 3D, shadow, texture, mockup, container tile, background, watermark, or explanatory text. This is final artwork, not a presentation board or multiple variations. Clean professional brand geometry, restrained editorial cinema character.
```
