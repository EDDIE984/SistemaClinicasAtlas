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

  const { codigoCie10 } = req.body as { codigoCie10?: string };
  const codigo = codigoCie10?.trim().toUpperCase();

  if (!codigo) {
    return res.status(400).json({ error: 'El código CIE-10 es requerido' });
  }

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
Tu tarea es validar un código CIE-10 y devolver su descripción clínica en español.

REGLAS ESTRICTAS:
- Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin bloques markdown, sin explicaciones fuera del JSON.
- El JSON debe tener exactamente esta estructura:
{"diagnostico":{"codigo":"X00.0","nombre":"Nombre exacto CIE-10","descripcion":"Descripción clínica breve en máximo 20 palabras"}}
- Si el código no es válido o no existe, responde exactamente:
{"error":"Código CIE-10 no encontrado"}
- El campo codigo debe conservar el formato oficial CIE-10.
- Los textos deben estar en español.`
          },
          {
            role: 'user',
            content: `Código CIE-10 ingresado por el médico: ${codigo}`
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
