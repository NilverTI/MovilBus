const API_BASE = "https://e.truckyapp.com";

export async function handler(event) {
    const path = event.path.replace(/\/\.netlify\/functions\/trucky\/?/, '');
    
    if (!path) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Endpoint requerido" })
        };
    }

    let url;
    if (path.startsWith("cdn.truckyapp.com")) {
        url = `https://${path}`;
    } else {
        const API_BASE = "https://e.truckyapp.com";
        url = `${API_BASE}/${path}`;
    }
    
    const qs = new URLSearchParams(event.queryStringParameters).toString();
    if (qs) {
        url += (url.includes("?") ? "&" : "?") + qs;
    }

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "MovilBusPSV",
                "Accept": "application/json"
            }
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
