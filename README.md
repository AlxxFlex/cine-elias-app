# Cine Elías

Aplicación de cine para Android, iOS y web, con React Native, Expo SDK 58, Expo Router y TypeScript estricto. Consume Eliasib Cine API; no incluye películas, tarifas ni ocupación ficticias.

## Ejecutar

Requiere Node.js 22.13 o posterior compatible con Expo SDK 58. El entorno inicial tenía Node 22.8 y Expo muestra una advertencia con esa versión.

```powershell
npm install
Copy-Item .env.example .env.local
# Edita .env.local para apuntar a tu API si hace falta.
npx expo start
```

Abre el QR en Expo Go compatible con SDK 58, o pulsa `a`, `i` o `w` para abrir un emulador o el navegador. En Windows, el simulador iOS requiere una Mac; un iPhone físico puede usar Expo Go. Las dependencias añadidas usan módulos incluidos en Expo Go.

El backend debe estar activo y publicar el puerto 8000. Comprueba `http://localhost:8000/health` y `http://localhost:8000/docs` en la computadora anfitriona. La app recibe la URL sin el sufijo `/api`:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
```

Usa la IP LAN de tu computadora para teléfonos físicos, `http://10.0.2.2:8000` para el emulador Android y `http://localhost:8000` para el navegador o simulador iOS. Teléfono y computadora deben compartir una red con acceso al puerto 8000. `localhost` en un teléfono apunta al teléfono. Reinicia Metro al cambiar variables de entorno.

Sin variable explícita, se detecta el host LAN de Metro cuando está disponible y se aplica un valor por plataforma. Un túnel de Metro no publica la API: configura una URL propia accesible para el backend en ese caso. Para web, configura CORS en FastAPI para el origen de Expo (normalmente `http://localhost:8081`); una página HTTPS necesita una API HTTPS. Las variables `EXPO_PUBLIC_*` son públicas y nunca deben contener secretos.

## Flujo

La cartelera usa películas y categorías reales, búsqueda local sobre todas las páginas del catálogo y funciones futuras. El detalle relaciona categoría, director y funciones; la selección de sala respeta las filas y números registrados por el backend. Los boletos de cada función determinan los asientos ocupados.

En una base vacía, usa la sección de administración del catálogo para registrar categorías/directores, películas, salas, asientos y funciones. Los formularios envían datos a los endpoints existentes; la app no carga datos de demostración automáticamente.

El perfil de visitante se crea mediante `POST /api/users` y se recuerda en este dispositivo, asociado a la URL de su backend. Cambiar de API no reutiliza IDs de otra base. La API no tiene login, sesiones ni recuperación de contraseña: este perfil no representa autenticación. No se permite entrar en la cuenta de otra persona indicando su correo o ID. La contraseña se envía únicamente al crear el usuario y no se guarda localmente.

La confirmación crea registros reales mediante `POST /api/tickets`. El servidor impide duplicar asiento y función con HTTP 409. No existe pago ni una tarifa por función en el contrato: la app no inventa cobros y envía precio nulo cuando no hay una tarifa proporcionada. Los precios de boletos ya emitidos son datos históricos, no una tarifa para nuevas emisiones. La creación de varios boletos ocurre por separado; el servidor no ofrece transacciones de grupo, retención temporal ni cancelación de compra. Se informa cualquier confirmación parcial y se verifica la ocupación antes de emitir.

## Estructura

```text
src/app/          Pantallas y navegación de Expo Router
src/components/   Interfaz compartida
src/constants/    Tema
src/services/     Cliente HTTP, validación y errores de API
src/state/        Catálogo compartido, perfil local y selección temporal
src/types/        Contrato TypeScript de los ocho recursos
docs/             Capacidades y límites de la API auditada
```

Las consultas tienen tiempo límite, deduplicación de solicitudes simultáneas y paginación completa. Las respuestas se validan en ejecución. Una actualización fallida invalida los asientos seleccionados para impedir confirmar con disponibilidad obsoleta. La selección se conserva entre pantallas durante la sesión; solo el perfil sin contraseña persiste en AsyncStorage.

## Verificar

```powershell
npx expo lint
npx tsc --noEmit
npm run api:test
node --test tests/api-client.test.cjs
npx expo-doctor
npx expo export --platform web
```

Las pruebas del cliente HTTP usan respuestas controladas y no modifican datos del servidor. Cubren paginación, deduplicación, conflictos de disponibilidad, errores de red/validación y resolución de URLs.

No se incluyen carpetas nativas `ios/` o `android/`; Expo las genera si se necesita una compilación nativa. No hace falta generarlas para usar Expo Go. El contrato examinado está resumido en [docs/api-contract.md](docs/api-contract.md).

La revisión funcional y visual, sus capturas y los límites de la verificación están en [docs/verification.md](docs/verification.md).
