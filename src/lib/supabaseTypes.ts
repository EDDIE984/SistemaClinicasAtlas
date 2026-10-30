// Tipos TypeScript para Supabase
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      usuario: {
        Row: {
          id_usuario: number
          nombre: string
          apellido: string
          cedula: string
          email: string
          telefono: string | null
          password: string
          tipo_usuario: 'medico' | 'administrativo' | 'enfermera' | 'secretaria' | 'USUARIO_IMANGE' | 'USUARIO_IMAGEN' | 'GESTOR_IMAGEN' | 'GESTOR' | 'maternidad'
          fecha_ingreso: string
          estado: 'activo' | 'inactivo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id_usuario?: number
          nombre: string
          apellido: string
          cedula: string
          email: string
          telefono?: string | null
          password?: string
          tipo_usuario: 'medico' | 'administrativo' | 'enfermera' | 'secretaria' | 'USUARIO_IMANGE' | 'USUARIO_IMAGEN' | 'GESTOR_IMAGEN' | 'GESTOR' | 'maternidad'
          fecha_ingreso?: string
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_usuario?: number
          nombre?: string
          apellido?: string
          cedula?: string
          email?: string
          telefono?: string | null
          password?: string
          tipo_usuario?: 'medico' | 'administrativo' | 'enfermera' | 'secretaria' | 'USUARIO_IMANGE' | 'USUARIO_IMAGEN' | 'GESTOR_IMAGEN' | 'GESTOR' | 'maternidad'
          fecha_ingreso?: string
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
      },
      compania: {
        Row: {
          id_compania: number
          nombre: string
          direccion: string | null
          telefono: string | null
          email: string | null
          logo_url: string | null
          estado: 'activo' | 'inactivo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id_compania?: number
          nombre: string
          direccion?: string | null
          telefono?: string | null
          email?: string | null
          logo_url?: string | null
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_compania?: number
          nombre?: string
          direccion?: string | null
          telefono?: string | null
          email?: string | null
          logo_url?: string | null
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
      },
      aseguradora: {
        Row: {
          id_aseguradora: number
          nombre: string
          estado: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id_aseguradora?: number
          nombre: string
          estado?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_aseguradora?: number
          nombre?: string
          estado?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      paciente: {
        Row: {
          id_paciente: number
          id_compania: number
          cedula: string
          nombres: string
          apellidos: string
          fecha_nacimiento: string
          edad: number | null
          sexo: 'M' | 'F' | 'Otro'
          telefono: string | null
          email: string | null
          direccion: string | null
          fecha_registro: string
          estado: 'activo' | 'inactivo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id_paciente?: number
          id_compania: number
          cedula: string
          nombres: string
          apellidos: string
          fecha_nacimiento: string
          edad?: number | null
          sexo: 'M' | 'F' | 'Otro'
          telefono?: string | null
          email?: string | null
          direccion?: string | null
          fecha_registro?: string
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_paciente?: number
          id_compania?: number
          cedula?: string
          nombres?: string
          apellidos?: string
          fecha_nacimiento?: string
          edad?: number | null
          sexo?: 'M' | 'F' | 'Otro'
          telefono?: string | null
          email?: string | null
          direccion?: string | null
          fecha_registro?: string
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
      },
      historial_estado_cita: {
        Row: {
          id_historial: number
          id_cita: number
          estado_anterior: string
          estado_nuevo: string
          id_usuario_cambio: number
          observaciones: string | null
          created_at: string
        }
        Insert: {
          id_historial?: number
          id_cita: number
          estado_anterior: string
          estado_nuevo: string
          id_usuario_cambio: number
          observaciones?: string | null
          created_at?: string
        }
        Update: {
          id_historial?: number
          id_cita?: number
          estado_anterior?: string
          estado_nuevo?: string
          id_usuario_cambio?: number
          observaciones?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "historial_estado_cita_id_cita_fkey"
            columns: ["id_cita"]
            isOneToOne: false
            referencedRelation: "cita"
            referencedColumns: ["id_cita"]
          }
        ]
      },
      cita: {
        Row: {
          id_cita: number
          id_paciente: number
          id_especialidad: number
          id_usuario_sucursal: number
          id_sucursal: number
          id_consultorio: number | null
          id_aseguradora: number | null
          fecha_cita: string
          hora_inicio: string
          hora_fin: string
          duracion_minutos: number
          tipo_cita: 'consulta' | 'control' | 'emergencia' | 'primera_vez'
          motivo_consulta: string | null
          estado_cita: 'agendada' | 'confirmada' | 'en_atencion' | 'atendida' | 'cancelada' | 'no_asistio'
          precio_cita: number
          forma_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'seguro' | null
          estado_pago: 'pendiente' | 'pagado' | 'parcial'
          notas_cita: string | null
          referencia: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id_cita?: number
          id_paciente: number
          id_especialidad: number
          id_usuario_sucursal: number
          id_sucursal: number
          id_consultorio?: number | null
          id_aseguradora?: number | null
          fecha_cita: string
          hora_inicio: string
          hora_fin: string
          duracion_minutos: number
          tipo_cita: 'consulta' | 'control' | 'emergencia' | 'primera_vez'
          motivo_consulta?: string | null
          estado_cita: 'agendada' | 'confirmada' | 'en_atencion' | 'atendida' | 'cancelada' | 'no_asistio'
          precio_cita: number
          forma_pago?: 'efectivo' | 'tarjeta' | 'transferencia' | 'seguro' | null
          estado_pago: 'pendiente' | 'pagado' | 'parcial'
          notas_cita?: string | null
          referencia?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_cita?: number
          id_paciente?: number
          id_especialidad?: number
          id_usuario_sucursal?: number
          id_sucursal?: number
          id_consultorio?: number | null
          id_aseguradora?: number | null
          fecha_cita?: string
          hora_inicio?: string
          hora_fin?: string
          duracion_minutos?: number
          tipo_cita?: 'consulta' | 'control' | 'emergencia' | 'primera_vez'
          motivo_consulta?: string | null
          estado_cita?: 'agendada' | 'confirmada' | 'en_atencion' | 'atendida' | 'cancelada' | 'no_asistio'
          precio_cita?: number
          forma_pago?: 'efectivo' | 'tarjeta' | 'transferencia' | 'seguro' | null
          estado_pago?: 'pendiente' | 'pagado' | 'parcial'
          notas_cita?: string | null
          referencia?: string | null
          created_at?: string
          updated_at?: string
        }
      },
      sucursal: {
        Row: {
          id_sucursal: number
          nombre: string
          direccion: string | null
          telefono: string | null
          email: string | null
          es_principal: boolean
          estado: 'activo' | 'inactivo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id_sucursal?: number
          nombre: string
          direccion?: string | null
          telefono?: string | null
          email?: string | null
          es_principal?: boolean
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_sucursal?: number
          nombre?: string
          direccion?: string | null
          telefono?: string | null
          email?: string | null
          es_principal?: boolean
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
      },
      usuario_sucursal: {
        Row: {
          id_usuario_sucursal: number
          id_usuario: number
          id_sucursal: number
          id_servicio: number | null
          id_especialidad: number | null
          especialidad: string | null
          cargo: string | null
          estado: 'activo' | 'inactivo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id_usuario_sucursal?: number
          id_usuario: number
          id_sucursal: number
          id_servicio?: number | null
          id_especialidad: number | null
          especialidad?: string | null
          cargo?: string | null
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_usuario_sucursal?: number
          id_usuario?: number
          id_sucursal?: number
          id_servicio?: number | null
          id_especialidad?: number | null
          especialidad?: string | null
          cargo?: string | null
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
      },
      precio_usuario_sucursal: {
        Row: {
          id_precio_usuario_sucursal: number
          id_usuario_sucursal: number
          precio_consulta: number
          duracion_consulta: number
          estado: 'activo' | 'inactivo'
          created_at: string
        }
        Insert: {
          id_precio_usuario_sucursal?: number
          id_usuario_sucursal: number
          precio_consulta: number
          duracion_consulta: number
          estado?: 'activo' | 'inactivo'
          created_at?: string
        }
        Update: {
          id_precio_usuario_sucursal?: number
          id_usuario_sucursal?: number
          precio_consulta?: number
          duracion_consulta?: number
          estado?: 'activo' | 'inactivo'
          created_at?: string
        }
      },
      signo_vital: {
        Row: {
          id_signo_vital: number
          id_paciente: number
          fecha_registro: string
          estatura_cm: number | null
          peso_kg: number | null
          imc: number | null
          perimetro_cefalico_cm: number | null
          temperatura_c: number | null
          frecuencia_respiratoria: number | null
          frecuencia_cardiaca: number | null
          presion_sistolica: number | null
          presion_diastolica: number | null
          saturacion_oxigeno: number | null
          glucosa_mg_dl: number | null
          glasgow_ocular: number | null
          glasgow_verbal: number | null
          glasgow_motora: number | null
          reaccion_pupilar: string | null
          tiempo_llenado_capilar_seg: number | null
          notas: string | null
          created_at: string
        }
        Insert: {
          id_signo_vital?: number
          id_paciente: number
          fecha_registro: string
          estatura_cm?: number | null
          peso_kg?: number | null
          imc?: number | null
          perimetro_cefalico_cm?: number | null
          temperatura_c?: number | null
          frecuencia_respiratoria?: number | null
          frecuencia_cardiaca?: number | null
          presion_sistolica?: number | null
          presion_diastolica?: number | null
          saturacion_oxigeno?: number | null
          glucosa_mg_dl?: number | null
          glasgow_ocular?: number | null
          glasgow_verbal?: number | null
          glasgow_motora?: number | null
          reaccion_pupilar?: string | null
          tiempo_llenado_capilar_seg?: number | null
          notas?: string | null
          created_at?: string
        }
        Update: {
          id_signo_vital?: number
          id_paciente?: number
          fecha_registro?: string
          estatura_cm?: number | null
          peso_kg?: number | null
          imc?: number | null
          perimetro_cefalico_cm?: number | null
          temperatura_c?: number | null
          frecuencia_respiratoria?: number | null
          frecuencia_cardiaca?: number | null
          presion_sistolica?: number | null
          presion_diastolica?: number | null
          saturacion_oxigeno?: number | null
          glucosa_mg_dl?: number | null
          glasgow_ocular?: number | null
          glasgow_verbal?: number | null
          glasgow_motora?: number | null
          reaccion_pupilar?: string | null
          tiempo_llenado_capilar_seg?: number | null
          notas?: string | null
          created_at?: string
        }
      },
      alerta_signo_vital: {
        Row: {
          id_alerta: number
          id_signo_vital: number
          campo: string
          valor: number | null
          rango_min: number | null
          rango_max: number | null
          nivel: 'advertencia' | 'critico'
          descripcion: string | null
          created_at: string
        }
        Insert: {
          id_alerta?: number
          id_signo_vital: number
          campo: string
          valor?: number | null
          rango_min?: number | null
          rango_max?: number | null
          nivel: 'advertencia' | 'critico'
          descripcion?: string | null
          created_at?: string
        }
        Update: {
          id_alerta?: number
          id_signo_vital?: number
          campo?: string
          valor?: number | null
          rango_min?: number | null
          rango_max?: number | null
          nivel?: 'advertencia' | 'critico'
          descripcion?: string | null
          created_at?: string
        }
      },
      archivo_medico: {
        Row: {
          id_archivo: number
          id_paciente: number
          nombre_archivo: string
          descripcion: string | null
          tipo_archivo: string
          url_archivo: string | null
          fecha_carga: string
          created_at: string
        }
        Insert: {
          id_archivo?: number
          id_paciente: number
          nombre_archivo: string
          descripcion?: string | null
          tipo_archivo: string
          url_archivo?: string | null
          fecha_carga: string
          created_at?: string
        }
        Update: {
          id_archivo?: number
          id_paciente?: number
          nombre_archivo?: string
          descripcion?: string | null
          tipo_archivo?: string
          url_archivo?: string | null
          fecha_carga?: string
          created_at?: string
        }
      },
      especialidad: {
        Row: {
          id_especialidad: number
          nombre: string
          descripcion: string | null
          estado: 'activo' | 'inactivo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id_especialidad?: number
          nombre: string
          descripcion?: string | null
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_especialidad?: number
          nombre?: string
          descripcion?: string | null
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
      },
      consultorio: {
        Row: {
          id_consultorio: number
          id_sucursal: number
          nombre: string
          piso: string | null
          numero: string | null
          capacidad: number | null
          equipamiento: string | null
          estado: 'activo' | 'inactivo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id_consultorio?: number
          id_sucursal: number
          nombre: string
          piso?: string | null
          numero?: string | null
          capacidad?: number | null
          equipamiento?: string | null
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_consultorio?: number
          id_sucursal?: number
          nombre?: string
          piso?: string | null
          numero?: string | null
          capacidad?: number | null
          equipamiento?: string | null
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
      },
      servicio: {
        Row: {
          id_servicio: number
          id_sucursal: number
          descripcion: string
          area: string
          estado: 'activo' | 'inactivo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id_servicio?: number
          id_sucursal: number
          descripcion: string
          area: string
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_servicio?: number
          id_sucursal?: number
          descripcion?: string
          area?: string
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
      },
      precio_base_especialidad: {
        Row: {
          id_precio_base: number
          id_compania: number
          cargo: string
          precio_consulta: number
          precio_control: number
          precio_emergencia: number
          estado: 'activo' | 'inactivo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id_precio_base?: number
          id_compania: number
          cargo: string
          precio_consulta: number
          precio_control: number
          precio_emergencia: number
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_precio_base?: number
          id_compania?: number
          cargo?: string
          precio_consulta?: number
          precio_control?: number
          precio_emergencia?: number
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
      },
      asignacion_consultorio: {
        Row: {
          id_asignacion: number
          id_usuario_sucursal: number
          id_consultorio: number
          dia_semana: number
          hora_inicio: string
          hora_fin: string
          duracion_consulta: number
          estado: 'activo' | 'inactivo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id_asignacion?: number
          id_usuario_sucursal: number
          id_consultorio: number
          dia_semana: number
          hora_inicio: string
          hora_fin: string
          duracion_consulta: number
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_asignacion?: number
          id_usuario_sucursal?: number
          id_consultorio?: number
          dia_semana?: number
          hora_inicio?: string
          hora_fin?: string
          duracion_consulta?: number
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
      }
      planificacion_horario_suplente: {
        Row: {
          id_planificacion: number
          id_usuario_sucursal: number
          id_consultorio: number
          fecha_inicio: string
          fecha_fin: string
          dia_semana: number
          hora_inicio: string
          hora_fin: string
          duracion_consulta: number
          estado: 'activo' | 'inactivo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id_planificacion?: number
          id_usuario_sucursal: number
          id_consultorio: number
          fecha_inicio: string
          fecha_fin: string
          dia_semana: number
          hora_inicio: string
          hora_fin: string
          duracion_consulta?: number
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_planificacion?: number
          id_usuario_sucursal?: number
          id_consultorio?: number
          fecha_inicio?: string
          fecha_fin?: string
          dia_semana?: number
          hora_inicio?: string
          hora_fin?: string
          duracion_consulta?: number
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
      }
      examen_laboratorio: {
        Row: {
          id_examen_laboratorio: number
          categoria: string
          nombre: string
          descripcion: string | null
          estado: 'activo' | 'inactivo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id_examen_laboratorio?: number
          categoria: string
          nombre: string
          descripcion?: string | null
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_examen_laboratorio?: number
          categoria?: string
          nombre?: string
          descripcion?: string | null
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
      }
      pedido_laboratorio: {
        Row: {
          id_pedido_laboratorio: number
          numero_pedido_laboratorio: number
          id_cita: number
          id_paciente: number
          id_sucursal: number
          id_usuario_solicitante: number
          id_usuario_sucursal_medico: number
          fecha_pedido: string
          estado: 'pendiente' | 'procesado' | 'cancelado'
          observaciones: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id_pedido_laboratorio?: number
          numero_pedido_laboratorio?: number
          id_cita: number
          id_paciente: number
          id_sucursal: number
          id_usuario_solicitante: number
          id_usuario_sucursal_medico: number
          fecha_pedido?: string
          estado?: 'pendiente' | 'procesado' | 'cancelado'
          observaciones?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_pedido_laboratorio?: number
          numero_pedido_laboratorio?: number
          id_cita?: number
          id_paciente?: number
          id_sucursal?: number
          id_usuario_solicitante?: number
          id_usuario_sucursal_medico?: number
          fecha_pedido?: string
          estado?: 'pendiente' | 'procesado' | 'cancelado'
          observaciones?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      pedido_laboratorio_detalle: {
        Row: {
          id_pedido_laboratorio_detalle: number
          id_pedido_laboratorio: number
          id_examen_laboratorio: number
          created_at: string
        }
        Insert: {
          id_pedido_laboratorio_detalle?: number
          id_pedido_laboratorio: number
          id_examen_laboratorio: number
          created_at?: string
        }
        Update: {
          id_pedido_laboratorio_detalle?: number
          id_pedido_laboratorio?: number
          id_examen_laboratorio?: number
          created_at?: string
        }
      }
      solicitud_imagen: {
        Row: {
          id_solicitud_imagen: number
          numero_solicitud_imagen: number
          id_cita: number
          id_paciente: number
          id_sucursal: number
          id_usuario_solicitante: number
          fecha_solicitud: string
          nombre_paciente: string
          edad_paciente: number | null
          procedimiento: string | null
          antecedentes_clinico_quirurgico: string | null
          cuadro_clinico: string | null
          medicamentos: string | null
          alergias: string | null
          firma: string | null
          sello: string | null
          estado: 'activa' | 'anulada'
          created_at: string
          updated_at: string
        }
        Insert: {
          id_solicitud_imagen?: number
          numero_solicitud_imagen?: number
          id_cita: number
          id_paciente: number
          id_sucursal: number
          id_usuario_solicitante: number
          fecha_solicitud?: string
          nombre_paciente: string
          edad_paciente?: number | null
          procedimiento?: string | null
          antecedentes_clinico_quirurgico?: string | null
          cuadro_clinico?: string | null
          medicamentos?: string | null
          alergias?: string | null
          firma?: string | null
          sello?: string | null
          estado?: 'activa' | 'anulada'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_solicitud_imagen?: number
          numero_solicitud_imagen?: number
          id_cita?: number
          id_paciente?: number
          id_sucursal?: number
          id_usuario_solicitante?: number
          fecha_solicitud?: string
          nombre_paciente?: string
          edad_paciente?: number | null
          procedimiento?: string | null
          antecedentes_clinico_quirurgico?: string | null
          cuadro_clinico?: string | null
          medicamentos?: string | null
          alergias?: string | null
          firma?: string | null
          sello?: string | null
          estado?: 'activa' | 'anulada'
          created_at?: string
          updated_at?: string
        }
      }
      interconsulta: {
        Row: {
          id_interconsulta: number
          numero_interconsulta: number
          id_consulta_medica: number | null
          id_paciente: number | null
          id_usuario_solicitante: number | null
          tipo_destino: 'interno' | 'externo'
          id_usuario_destino: number | null
          id_especialidad_destino: number | null
          especialidad_destino_texto: string | null
          medico_destino_externo: string | null
          motivo: string
          resumen_clinico: string | null
          urgencia: 'normal' | 'urgente'
          fecha_limite: string | null
          estado: 'ATENDIDO' | 'PENDIENTE_AGENDAR' | 'AGENDADA' | 'RECHAZADA'
          id_cita_generada: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id_interconsulta?: number
          numero_interconsulta?: number
          id_consulta_medica?: number | null
          id_paciente?: number | null
          id_usuario_solicitante?: number | null
          tipo_destino: 'interno' | 'externo'
          id_usuario_destino?: number | null
          id_especialidad_destino?: number | null
          especialidad_destino_texto?: string | null
          medico_destino_externo?: string | null
          motivo: string
          resumen_clinico?: string | null
          urgencia?: 'normal' | 'urgente'
          fecha_limite?: string | null
          estado?: 'ATENDIDO' | 'PENDIENTE_AGENDAR' | 'AGENDADA' | 'RECHAZADA'
          id_cita_generada?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id_interconsulta?: number
          numero_interconsulta?: number
          id_consulta_medica?: number | null
          id_paciente?: number | null
          id_usuario_solicitante?: number | null
          tipo_destino?: 'interno' | 'externo'
          id_usuario_destino?: number | null
          id_especialidad_destino?: number | null
          especialidad_destino_texto?: string | null
          medico_destino_externo?: string | null
          motivo?: string
          resumen_clinico?: string | null
          urgencia?: 'normal' | 'urgente'
          fecha_limite?: string | null
          estado?: 'ATENDIDO' | 'PENDIENTE_AGENDAR' | 'AGENDADA' | 'RECHAZADA'
          id_cita_generada?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      // Agregar otras tablas según necesites
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export interface Interconsulta {
  id_interconsulta: number
  numero_interconsulta: number
  id_consulta_medica: number | null
  id_paciente: number | null
  id_usuario_solicitante: number | null
  tipo_destino: 'interno' | 'externo'
  id_usuario_destino: number | null
  id_especialidad_destino: number | null
  especialidad_destino_texto: string | null
  medico_destino_externo: string | null
  motivo: string
  resumen_clinico: string | null
  urgencia: 'normal' | 'urgente'
  fecha_limite: string | null
  estado: 'ATENDIDO' | 'PENDIENTE_AGENDAR' | 'AGENDADA' | 'RECHAZADA'
  id_cita_generada: number | null
  observaciones_gestor?: string | null
  created_at: string
  updated_at: string
}

export interface InterconsultaCompleta extends Interconsulta {
  paciente?: {
    id_paciente: number
    nombres?: string
    apellidos?: string
    nombre?: string
    apellido?: string
    cedula: string
    telefono?: string | null
  }
  usuario_solicitante?: {
    id_usuario: number
    nombre: string
    apellido: string
    tipo_usuario: string
  }
  usuario_destino?: {
    id_usuario: number
    nombre: string
    apellido: string
    tipo_usuario: string
    telefono?: string | null
  } | null
  especialidad?: {
    id_especialidad: number
    nombre: string
  } | null
}

// Tablas del chatbot externo. Se mantienen fuera de Database porque su esquema
// es administrado por la integración de WhatsApp y no por las migraciones base.
export interface ConversationDetail {
  id: string;
  remotejid: string | null;
  telefono: string | null;
  area: string | null;
  humano: string | null;
  chatbot: string | null;
  created_at: string;
  id_conversacion: number | null;
  mensajeAgente: string | null;
}

export type TipoSolicitudChatbot = 'servicio' | 'consulta_externa' | 'desconocido';

export interface DatosSolicitudChatbot {
  tipo: TipoSolicitudChatbot;
  pacienteNombre: string | null;
  cedula: string | null;
  telefono: string | null;
  correo: string | null;
  fecha: string | null;
  hora: string | null;
  servicio: string | null;
  especialidad: string | null;
  seguro: 'SI' | 'NO' | null;      // texto de "Seguro:" normalizado
  fechaTexto: string | null;
  horaTexto: string | null;
}

export interface SolicitudChatbot {
  id_conversacion: number;
  fecha_conversacion: string;
  remote_jid: string | null;
  id_detalle: string;
  fecha_mensaje: string;
  mensajeAgente: string;
  datos: DatosSolicitudChatbot;
}

// Historial de recordatorios de cita por WhatsApp (071_recordatorio_whatsapp.sql)
export interface RecordatorioWhatsApp {
  id_recordatorio: number;
  tipo_destinatario: 'PACIENTE' | 'MEDICO';
  tipo_cita: 'CONSULTA_EXTERNA' | 'SERVICIO';
  id_cita: number | null;
  id_cita_servicio: number | null;
  id_usuario_sucursal: number | null;
  fecha_cita: string;
  telefono: string;
  mensaje: string;
  estado: 'ENVIADO' | 'FALLIDO';
  detalle_error: string | null;
  intentos: number;
  id_usuario_envio: number | null;
  fecha_envio: string;
}

// ========================================
// Módulo Maternidad (072_maternidad.sql)
// ========================================

export type EstadoSolicitudMaternidad = 'solo_cotizacion' | 'agendada' | 'confirmada' | 'asistio' | 'no_asistio' | 'cancelada';

// Presupuesto por aseguradora (config_cotizacion.presupuesto). Misma estructura que
// ConfigPresupuestoMaternidad en api/_lib/presupuestoMembretado.ts, que arma el PDF.
export interface ProcedimientoPresupuestoMaternidad {
  procedimiento: string;
  internacion: string;
  clinica: number;
  incluye: string[];
  /** valor null = "A CONVENIR" (no suma al total) */
  honorarios: { concepto: string; valor: number | null }[];
  notas: string[];
  abono: number | null;
}

export interface ConfigPresupuestoMaternidad {
  procedimientos: ProcedimientoPresupuestoMaternidad[];
  /** concepto con salto de línea = varias líneas con un solo valor; grupo = subtítulo previo */
  adicionales: { concepto: string; valor: number; grupo?: string | null }[];
  firma: { nombre: string; cargo: string; telefono: string };
  especialidad?: string;
}

export interface ConfigCotizacionMaternidad {
  presupuesto?: ConfigPresupuestoMaternidad;
  [clave: string]: unknown;
}

export interface MaternidadAseguradora {
  id_aseguradora_mat: number;
  nombre: string;
  orden: number;
  config_cotizacion: ConfigCotizacionMaternidad | null;
  estado: 'activo' | 'inactivo';
  created_at: string;
  updated_at: string;
}

export interface MaternidadHorario {
  id_horario_mat: number;
  dia_semana: number; // 1=Lunes … 7=Domingo
  hora_inicio: string;
  hora_fin: string;
  cupo: number;
  estado: 'activo' | 'inactivo';
  created_at: string;
  updated_at: string;
}

// Fila de vista_maternidad_horarios_disponibles
export interface MaternidadHorarioDisponible {
  id_horario_mat: number;
  fecha: string;
  fecha_formato: string;
  dia_semana: number;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  horario: string;
  cupo: number;
  reservados: number;
  disponibles: number;
}

export interface MaternidadSolicitud {
  id_solicitud_mat: number;
  nombre_madre: string;
  cedula: string;
  semanas_gestacion: number | null;
  correo: string;
  telefono: string;
  medico_ginecologo: string | null;
  id_aseguradora_mat: number | null;
  id_horario_mat: number | null;
  fecha_tour: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  fecha_agendamiento_tour: string | null;
  estado: EstadoSolicitudMaternidad;
  origen: 'CHATBOT' | 'SISTEMA';
  remote_jid: string | null;
  notas: string | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
}

// Fila de vista_maternidad_solicitudes
export interface MaternidadSolicitudVista extends MaternidadSolicitud {
  aseguradora: string | null;
  fecha_tour_formato: string | null;
  dia_nombre: string | null;
  horario: string | null;
  ultimo_correo_estado: 'enviado' | 'error' | null;
  ultimo_correo_fecha: string | null;
  correos_enviados: number;
  correos_error: number;
  ultima_cotizacion: string | null;
  ultima_cotizacion_fecha: string | null;
  cotizaciones_emitidas: number;
}

// Cotización numerada (076_maternidad_cotizacion_numerada.sql)
export interface MaternidadCotizacion {
  id_cotizacion_mat: number;
  numero_cotizacion: string;
  id_solicitud_mat: number;
  id_aseguradora_mat: number | null;
  aseguradora: string | null;
  tipo: 'cotizacion' | 'confirmacion_tour';
  valores: ConfigPresupuestoMaternidad | null;
  resumen: { procedimiento: string; total: number }[];
  archivos: MaternidadAdjuntoCorreo[];
  estado: 'generada' | 'enviada' | 'error';
  fecha_emision: string;
  fecha_envio: string | null;
  veces_enviada: number;
  generado_por: string | null;
}

export interface MaternidadAdjuntoCorreo {
  tipo: 'presupuesto' | 'checklist' | 'boletin';
  nombre: string;
  path: string;
}

export interface MaternidadEnvioCorreo {
  id_envio_mat: number;
  id_solicitud_mat: number;
  id_cotizacion_mat: number | null;
  tipo: 'cotizacion' | 'confirmacion_tour';
  destinatario: string;
  asunto: string | null;
  adjuntos: MaternidadAdjuntoCorreo[];
  estado: 'enviado' | 'error';
  message_id: string | null;
  error_mensaje: string | null;
  enviado_por: string;
  created_at: string;
}
