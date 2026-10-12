import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getCitasParaRecordatorio,
  getUltimosRecordatorios,
  type CitaRecordatorio,
  type UltimosRecordatorios,
} from '../lib/recordatoriosService';

export function useRecordatorios(idSucursal: number | null, desde: string, hasta: string) {
  const [citas, setCitas] = useState<CitaRecordatorio[]>([]);
  const [ultimos, setUltimos] = useState<Map<string, UltimosRecordatorios>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const recargar = useCallback(async () => {
    if (!idSucursal || !desde || !hasta) return;
    setIsLoading(true);
    try {
      const lista = await getCitasParaRecordatorio(idSucursal, desde, hasta);
      const historial = await getUltimosRecordatorios(
        lista.filter(cita => cita.idCita).map(cita => cita.idCita as number),
        lista.filter(cita => cita.idCitaServicio).map(cita => cita.idCitaServicio as number),
      );
      setCitas(lista);
      setUltimos(historial);
    } catch {
      toast.error('No se pudieron cargar las citas para recordatorio');
    } finally {
      setIsLoading(false);
    }
  }, [idSucursal, desde, hasta]);

  useEffect(() => { void recargar(); }, [recargar]);

  return { citas, ultimos, isLoading, recargar };
}
