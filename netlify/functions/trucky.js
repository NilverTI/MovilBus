const API_BASE = "https://e.truckyapp.com";

export async function handler(event) {
    const path = event.path.replace(/\/\.netlify\/functions\/trucky\/?/, '');
    
    if (!path) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Endpoint requerido" })
        };
    }

    let url = `${API_BASE}/${path}`;
    
    const qs = new URLSearchParams(event.queryStringParameters).toString();
    if (qs) {
        url += `?${qs}`;
    }

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "MovilBusPSV",
                "Accept": "application/json"
            }
        });

        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            const textData = await response.text();
            data = { error: "Non-JSON response", details: textData };
        }

        return {
            statusCode: response.status,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=60",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        };

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
