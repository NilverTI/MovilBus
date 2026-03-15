<div align="center">

# 🚌 MovilBus PeruServer Dashboard
### El centro de mando definitivo para conductores de ETS2 en Perú

[![Website Status](https://img.shields.io/website?color=orange&down_color=red&label=Live%20Demo&up_message=Online&url=https%3A%2F%2Fmovilbuspsv.netlify.app%2F&style=for-the-badge)](https://movilbuspsv.netlify.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Platform: Web](https://img.shields.io/badge/Platform-Web-blue?style=for-the-badge)](https://movilbuspsv.netlify.app/)
[![Code Quality: Professional](https://img.shields.io/badge/Quality-Professional-gold?style=for-the-badge&logo=codeforces)](https://github.com/NilverTI/MovilBus)

---

![Vista principal MovilBus](assets/img/github/Home.jpeg)

*Una plataforma de alto rendimiento diseñada para la gestión en tiempo real de convoyes y conductores de Euro Truck Simulator 2.*

</div>

## 🚀 Vision General

**MovilBus PeruServer** no es solo una página web; es un ecosistema digital robusto construido con **Vanilla JavaScript** y una arquitectura de **micro-servicios** mediante proxys de alto rendimiento. Proporciona visibilidad total sobre las operaciones de la compañía en el servidor de PeruServer.

## 🛠️ Stack Tecnológico Pro

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white) ![JS](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black) |
| **Maps & Tracking** | ![Leaflet](https://img.shields.io/badge/Leaflet-199920?style=flat-square&logo=leaflet&logoColor=white) ![OSRM](https://img.shields.io/badge/OSRM_Engine-005A9C?style=flat-square&logo=openstreetmap&logoColor=white) |
| **Backend / Proxy** | ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white) ![Express](https://img.shields.io/badge/Express.js-000000?style=flat-square&logo=express&logoColor=white) ![Netlify](https://img.shields.io/badge/Netlify-00AD9F?style=flat-square&logo=netlify&logoColor=white) |
| **Integraciones** | ![Trucky](https://img.shields.io/badge/Trucky_API-orange?style=flat-square&logo=truckstats&logoColor=white) ![Google](https://img.shields.io/badge/Google_Forms-4285F4?style=flat-square&logo=googleforms&logoColor=white) |

## ✨ Características de Élite

*   🌐 **Universal Proxy Engine**: Servidor intermedio en Node.js que elimina bloqueos de CORS y optimiza las peticiones a la API de Trucky y CDN de imágenes.
*   🗺️ **Live Real-Time Map**: Mapa dinámico con Leaflet que muestra las rutas activas de los conductores, conectando ciudades reales del Perú mediante el motor de rutas OSRM.
*   🏆 **Dynamic Ranking System**: Algoritmos de ordenamiento en tiempo real para generar rankings mensuales e históricos basados en el kilometraje reportado.
*   👔 **Management Dashboard**: Visualización profesional del staff con perfiles detallados, estados de sincronización y certificados de validación.
*   🎨 **Premium Glassmorphism UI**: Diseño de vanguardia con efectos de desenfuerzo, gradientes vibrantes y tipografía optimizada (Outfit & Inter).
*   📱 **Ultra Responsive Design**: Adaptabilidad total desde monitores 4K hasta dispositivos móviles de gama baja.

## 📁 Arquitectura del Proyecto

El proyecto sigue una estructura de **Separación de Concernimientos (SoC)** profesional:

```text
MovilBus/
├── 🌐 proxy/           # Universal Proxy Server (Express)
├── ⚡ netlify/         # Serverless Functions para Cloud Deployment
├── 📄 html/            # Secciones inyectables (Modular HTML)
├── 🎨 css/             # Diseño Atómico
│   ├── base/           # Variables, Reset y Globales
│   ├── components/     # UI Reutilizable (Cards, Buttons)
│   └── layout/         # Grid y Flexbox System
├── 🧠 js/              # Motor del Sistema
│   ├── core/           # API Engine y Utilidades Críticas
│   ├── modules/        # Lógica de Mapas, Ranking y Staff
│   └── services/       # Adaptadores de Datos Externos
└── 🖼️ assets/          # Media y Recursos Estáticos
```

## ⚙️ Instalación y Despliegue

### Entorno Local
Para ejecutar el servidor proxy y la interfaz:
```bash
# Instalar dependencias
npm install

# Iniciar el Proxy Universal
npm run proxy

# Iniciar en modo desarrollo con auto-reload
npm run dev
```

### Despliegue en VPS
Este proyecto es agnóstico al hosting. Puedes subir la carpeta `proxy/` a cualquier servidor con Node.js y la web cargará los datos automáticamente detectando el entorno.

---

<div align="center">

## 👨‍💻 Engineering & Excellence

Este sistema ha sido desarrollado bajo los más altos estándares de calidad de software, priorizando la **performance**, la **seguridad de los datos** y una **experiencia de usuario excepcional**.

[![Developed By NilverTI](https://img.shields.io/badge/Developed%20By-NilverTI-orange?style=for-the-badge&logo=github)](https://github.com/NilverTI)

**"Llevando la simulación peruana al siguiente nivel tecnológico."**

</div>
