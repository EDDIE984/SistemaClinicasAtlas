import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Phone, Mail, Calendar, Clock, MapPin, Stethoscope, XCircle, Minimize2, Maximize2, X, Loader2 } from 'lucide-react';
import type { CitaCompleta } from '../lib/citasService';
import { canModificarCita, canCancelarCita, canIniciarCita } from '../lib/citasService';
import { calcularEdad } from '../lib/pacientesService';
import { getConsultaMedicaByCita, type ConsultaMedica } from '../lib/consultasService';
import { getSolicitudImagenByCita, type SolicitudImagen } from '../lib/solicitudImagenService';
import { getPedidoLaboratorioByCita, type PedidoLaboratorioCompleto } from '../lib/laboratorioService';

interface DetalleCitaDialogProps {
    isOpen: boolean;
    onClose: () => void;
    cita: CitaCompleta | null;
    onIniciarConsulta: (cita: CitaCompleta) => void;
    onModificar: (cita: CitaCompleta) => void;
    onCancelar: (cita: CitaCompleta) => void;
}

export function DetalleCitaDialog({
    isOpen,
    onClose,
    cita,
    onIniciarConsulta,
    onModificar,
    onCancelar
}: DetalleCitaDialogProps) {
    const [windowState, setWindowState] = useState<'normal' | 'minimized'>('normal');
    const [isLoadingDatosClinicos, setIsLoadingDatosClinicos] = useState(false);
    const [consultaData, setConsultaData] = useState<ConsultaMedica | null>(null);
    const [solicitudImagenData, setSolicitudImagenData] = useState<SolicitudImagen | null>(null);
    const [pedidoLaboratorioData, setPedidoLaboratorioData] = useState<PedidoLaboratorioCompleto | null>(null);
    const [tabActiva, setTabActiva] = useState<'consulta' | 'laboratorio' | 'imagen'>('consulta');

    useEffect(() => {
        if (isOpen && windowState === 'minimized') {
            // Keep it minimized if it was already minimized
        } else if (!isOpen) {
            setWindowState('normal');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !cita?.id_cita) {
            setConsultaData(null);
            setSolicitudImagenData(null);
            setPedidoLaboratorioData(null);
            return;
        }

        let isMounted = true;

        const cargarDatosClinicos = async () => {
            setIsLoadingDatosClinicos(true);
            try {
                const [consulta, solicitudImagen, pedidoLaboratorio] = await Promise.all([
                    getConsultaMedicaByCita(cita.id_cita),
                    getSolicitudImagenByCita(cita.id_cita),
                    getPedidoLaboratorioByCita(cita.id_cita),
                ]);

                if (!isMounted) return;
                setConsultaData(consulta);
                setSolicitudImagenData(solicitudImagen);
                setPedidoLaboratorioData(pedidoLaboratorio);
            } finally {
                if (isMounted) {
                    setIsLoadingDatosClinicos(false);
                }
            }
        };

        cargarDatosClinicos();

        return () => {
            isMounted = false;
        };
    }, [isOpen, cita?.id_cita]);

    useEffect(() => {
        if (consultaData) {
            setTabActiva('consulta');
            return;
        }

        if (pedidoLaboratorioData) {
            setTabActiva('laboratorio');
            return;
        }

        if (solicitudImagenData) {
            setTabActiva('imagen');
        }
    }, [consultaData, pedidoLaboratorioData, solicitudImagenData]);

    if (!cita) return null;

    const esModificable = canModificarCita(cita);
    const esCancelable = canCancelarCita(cita);
    const esIniciable = canIniciarCita(cita);

    return (
        <>
            <Dialog open={isOpen && windowState !== 'minimized'} onOpenChange={onClose}>
                <DialogContent className="w-[560px] max-w-[95vw] p-4 gap-0 max-h-[90vh] overflow-y-auto">
                    <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between pb-3 border-b relative">
                            <div className="absolute left-0 top-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 hover:bg-gray-100"
                                    onClick={() => setWindowState('minimized')}
                                    title="Minimizar"
                                >
                                    <Minimize2 className="h-3 w-3 text-gray-500" />
                                </Button>
                            </div>
                            <div className="pl-8">
                                <h3 className="font-semibold text-sm">
                                    {cita.paciente.nombres} {cita.paciente.apellidos}
                                </h3>
                                <p className="text-xs text-gray-500">
                                    {cita.paciente.fecha_nacimiento && `${calcularEdad(cita.paciente.fecha_nacimiento)} años`}
                                </p>
                            </div>
                            <Badge
                                variant={cita.estado_cita === 'cancelada' ? 'destructive' : cita.consulta_realizada ? 'default' : 'secondary'}
                                className="text-xs"
                            >
                                {cita.estado_cita === 'cancelada' ? 'Cancelada' : cita.consulta_realizada ? 'Completada' : 'Programada'}
                            </Badge>
                        </div>

                        {/* Información de contacto */}
                        <div className="space-y-2 text-xs">
                            {cita.paciente.telefono && (
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Phone className="size-3" />
                                    <span>{cita.paciente.telefono}</span>
                                </div>
                            )}
                            {cita.paciente.email && (
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Mail className="size-3" />
                                    <span className="truncate">{cita.paciente.email}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-gray-600">
                                <Calendar className="size-3" />
                                <span>
                                    {new Date(cita.fecha_cita).toLocaleDateString('es-ES', {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long'
                                    })}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <Clock className="size-3" />
                                <span>{cita.hora_inicio.substring(0, 5)} - {cita.hora_fin.substring(0, 5)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <MapPin className="size-3" />
                                <span>{cita.usuario_sucursal.sucursal.nombre}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <Stethoscope className="size-3" />
                                <span>{(cita as any).especialidades?.nombre || cita.usuario_sucursal.especialidad || 'Especialidad no definida'}</span>
                            </div>
                        </div>

                        {/* Motivo de consulta */}
                        {cita.motivo_consulta && (
                            <div className="pt-2 border-t">
                                <p className="text-xs font-medium text-gray-700 mb-1">Motivo de consulta:</p>
                                <p className="text-xs text-gray-600">{cita.motivo_consulta}</p>
                            </div>
                        )}

                        {/* Datos clínicos de la consulta */}
                        <div className="pt-2 border-t space-y-2">
                            <p className="text-xs font-medium text-gray-700">Detalle clínico</p>

                            {isLoadingDatosClinicos && (
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <Loader2 className="size-3 animate-spin" />
                                    <span>Cargando datos de consulta...</span>
                                </div>
                            )}

                            {!isLoadingDatosClinicos && !consultaData && !solicitudImagenData && !pedidoLaboratorioData && (
                                <p className="text-xs text-gray-500">No hay información clínica registrada para esta cita.</p>
                            )}

                            {!isLoadingDatosClinicos && (consultaData || pedidoLaboratorioData || solicitudImagenData) && (
                                <div className="flex gap-1 bg-gray-100 p-1 rounded-md">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={tabActiva === 'consulta' ? 'secondary' : 'ghost'}
                                        className="h-7 text-[11px]"
                                        onClick={() => setTabActiva('consulta')}
                                        disabled={!consultaData}
                                    >
                                        Consulta
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={tabActiva === 'laboratorio' ? 'secondary' : 'ghost'}
                                        className="h-7 text-[11px]"
                                        onClick={() => setTabActiva('laboratorio')}
                                        disabled={!pedidoLaboratorioData}
                                    >
                                        Laboratorio
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={tabActiva === 'imagen' ? 'secondary' : 'ghost'}
                                        className="h-7 text-[11px]"
                                        onClick={() => setTabActiva('imagen')}
                                        disabled={!solicitudImagenData}
                                    >
                                        Imagen
                                    </Button>
                                </div>
                            )}

                            {tabActiva === 'consulta' && consultaData && (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold text-blue-700">Consulta médica</p>
                                    {consultaData.historial_clinico && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">Enfermedad o problema actual</p>
                                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{consultaData.historial_clinico}</p>
                                        </div>
                                    )}
                                    {consultaData.diagnostico && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">Diagnóstico</p>
                                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{consultaData.diagnostico}</p>
                                        </div>
                                    )}
                                    {consultaData.pedido_examenes && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">Examen físico</p>
                                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{consultaData.pedido_examenes}</p>
                                        </div>
                                    )}
                                    {(consultaData.receta_rp || consultaData.receta_medica) && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">RP</p>
                                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{consultaData.receta_rp || consultaData.receta_medica}</p>
                                        </div>
                                    )}
                                    {consultaData.receta_indicaciones && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">Indicaciones</p>
                                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{consultaData.receta_indicaciones}</p>
                                        </div>
                                    )}
                                    {consultaData.fecha_seguimiento && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">Fecha de seguimiento</p>
                                            <p className="text-xs text-gray-600">{consultaData.fecha_seguimiento}</p>
                                        </div>
                                    )}
                                    {consultaData.pedido_hospitalizacion && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">Pedido de hospitalización</p>
                                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{consultaData.pedido_hospitalizacion}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {tabActiva === 'laboratorio' && pedidoLaboratorioData && (
                                <div className="space-y-2 pt-1 border-t">
                                    <p className="text-[11px] font-semibold text-purple-700">Pedido de laboratorio</p>
                                    <p className="text-xs text-gray-600">N° {String(pedidoLaboratorioData.numero_pedido_laboratorio).padStart(7, '0')} · {pedidoLaboratorioData.estado}</p>
                                    {pedidoLaboratorioData.observaciones && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">Observaciones</p>
                                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{pedidoLaboratorioData.observaciones}</p>
                                        </div>
                                    )}
                                    {pedidoLaboratorioData.detalle?.length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">Exámenes solicitados</p>
                                            <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
                                                {pedidoLaboratorioData.detalle.map((detalle) => (
                                                    <li key={detalle.id_pedido_laboratorio_detalle}>
                                                        {detalle.examen_laboratorio?.nombre || `Examen #${detalle.id_examen_laboratorio}`}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {tabActiva === 'imagen' && solicitudImagenData && (
                                <div className="space-y-2 pt-1 border-t">
                                    <p className="text-[11px] font-semibold text-amber-700">Solicitud de imagen</p>
                                    <p className="text-xs text-gray-600">N° {String(solicitudImagenData.numero_solicitud_imagen).padStart(7, '0')} · {solicitudImagenData.fecha_solicitud}</p>
                                    {solicitudImagenData.procedimiento && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">Procedimiento</p>
                                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{solicitudImagenData.procedimiento}</p>
                                        </div>
                                    )}
                                    {solicitudImagenData.antecedentes_clinico_quirurgico && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">Antecedentes clínico-quirúrgico</p>
                                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{solicitudImagenData.antecedentes_clinico_quirurgico}</p>
                                        </div>
                                    )}
                                    {solicitudImagenData.cuadro_clinico && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">Cuadro clínico</p>
                                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{solicitudImagenData.cuadro_clinico}</p>
                                        </div>
                                    )}
                                    {solicitudImagenData.medicamentos && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">Medicamentos</p>
                                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{solicitudImagenData.medicamentos}</p>
                                        </div>
                                    )}
                                    {solicitudImagenData.alergias && (
                                        <div>
                                            <p className="text-[11px] font-medium text-gray-700">Alergias</p>
                                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{solicitudImagenData.alergias}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Botones de acción */}
                        {cita.estado_cita !== 'cancelada' && (
                            <div className="space-y-2 pt-3 border-t">
                                <Button
                                    size="sm"
                                    className="w-full bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                                    onClick={() => {
                                        onClose();
                                        onIniciarConsulta(cita);
                                    }}
                                    disabled={!esIniciable}
                                >
                                    <Stethoscope className="size-3 mr-1" />
                                    Iniciar consulta
                                </Button>
                                <Button
                                    size="sm"
                                    className="w-full bg-gray-600 hover:bg-gray-700 text-white h-8 text-xs"
                                    onClick={() => {
                                        onClose();
                                        onModificar(cita);
                                    }}
                                    disabled={!esModificable}
                                >
                                    <Calendar className="size-3 mr-1" />
                                    Modificar
                                </Button>
                                <Button
                                    size="sm"
                                    className="w-full bg-red-600 hover:bg-red-700 text-white h-8 text-xs"
                                    onClick={() => {
                                        onClose();
                                        onCancelar(cita);
                                    }}
                                    disabled={!esCancelable}
                                >
                                    <XCircle className="size-3 mr-1" />
                                    Cancelar
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {isOpen && windowState === 'minimized' && (
                <div
                    className="fixed bottom-4 left-4 z-[100] w-72 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-300"
                >
                    <div className="bg-blue-600 px-3 py-2 flex items-center justify-between text-white">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Stethoscope className="size-4 shrink-0" />
                            <span className="text-xs font-medium truncate">
                                Detalle: {cita.paciente.nombres} {cita.paciente.apellidos}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-white/20 text-white p-0 border-none"
                                onClick={() => setWindowState('normal')}
                                title="Restaurar"
                            >
                                <Maximize2 className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-white/20 text-white p-0 border-none"
                                onClick={onClose}
                                title="Cerrar"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
