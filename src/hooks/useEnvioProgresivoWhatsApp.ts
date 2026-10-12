// Cola de envío progresivo de WhatsApp para no exponer el número a un bloqueo:
// un mensaje a la vez, con espacio aleatorio entre mensajes y pausas largas por lote.
import { useCallback, useEffect, useRef, useState } from 'react';
import { enviarWhatsAppConDetalle, normalizarTelefonoWhatsApp } from '../lib/whatsappService';
import { registrarRecordatorios, type FilaRegistroRecordatorio } from '../lib/recordatoriosService';

// ⚠️ WasenderAPI exige al menos 7 s entre mensajes: INTERVALO_MIN_MS nunca debe bajar de 7000.
export const INTERVALO_MIN_MS = 7000;
export const INTERVALO_MAX_MS = 15000;
export const MENSAJES_POR_LOTE = 10;
export const PAUSA_LOTE_MIN_MS = 7 * 60 * 1000;
export const PAUSA_LOTE_MAX_MS = 9 * 60 * 1000;
export const MAX_MENSAJES_POR_DIA = 200;
const ESPERA_REINTENTO_MS = 30 * 1000;   // mínimo entre un fallo y su reintento
const ESPERA_LIMITE_DEFECTO_MS = 2 * 60 * 1000; // 429 sin "retry_after"
const MAX_INTENTOS = 2;
const MAX_ESPERAS_POR_LIMITE = 3;

const aleatorio = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/** Tiempo estimado (s) para enviar `cantidad` mensajes con el ritmo configurado. */
export function estimarSegundosEnvio(cantidad: number): number {
  if (cantidad <= 1) return cantidad <= 0 ? 0 : 5;
  const intervaloPromedio = (INTERVALO_MIN_MS + INTERVALO_MAX_MS) / 2000;
  const pausaPromedio = (PAUSA_LOTE_MIN_MS + PAUSA_LOTE_MAX_MS) / 2000;
  return Math.round((cantidad - 1) * intervaloPromedio + Math.floor((cantidad - 1) / MENSAJES_POR_LOTE) * pausaPromedio);
}

export interface ElementoColaWhatsApp {
  etiqueta: string;              // p. ej. nombre del paciente o del médico
  telefono: string | null;
  mensaje: string;
  /** Una fila de historial por cita cubierta por este mensaje (sin teléfono/mensaje/estado, que pone la cola) */
  filas: Omit<FilaRegistroRecordatorio, 'telefono' | 'mensaje' | 'estado' | 'detalle_error' | 'intentos'>[];
}

export interface ResumenEnvio {
  enviados: number;
  fallidos: number;
  cancelado: boolean;
}

type MotivoEspera = 'intervalo' | 'lote' | 'reintento' | 'limite';

export function useEnvioProgresivoWhatsApp() {
  const [enProceso, setEnProceso] = useState(false);
  const [total, setTotal] = useState(0);
  const [enviados, setEnviados] = useState(0);
  const [fallidos, setFallidos] = useState(0);
  const [actual, setActual] = useState<string | null>(null);
  const [espera, setEspera] = useState<{ hasta: number; motivo: MotivoEspera } | null>(null);
  const [ahora, setAhora] = useState(Date.now());

  const cancelarRef = useRef(false);
  const liberarEsperaRef = useRef<(() => void) | null>(null);

  // Reloj para las cuentas regresivas del panel
  useEffect(() => {
    if (!enProceso) return;
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, [enProceso]);

  // Avisar si se intenta cerrar la pestaña mientras se envía
  useEffect(() => {
    if (!enProceso) return;
    const avisar = (evento: BeforeUnloadEvent) => { evento.preventDefault(); evento.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [enProceso]);

  const esperar = (ms: number, motivo: MotivoEspera) => new Promise<void>(resolve => {
    setEspera({ hasta: Date.now() + ms, motivo });
    const temporizador = setTimeout(() => { liberarEsperaRef.current = null; setEspera(null); resolve(); }, ms);
    liberarEsperaRef.current = () => { clearTimeout(temporizador); setEspera(null); resolve(); };
  });

  const cancelar = useCallback(() => {
    cancelarRef.current = true;
    liberarEsperaRef.current?.();
  }, []);

  const iniciar = useCallback(async (elementos: ElementoColaWhatsApp[]): Promise<ResumenEnvio> => {
    cancelarRef.current = false;
    setEnProceso(true);
    setTotal(elementos.length);
    setEnviados(0);
    setFallidos(0);

    const cola = elementos.map(elemento => ({ ...elemento, intentos: 0, esperasLimite: 0, ultimoFallo: 0 }));
    let totalEnviados = 0;
    let totalFallidos = 0;
    let intentosEnLote = 0;
    let hayEnvioPrevio = false;

    const registrar = async (
      elemento: (typeof cola)[number],
      telefono: string,
      estado: 'ENVIADO' | 'FALLIDO',
      detalle: string | null,
    ) => {
      await registrarRecordatorios(elemento.filas.map(fila => ({
        ...fila,
        telefono,
        mensaje: elemento.mensaje,
        estado,
        detalle_error: detalle,
        intentos: Math.max(elemento.intentos, 1),
      })));
    };

    try {
      while (cola.length > 0 && !cancelarRef.current) {
        const elemento = cola.shift()!;
        const telefono = normalizarTelefonoWhatsApp(elemento.telefono);

        // Teléfono inválido: se registra como fallido sin enviar ni esperar (hay que corregir el dato)
        if (!telefono) {
          await registrar(elemento, elemento.telefono || 'SIN TELÉFONO', 'FALLIDO', 'Teléfono inválido o vacío');
          totalFallidos += 1;
          setFallidos(totalFallidos);
          continue;
        }

        // Espaciado entre mensajes (el primero sale de inmediato)
        if (hayEnvioPrevio) {
          if (intentosEnLote >= MENSAJES_POR_LOTE) {
            await esperar(aleatorio(PAUSA_LOTE_MIN_MS, PAUSA_LOTE_MAX_MS), 'lote');
            intentosEnLote = 0;
          } else {
            await esperar(aleatorio(INTERVALO_MIN_MS, INTERVALO_MAX_MS), 'intervalo');
          }
        }
        if (elemento.ultimoFallo && !cancelarRef.current) {
          const faltante = ESPERA_REINTENTO_MS - (Date.now() - elemento.ultimoFallo);
          if (faltante > 0) await esperar(faltante, 'reintento');
        }
        if (cancelarRef.current) break;

        setActual(elemento.etiqueta);
        const resultado = await enviarWhatsAppConDetalle(telefono, elemento.mensaje);
        elemento.intentos += 1;
        intentosEnLote += 1;
        hayEnvioPrevio = true;

        if (resultado.ok) {
          await registrar(elemento, telefono, 'ENVIADO', null);
          totalEnviados += 1;
          setEnviados(totalEnviados);
        } else if (resultado.status === 429 && elemento.esperasLimite < MAX_ESPERAS_POR_LIMITE) {
          // Límite de WasenderAPI: no cuenta como intento; esperar lo indicado y reintentar este mismo mensaje
          elemento.intentos -= 1;
          elemento.esperasLimite += 1;
          cola.unshift(elemento);
          const ms = resultado.retryAfterSegundos ? resultado.retryAfterSegundos * 1000 : ESPERA_LIMITE_DEFECTO_MS;
          await esperar(ms, 'limite');
          intentosEnLote = 0;
          hayEnvioPrevio = false; // la espera por límite ya cubre el espaciado
        } else if (elemento.intentos < MAX_INTENTOS && resultado.status !== 429) {
          // Fallo de red/servidor: reintentar una vez al final de la cola
          elemento.ultimoFallo = Date.now();
          cola.push(elemento);
        } else {
          await registrar(elemento, telefono, 'FALLIDO', resultado.error || `Error HTTP ${resultado.status}`);
          totalFallidos += 1;
          setFallidos(totalFallidos);
        }
      }
    } finally {
      setActual(null);
      setEspera(null);
      setEnProceso(false);
      liberarEsperaRef.current = null;
    }

    return { enviados: totalEnviados, fallidos: totalFallidos, cancelado: cancelarRef.current };
  }, []);

  const pendientes = Math.max(total - enviados - fallidos, 0);
  const segundosEspera = espera ? Math.max(Math.ceil((espera.hasta - ahora) / 1000), 0) : 0;

  return {
    enProceso,
    total,
    enviados,
    fallidos,
    pendientes,
    actual,
    espera: espera ? { motivo: espera.motivo, segundos: segundosEspera } : null,
    segundosRestantesEstimados: segundosEspera + estimarSegundosEnvio(pendientes),
    iniciar,
    cancelar,
  };
}
