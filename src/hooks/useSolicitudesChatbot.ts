import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { SolicitudChatbot } from '../lib/supabaseTypes';
import {
  descartarSolicitudChatbot,
  getSolicitudesChatbotPendientes,
  marcarSolicitudChatbotAtendida,
} from '../lib/solicitudesChatbotService';

export function useSolicitudesChatbot() {
  const [solicitudes, setSolicitudes] = useState<SolicitudChatbot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSolicitudes = useCallback(async () => {
    setIsLoading(true);
    try {
      setSolicitudes(await getSolicitudesChatbotPendientes());
    } catch {
      toast.error('No se pudieron cargar las solicitudes del chatbot');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadSolicitudes(); }, [loadSolicitudes]);

  const marcarAtendida = useCallback(async (id: number, ref: { id_cita?: number; id_cita_servicio?: number }) => {
    const ok = await marcarSolicitudChatbotAtendida(id, ref);
    if (ok) await loadSolicitudes();
    return ok;
  }, [loadSolicitudes]);

  const descartar = useCallback(async (id: number) => {
    const ok = await descartarSolicitudChatbot(id);
    if (ok) await loadSolicitudes();
    return ok;
  }, [loadSolicitudes]);

  return { solicitudes, isLoading, loadSolicitudes, marcarAtendida, descartar };
}
