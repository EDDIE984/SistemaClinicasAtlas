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
          tipo_usuario: 'medico' | 'administrativo' | 'enfermera' | 'secretaria' | 'USUARIO_IMANGE' | 'GESTOR_IMAGEN'
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
          tipo_usuario: 'medico' | 'administrativo' | 'enfermera' | 'secretaria' | 'USUARIO_IMANGE' | 'GESTOR_IMAGEN'
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
          tipo_usuario?: 'medico' | 'administrativo' | 'enfermera' | 'secretaria' | 'USUARIO_IMANGE' | 'GESTOR_IMAGEN'
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
