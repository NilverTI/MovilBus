const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const TRUCKY_API = "https://e.truckyapp.com";

/**
 * MovilBus Universal Proxy - Professional Re-implementation
 */
app.all('/proxy/*', async (req, res) => {
    const rawPath = req.params[0];
    if (!rawPath) return res.status(400).json({ error: "Missing endpoint" });

    // Handle CDN vs API
    const isCdn = rawPath.includes("cdn.truckyapp.com");
    const targetUrl = isCdn ? `https://${rawPath}` : `${TRUCKY_API}/${rawPath}`;
    
    // Propagate Query Params
    const url = new URL(targetUrl);
    Object.keys(req.query).forEach(key => url.searchParams.append(key, req.query[key]));

    try {
        const fetchHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": isCdn ? "image/*" : "application/json"
        };

        const response = await fetch(url.toString(), {
            method: req.method,
            headers: fetchHeaders
        });

        const contentType = response.headers.get("content-type");
        res.setHeader("Content-Type", contentType || (isCdn ? "image/jpeg" : "application/json"));
        res.setHeader("Cache-Control", "public, max-age=3600");

        const buffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(buffer));
    } catch (error) {
        console.error(`[Error] Proxying to ${url}:`, error.message);
        res.status(500).json({ error: "Proxy connection failed", detail: error.message });
    }
});

app.get('/', (req, res) => res.json({ status: "online", service: "MovilBus Universal Proxy" }));

app.listen(PORT, () => {
    console.log(`
    ========================================
    🚀 MOVILBUS UNIVERSAL PROXY IS ACTIVE
    ========================================
    Port: ${PORT}
    Endpoint: /proxy/
    ========================================
    `);
});
