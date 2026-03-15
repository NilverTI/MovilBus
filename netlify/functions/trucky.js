const API_BASE = "https://e.truckyapp.com";

export async function handler(event) {
    const path = event.path.replace(/\/\.netlify\/functions\/trucky\/?/, '');
    
    if (!path) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Endpoint requerido" })
        };
    }

    const isCdn = path.startsWith("cdn.truckyapp.com");
    let url;
    if (isCdn) {
        url = `https://${path}`;
    } else {
        url = `${API_BASE}/${path}`;
    }
    
    const qs = new URLSearchParams(event.queryStringParameters).toString();
    if (qs) {
        url += (url.includes("?") ? "&" : "?") + qs;
    }

    try {
        const fetchHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };

        if (!isCdn) {
            fetchHeaders["Accept"] = "application/json";
        } else {
            fetchHeaders["Accept"] = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";
        }

        const response = await fetch(url, {
            headers: fetchHeaders
        });

        const contentType = response.headers.get("content-type") || "application/json";
        
        if (contentType.includes("application/json")) {
            const data = await response.json();
            return {
                statusCode: response.status,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=60",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            };
        } else {
            // Manejar datos binarios (imágenes para los avatars)
            const buffer = await response.arrayBuffer();
            return {
                statusCode: response.status,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=3600",
                    "Content-Type": contentType
                },
                body: Buffer.from(buffer).toString("base64"),
                isBase64Encoded: true
            };
        }

    } catch (error) {
        return {
            statusCode: 500,
            headers: { 
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                error: "Error conectando con Trucky API proxy",
                details: error.message
            })
        };
    }
}
