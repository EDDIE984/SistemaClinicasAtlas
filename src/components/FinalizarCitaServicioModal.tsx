import { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { FileText, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { finalizarCitaServicio, reemplazarPdfCitaServicio } from '../lib/citaServicioService';
import type { CitaServicioCompleta } from '../lib/configuracionesService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cita: CitaServicioCompleta;
  mode: 'finalizar' | 'reemplazar';
  notasCitaAlFinalizar?: string;
}

const MAX_SIZE_MB = 10;

export function FinalizarCitaServicioModal({ isOpen, onClose, onSuccess, cita, mode, notasCitaAlFinalizar }: Props) {
  const idCompania = parseInt(localStorage.getItem('currentCompaniaId') || '0');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSeleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Solo se permiten archivos PDF');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`El archivo no puede superar ${MAX_SIZE_MB} MB`);
      e.target.value = '';
      return;
    }

    setArchivo(file);
  };

  const handleConfirmar = async () => {
    if (!archivo) return;

    setIsUploading(true);
    try {
      let result;
      if (mode === 'finalizar') {
        result = await finalizarCitaServicio(cita.id_cita_servicio, archivo, idCompania, notasCitaAlFinalizar);
      } else {
        result = await reemplazarPdfCitaServicio(
          cita.id_cita_servicio,
          cita.url_pdf_resultado!,
          archivo,
          idCompania
        );
      }

      if (result) {
        toast.success(mode === 'finalizar' ? 'Cita finalizada con PDF' : 'PDF reemplazado exitosamente');
        onSuccess();
      } else {
        toast.error('Error al procesar el PDF. Intente nuevamente.');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'STORAGE_BUCKET_NOT_FOUND') {
        toast.error('El almacenamiento de informes PDF no está configurado. Ejecuta la migración 066 en Supabase.');
      } else {
        console.error('Error al procesar el informe PDF:', error);
        toast.error('Error al procesar el PDF. Intente nuevamente.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    setArchivo(null);
    if (inputRef.current) inputRef.current.value = '';
    onClose();
  };

  const pacienteNombre = `${cita.paciente.nombres} ${cita.paciente.apellidos}`;
  const titulo = mode === 'finalizar' ? 'Finalizar cita con PDF' : 'Reemplazar PDF de resultado';
  const descripcion = mode === 'finalizar'
    ? 'Sube el PDF del resultado para marcar esta cita como finalizada.'
    : 'El PDF anterior será eliminado y reemplazado por el nuevo archivo.';

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resumen de la cita */}
          <div className="rounded-md bg-muted px-4 py-3 text-sm space-y-1">
            <div><span className="font-medium">Paciente:</span> {pacienteNombre}</div>
            <div><span className="font-medium">Servicio:</span> {cita.servicio?.descripcion ?? '—'}</div>
            <div><span className="font-medium">Fecha:</span> {cita.fecha_cita} {cita.hora_inicio}</div>
          </div>

          {/* Selector de archivo */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Archivo PDF del resultado</label>
            <div
              className="flex items-center gap-3 rounded-md border border-dashed p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                {archivo ? archivo.name : 'Haz clic para seleccionar un PDF (máx. 10 MB)'}
              </span>
              <Upload className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleSeleccionarArchivo}
            />
            {archivo && (
              <p className="text-xs text-muted-foreground">
                {(archivo.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!archivo || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              mode === 'finalizar' ? 'Confirmar y Finalizar' : 'Reemplazar PDF'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
