
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
    request: VercelRequest,
    response: VercelResponse
) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (request.method === 'OPTIONS') {
        return response.status(204).end();
    }

    const { Cedula } = request.query;
    const cedula = Array.isArray(Cedula) ? Cedula[0] : Cedula;
    const apiBaseUrl = process.env.CEDULA_API_BASE_URL;
    const apiKey = process.env.CEDULA_API_KEY;

    if (!cedula) {
        return response.status(400).json({ error: 'Falta parámetro requerido: Cedula.' });
    }

    if (!apiBaseUrl || !apiKey) {
        return response.status(500).json({
            error: 'Servicio de consulta de cédula no configurado. Configure CEDULA_API_BASE_URL y CEDULA_API_KEY.'
        });
    }

    const targetUrl = `${apiBaseUrl}?Cedula=${encodeURIComponent(cedula)}&Apikey=${encodeURIComponent(apiKey)}`;

    try {
        const apiResponse = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`Error from external API (${apiResponse.status}):`, errorText);
            return response.status(apiResponse.status).json({
                error: 'Error al consultar el servicio externo',
                details: errorText
            });
        }

        const data = await apiResponse.json();

        return response.status(200).json(data);
    } catch (error) {
        console.error('Fetch error:', error);
        return response.status(500).json({ error: 'Error interno del servidor al procesar la solicitud' });
    }
}
