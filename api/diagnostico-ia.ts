import type { VercelRequest, VercelResponse } from '@vercel/node';

interface DiagnosticoSugerido {
  codigo: string;
  nombre: string;
  descripcion: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const body = req.body as { query?: string; codigoCie10?: string };
  const rawInput = (body.query || body.codigoCie10 || '').trim();

  if (!rawInput) {
    return res.status(400).json({ error: 'Ingrese un código CIE-10 o una descripción clínica' });
  }

  // Detecta si parece un código CIE-10 (ej: J30.9, A09, I10)
  const esCodigo = /^[A-Z][0-9]{2}(\.[0-9A-Z]{0,4})?$/i.test(rawInput);
  const codigo = esCodigo ? rawInput.toUpperCase() : rawInput;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Servicio de IA no configurado. Configure OPENAI_API_KEY en las variables de entorno.' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `Eres un asistente médico experto en clasificación diagnóstica CIE-10 (Clasificación Internacional de Enfermedades, 10.ª revisión).

El médico puede ingresar:
1. Un código CIE-10 directamente (ej: J30.9, A09, I10) → valida que exista y devuelve su nombre y descripción.
2. Una descripción clínica, síntoma o causa (ej: "dolor abdominal", "hipertensión", "fractura de tibia") → encuentra el código CIE-10 más apropiado y devuelve código, nombre y descripción.

REGLAS ESTRICTAS:
- Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin bloques markdown.
- Estructura exacta: {"diagnostico":{"codigo":"X00.0","nombre":"Nombre exacto CIE-10","descripcion":"Descripción clínica breve en máximo 20 palabras"}}
- Si es un código que no existe o no es válido: {"error":"Código CIE-10 no encontrado"}
- Si la descripción es demasiado vaga para determinar un código: {"error":"Descripción no específica, proporcione más detalles"}
- El campo codigo debe usar el formato oficial CIE-10 (letra + dígitos + punto decimal si aplica).
- Todos los textos en español.`
          },
          {
            role: 'user',
            content: esCodigo
              ? `Código CIE-10: ${codigo}`
              : `Descripción clínica ingresada por el médico: ${codigo}`
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error:', response.status, errText);
      return res.status(502).json({ error: 'Error al contactar el servicio de IA' });
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: 'Respuesta vacía del servicio de IA' });
    }

    let parsed: { diagnostico?: DiagnosticoSugerido; error?: string };
    try {
      // Limpiar posibles bloques markdown que el modelo pueda ignorar
      const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('JSON inválido de OpenAI:', content);
      return res.status(502).json({ error: 'El servicio de IA devolvió un formato inesperado' });
    }

    if (parsed?.error) {
      return res.status(404).json({ error: parsed.error });
    }

    if (!parsed?.diagnostico?.codigo || !parsed?.diagnostico?.nombre) {
      return res.status(502).json({ error: 'No se obtuvo una descripción válida del código CIE-10' });
    }

    return res.status(200).json({ diagnostico: parsed.diagnostico });

  } catch (error) {
    console.error('❌ Error en diagnostico-ia:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
