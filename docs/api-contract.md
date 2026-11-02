# Contrato auditado: Eliasib Cine API

Referencia: OpenAPI 3.1 disponible en `GET http://localhost:8000/openapi.json`, título **Eliasib Cine API**, versión **1.0.0**, y el diccionario HTML proporcionado. Auditoría realizada el 2 de noviembre de 2026. `/health` respondió `{ "status": "ok" }`; los ocho recursos estaban vacíos al comenzar.

## Endpoints

Cada recurso ofrece la misma familia de operaciones. El nombre del parámetro de ruta cambia en OpenAPI, pero siempre es un ID entero en esa posición:

| Recurso    | Ruta base               | Modelo de lectura | Parámetro individual |
| ---------- | ----------------------- | ----------------- | -------------------- |
| Películas  | `/api/movies`           | `MovieRead`       | `movie_id`           |
| Directores | `/api/directors`        | `NamedRead`       | `director_id`        |
| Categorías | `/api/categories`       | `NamedRead`       | `category_id`        |
| Usuarios   | `/api/users`            | `UserRead`        | `item_id`            |
| Salas      | `/api/auditoriums`      | `AuditoriumRead`  | `item_id`            |
| Asientos   | `/api/seats`            | `SeatRead`        | `item_id`            |
| Funciones  | `/api/movie-screenings` | `ScreeningRead`   | `item_id`            |
| Boletos    | `/api/tickets`          | `TicketRead`      | `item_id`            |

| Método y ruta                | Entrada                                                                                  | Salida                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `GET /api/{recurso}`         | `skip` opcional, mínimo 0, predeterminado 0; `limit` opcional, 1–100, predeterminado 100 | 200, arreglo JSON                                                      |
| `GET /api/{recurso}/{id}`    | ID en ruta                                                                               | 200, objeto JSON                                                       |
| `POST /api/{recurso}`        | JSON del modelo de creación                                                              | 201, objeto con ID                                                     |
| `PUT /api/{recurso}/{id}`    | JSON completo del modelo de creación                                                     | 200, objeto con ID                                                     |
| `DELETE /api/{recurso}/{id}` | ID en ruta                                                                               | 200, `{ message, id }` según diccionario; OpenAPI no detalla el modelo |

También están disponibles `GET /` y `GET /health` (objeto de cadenas), Swagger en `/docs` y ReDoc en `/redoc`. No hay filtros de película, usuario o sala en las listas: el cliente pagina completamente y relaciona los registros por ID. La app utiliza lectura, creación y actualización de los recursos relevantes; no presenta operaciones destructivas sobre boletos.

## Modelos

Todos los modelos de lectura añaden `id: integer` a sus campos de creación, excepto `UserRead`, que omite `password`.

| Recurso          | Campos obligatorios al crear/actualizar                                            | Campos opcionales y límites                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| movies           | `title: string` (máx. 75)                                                          | `director_id: integer/null`, `length: integer/null` (mín. 0 minutos), `category_id: integer/null`, `movie_summary: string/null` (máx. 255), `image: string/null` (máx. 255) |
| directors        | `name: string`                                                                     | El diccionario indica máx. 50; OpenAPI usa `NamedCreate` sin longitud declarada                                                                                             |
| categories       | `name: string`                                                                     | El diccionario indica máx. 25; OpenAPI usa `NamedCreate` sin longitud declarada                                                                                             |
| auditoriums      | `name: string`                                                                     | El diccionario indica máx. 75; OpenAPI no declara longitud                                                                                                                  |
| users            | `name: string` (máx. 75), `email: string` (máx. 75), `password: string` (1–255)    | Email único según diccionario; OpenAPI no declara formato email                                                                                                             |
| seats            | `seat_number: integer` (mín. 0), `auditorium_id: integer`                          | `row_label: string/null` (máx. 2)                                                                                                                                           |
| movie-screenings | `date: string` (ISO 8601 date-time), `movie_id: integer`, `auditorium_id: integer` | Sin precio, idioma, formato ni aforo adicional                                                                                                                              |
| tickets          | `user_id: integer`, `seat_id: integer`, `movie_screening_id: integer`              | `price: number/string/null`, mín. 0; `TicketRead` devuelve string/null. El diccionario especifica DECIMAL(8,2)                                                              |

Las claves foráneas deben existir. Las relaciones son `movies.category_id → categories.id`, `movies.director_id → directors.id`, `movie-screenings.movie_id → movies.id`, `movie-screenings.auditorium_id → auditoriums.id`, `seats.auditorium_id → auditoriums.id` y `tickets → users, seats, movie-screenings`.

## Errores y disponibilidad

| HTTP | Significado documentado                                                                                              |
| ---- | -------------------------------------------------------------------------------------------------------------------- |
| 404  | Registro inexistente, `{ detail: string }`                                                                           |
| 409  | Correo duplicado, clave foránea inválida, asiento ya vendido o dependencia que impide eliminar; `{ detail: string }` |
| 422  | Validación estándar de FastAPI, `{ detail: [{ loc, msg, type, ... }] }`                                              |

El par `movie_screening_id + seat_id` es único. Un boleto existente bloquea ese asiento únicamente para esa función. No existe un campo de asiento bloqueado ni un endpoint de retención temporal. La app no inventa esos estados. Antes de confirmar vuelve a consultar ocupación; un 409 concurrente se informa y obliga a actualizar la selección.

## Límites que afectan al producto

- OpenAPI no contiene `securitySchemes`, parámetros de autorización, login, tokens ni endpoint de sesión. El visitante creado en el dispositivo es una referencia local, sin autenticación. No se listan usuarios para escoger una identidad existente.
- No hay fecha de estreno, clasificación por edad, tráiler, valoración, estado de estreno ni imagen de fondo independiente. La cartelera distingue funciones programadas de catálogo, sin inventar próximos estrenos.
- No existe una tarifa por función. `tickets.price` describe un boleto ya emitido y no permite deducir el precio de uno nuevo. Las nuevas emisiones sin tarifa usan `price: null` y no se presentan como compras pagadas.
- No hay pagos, pedidos, reservas con vencimiento ni creación transaccional de varios boletos. Una selección de varios asientos requiere un POST por asiento y puede confirmarse parcialmente.
- La estructura de sala disponible consiste en fila y número de asiento. El cliente agrupa exactamente esos registros, sin añadir filas, asientos o pasillos como si fueran datos del backend.
- El contrato no especifica zona horaria del cine. La app usa las fechas ISO del servidor y presenta la hora del dispositivo; para evitar ambigüedad, carga fechas con offset explícito.
- Para exponer esta API fuera de desarrollo se necesita control de acceso en el servidor: las rutas CRUD actuales no tienen permisos por usuario o rol. Un cliente móvil no puede proporcionar esa protección por sí solo.

La implementación valida tipos de respuesta en ejecución, normaliza campos opcionales omitidos a null, pagina con `skip/limit`, deduplica GET simultáneos y limita cada solicitud a 15 segundos. Los valores de `image` relativos se resuelven contra la URL base; las URLs de desarrollo que apuntan a `localhost`, `127.0.0.1` y `0.0.0.0` usan el origen del backend configurado (protocolo, host y puerto) para permitir abrir carteles desde un teléfono o un despliegue HTTPS. Si el póster se sirve desde otro servicio, registra su URL accesible real.
