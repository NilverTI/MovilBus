# MovilBus Web

Sitio web de MovilBus para la comunidad de Euro Truck Simulator 2 (PeruServer), construido con HTML, CSS y JavaScript vanilla.

![Vista principal MovilBus](assets/github/Home.jpeg)

## Demo en vivo

- Produccion: https://movilbuspsv.netlify.app/

## Resumen

Esta web centraliza en una sola pagina:

- Estado general del servidor.
- Rutas activas con mapa interactivo.
- Equipo de conductores.
- Ranking mensual e historico.
- Postulacion oficial mediante Google Forms.

La base es `index.html`, y las secciones se cargan como parciales HTML desde `html/`.

## Caracteristicas principales

- Navbar fija con navegacion por anclas y estado activo por scroll/hash.
- Hero con carrusel, CTA y metricas principales.
- Mapa de Peru con rutas activas y modal de detalle por viaje.
- Tarjetas de conductores con modal de estadisticas e historial.
- Ranking Top 5 mensual y Top 5 historico.
- Integracion de formulario externo de postulacion.
- Interfaz responsive para movil, tablet y escritorio.

## Integracion de datos (Trucky API)

Compania objetivo: `41407`

- Base API: `https://e.truckyapp.com/`
- Endpoints principales:
  - `/members`
  - `/jobs`
  - `/jobs?status=in_progress...`

Reglas actuales:

- Se muestra la ultima ruta en curso por conductor.
- Ventana de analisis: ultimas `72` horas.
- Si la API no responde, se usa fallback local.

## Stack tecnico

- HTML5
- CSS3 modular (`variables`, `layout`, `components`, `animations`)
- JavaScript vanilla modular por archivo
- Fetch API + cache local (`localStorage`)

## Estructura del proyecto

```text
movilbus-web/
|-- index.html
|-- README.md
|-- html/
|   |-- rutas.html
|   |-- trabajadores.html
|   |-- ranking.html
|   `-- postula.html
|-- css/
|   |-- variables.css
|   |-- layout.css
|   |-- components.css
|   |-- animations.css
|   `-- styles.css
|-- js/
|   |-- utils.js
|   |-- api.js
|   |-- rutas.js
|   |-- trabajadores.js
|   |-- ranking.js
|   `-- main.js
|-- services/
|   `-- truckyService.js
`-- assets/
    |-- github/
    |   `-- Home.jpeg
    `-- img/
        |-- logo.svg
        |-- mapa-peru.png
        |-- Movil.webp
        |-- default-avatar.svg
        `-- icons/
            |-- icon.webp
            `-- PSVLOGO.png
```

## Ejecucion local

Necesita servidor HTTP local (no abrir con `file://`).

### Opcion 1: VS Code Live Server

1. Abrir el proyecto en VS Code.
2. Click derecho en `index.html`.
3. Seleccionar `Open with Live Server`.

### Opcion 2: Python

```bash
python -m http.server 5500
```

Abrir en navegador: `http://127.0.0.1:5500/`

## Configuracion rapida

### Cambiar compania de Trucky

Editar `API_BASE` en [js/api.js](js/api.js).

### Cambiar ventana de rutas activas

Editar `LAST_ROUTE_WINDOW_HOURS` en [js/rutas.js](js/rutas.js).

### Cambiar enlace de postulacion

Editar `href` y `src` en [html/postula.html](html/postula.html).

### Cambiar enlaces del header/footer

Editar `renderSiteFrame()` en [js/main.js](js/main.js).

## Secciones disponibles

- `#inicio`
- `#nosotros`
- `#rutas`
- `#trabajadores`
- `#ranking`
- `#postula`

## Creditos

- Proyecto: MovilBus
- Desarrollo: NILVER T.I
- Fuente de datos: Trucky API
