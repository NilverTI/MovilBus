const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de CORS para permitir peticiones desde cualquier origen
app.use(cors());

// Middleware para parsear JSON si es necesario
app.use(express.json());

const API_BASE = "https://e.truckyapp.com";

/**
 * Proxy Universal de MovilBus
 * Maneja tanto la API de Trucky como el CDN de imágenes
 */
app.all('/proxy/*', async (req, res) => {
    // Extraer la ruta real: /proxy/api/v1/... -> api/v1/...
    const path = req.params[0];
    
    if (!path) {
        return res.status(400).json({ error: "Endpoint requerido" });
    }

    const isCdn = path.startsWith("cdn.truckyapp.com");
    let url;
    if (isCdn) {
        url = `https://${path}`;
    } else {
        url = `${API_BASE}/${path}`;
    }

    // Adjuntar query strings originales
    const queryString = new URL(req.url, `http://${req.headers.host}`).search;
    if (queryString) {
        url += queryString;
    }

    try {
        console.log(`[Proxy] Fetching: ${url}`);
        
        const fetchHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };

        if (!isCdn) {
            fetchHeaders["Accept"] = "application/json";
        } else {
            fetchHeaders["Accept"] = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";
        }

        const response = await fetch(url, {
            method: req.method,
            headers: fetchHeaders
        });

        const contentType = response.headers.get("content-type");
        res.setHeader("Content-Type", contentType || "application/octet-stream");
        res.setHeader("Cache-Control", isCdn ? "public, max-age=3600" : "public, max-age=60");

        // Stream de la respuesta directamente al cliente
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.status(response.status).send(buffer);

    } catch (error) {
        console.error(`[Proxy Error]:`, error);
        res.status(500).json({
            error: "Error conectando con el servicio de Trucky",
            details: error.message
        });
    }
});

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('MovilBus Universal Proxy is Running! 🚀');
});

app.listen(PORT, () => {
    console.log(`
    ========================================
     MOVILBUS UNIVERSAL PROXY
    ========================================
     Servidor corriendo en el puerto: ${PORT}
     Endpoint: http://localhost:${PORT}/proxy/
    ========================================
    `);
});
