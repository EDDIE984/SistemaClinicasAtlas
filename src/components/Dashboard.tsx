import { useEffect, useState } from 'react';
import {
  Calendar,
  Users,
  Briefcase,
  FileText,
  Bot,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
  MapPin,
  User,
  MessageSquare,
  BarChart3,
  CalendarDays,
  ArrowLeftRight,
  Stethoscope,
  LayoutDashboard,
  UserCog,
  ScanLine,
  BellRing,
  CalendarCheck,
  type LucideIcon,
} from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from './ui/select';
import { ChatBotView } from './ChatBotView';
import { ChatBotViewSupabase } from './ChatBotViewSupabase';
import { InterconsultasView } from './InterconsultasView';
import { ConfiguracionesViewSupabase } from './ConfiguracionesViewSupabase';
import { AgendaViewSupabase } from './AgendaViewSupabase';
import { PacientesViewSupabase } from './PacientesViewSupabase';
import { CargosViewSupabase } from './CargosViewSupabase';
import { ReportesViewSupabase } from './ReportesViewSupabase';
import CitasDashboardSupabase from './CitasDashboardSupabase';
import PlanificacionHorarioView from './PlanificacionHorarioView';
import { ChatAI } from './ChatAI';
import { AgendaServiciosView } from './AgendaServiciosView';
import { DashboardServiciosView } from './DashboardServiciosView';
import { GestionMedicosView } from './GestionMedicosView';
import { SolicitudesChatbotView } from './SolicitudesChatbotView';
import { RecordatoriosPacientesView } from './RecordatoriosPacientesView';
import { getSolicitudesChatbotPendientes } from '../lib/solicitudesChatbotService';
// import logoClinica from "figma:asset/535c4fa3c95ae864b14ba302621119ba18d73bbc.png";
const logoClinica = 'https://clinicas-atlas.com/wp-content/uploads/2024/11/clinicas-atlas-ecuador.png';

interface DashboardProps {
  onLogout: () => void;
  currentUser: {
    name: string;
    email: string;
    compania?: string;
    id_sucursal?: number;
    sucursal?: string;
    id_servicio?: number;
    especialidad?: string;
    servicio?: string;
    servicio_area?: string;
    tipo_usuario?: string;
  } | null;
}

type MenuItem = 'pacientes' | 'agenda' | 'agenda-servicios' | 'dashboard-servicios' | 'citas' | 'cargos' | 'reportes' | 'chatbot' | 'chatbot-solicitudes' | 'recordatorios' | 'configuraciones' | 'planificacion' | 'interconsultas' | 'medicos-horarios';

// Navegación del GESTOR en dos niveles: módulo (padre) → pantallas (hijos)
type ModuloGestor = 'consulta' | 'servicios' | 'chatbot' | 'recordatorios';

const MODULOS_GESTOR: {
  id: ModuloGestor;
  label: string;
  icon: LucideIcon;
  color: string;
  colorFondo: string;
  hijos: MenuItem[];
  /** Texto de la fila inferior cuando el módulo no tiene subpestañas */
  descripcion?: string;
}[] = [
  { id: 'consulta', label: 'Consulta Externa', icon: Stethoscope, color: '#2563eb', colorFondo: '#eff6ff', hijos: ['agenda', 'interconsultas', 'medicos-horarios'] },
  { id: 'servicios', label: 'Servicios', icon: ScanLine, color: '#9333ea', colorFondo: '#faf5ff', hijos: ['agenda-servicios', 'dashboard-servicios'] },
  { id: 'chatbot', label: 'Chat Bot', icon: MessageSquare, color: '#16a34a', colorFondo: '#f0fdf4', hijos: ['chatbot-solicitudes'], descripcion: 'Solicitudes de cita recibidas por WhatsApp' },
  { id: 'recordatorios', label: 'Recordatorios', icon: BellRing, color: '#ea580c', colorFondo: '#fff7ed', hijos: ['recordatorios'], descripcion: 'Recordatorios de citas por WhatsApp a pacientes y médicos' },
];

// En el submenú de Servicios, "Agenda Servicios" usa otro ícono para no repetir el del módulo Consulta Externa
const ICONOS_HIJO_GESTOR: Partial<Record<MenuItem, LucideIcon>> = {
  'agenda-servicios': CalendarCheck,
};

const normalizarTexto = (valor?: string | null) => (valor ?? '').trim().toUpperCase();
const esRolImagen = (tipoUsuario?: string | null) =>
  tipoUsuario === 'USUARIO_IMAGEN' || tipoUsuario === 'USUARIO_IMANGE';

export function Dashboard({ onLogout, currentUser }: DashboardProps) {
  const servicioArea = normalizarTexto(currentUser?.servicio_area);
  const servicioDescripcion = normalizarTexto(currentUser?.servicio);
  const esUsuarioServicio =
    (esRolImagen(currentUser?.tipo_usuario) || !!currentUser?.id_servicio) &&
    servicioArea !== 'CONSULTA_EXTERNA' &&
    servicioDescripcion !== 'CONSULTA EXTERNA';

  const [activeItem, setActiveItem] = useState<MenuItem>(
    esUsuarioServicio ? 'agenda'
    : currentUser?.tipo_usuario === 'medico' ? 'pacientes'
    : currentUser?.tipo_usuario === 'GESTOR_IMAGEN' ? 'dashboard-servicios'
    : currentUser?.tipo_usuario === 'GESTOR' ? 'agenda'
    : 'agenda'
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Collapsed por defecto
  const [isHovering, setIsHovering] = useState(false); // Estado para hover

  // Estados para navegación entre vistas con parámetros
  const [pacienteIdSeleccionado, setPacienteIdSeleccionado] = useState<string | null>(null);
  const [citaIdSeleccionada, setCitaIdSeleccionada] = useState<number | null>(null);

  const allMenuItems = [
    { id: 'agenda' as MenuItem, label: 'Agenda', icon: Calendar },
    { id: 'dashboard-servicios' as MenuItem, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'agenda-servicios' as MenuItem, label: 'Agenda Servicios', icon: Stethoscope },
    { id: 'citas' as MenuItem, label: 'Citas', icon: BarChart3 },
    { id: 'pacientes' as MenuItem, label: 'Pacientes', icon: Users },
    { id: 'cargos' as MenuItem, label: 'Cobros', icon: Briefcase },
    { id: 'reportes' as MenuItem, label: 'Reportes', icon: FileText },
    { id: 'planificacion' as MenuItem, label: 'Planificación', icon: CalendarDays },
    { id: 'interconsultas' as MenuItem, label: 'Interconsultas', icon: ArrowLeftRight },
    { id: 'medicos-horarios' as MenuItem, label: 'Médicos y Horarios', icon: UserCog },
    { id: 'chatbot-solicitudes' as MenuItem, label: 'Chat Bot', icon: MessageSquare },
    { id: 'recordatorios' as MenuItem, label: 'Recordatorio Pacientes', icon: BellRing },
    { id: 'chatbot' as MenuItem, label: 'Chatbot', icon: Bot },
    { id: 'configuraciones' as MenuItem, label: 'Configuraciones', icon: Settings },
  ];

  // Filtrar items del menú según el tipo de usuario
  const menuItems = allMenuItems.filter(item => {
    // Usuario de servicio: solo puede ver su agenda confirmada.
    if (esUsuarioServicio) {
      return item.id === 'agenda';
    }
    // GESTOR_IMAGEN: Dashboard y Agenda Servicios
    if (currentUser?.tipo_usuario === 'GESTOR_IMAGEN') {
      return item.id === 'dashboard-servicios' || item.id === 'agenda-servicios';
    }
    // GESTOR: gestiona consulta externa (nivel secretaria) y servicios (nivel GESTOR_IMAGEN)
    // para la misma sucursal, en un solo menú.
    if (currentUser?.tipo_usuario === 'GESTOR') {
      return item.id === 'agenda'
        || item.id === 'interconsultas' || item.id === 'dashboard-servicios' || item.id === 'agenda-servicios'
        || item.id === 'medicos-horarios' || item.id === 'chatbot-solicitudes' || item.id === 'recordatorios';
    }
    // Si es secretaria: Agenda, Citas, Planificación e Interconsultas
    if (currentUser?.tipo_usuario === 'secretaria') {
      return item.id === 'agenda' || item.id === 'citas' || item.id === 'planificacion' || item.id === 'interconsultas';
    }
    // Si es administrativo, puede ver todo
    if (currentUser?.tipo_usuario === 'administrativo') {
      return true;
    }
    // Si es médico: Pacientes e Interconsultas
    if (currentUser?.tipo_usuario === 'medico') {
      return item.id === 'pacientes' || item.id === 'interconsultas';
    }
    // Si es enfermera: Agenda, Pacientes, Citas e Interconsultas
    if (currentUser?.tipo_usuario === 'enfermera') {
      return item.id === 'agenda' || item.id === 'pacientes' || item.id === 'citas' || item.id === 'interconsultas';
    }
    // Los demás usuarios (médicos, enfermeras) no pueden ver Configuraciones ni ChatBot
    return item.id !== 'configuraciones' && item.id !== 'chatbot' && item.id !== 'planificacion';
  });

  const esGestor = currentUser?.tipo_usuario === 'GESTOR';
  const moduloGestorActivo = MODULOS_GESTOR.find(modulo => modulo.hijos.includes(activeItem)) || MODULOS_GESTOR[0];
  const [pendientesChatbot, setPendientesChatbot] = useState(0);

  // Contador de solicitudes pendientes del chatbot (se refresca al navegar y cada 60 s)
  useEffect(() => {
    if (!esGestor) return;
    let cancelado = false;
    const cargarPendientes = async () => {
      try {
        const solicitudes = await getSolicitudesChatbotPendientes();
        if (!cancelado) setPendientesChatbot(solicitudes.length);
      } catch (error) {
        console.error('❌ Error al contar solicitudes pendientes del chatbot:', error);
      }
    };
    cargarPendientes();
    const intervalo = setInterval(cargarPendientes, 60000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [esGestor, activeItem]);

  // Función para manejar navegación desde Agenda a Pacientes con consulta
  const handleIniciarConsultaDesdeAgenda = (pacienteId: string, citaId: number) => {
    if (currentUser?.tipo_usuario === 'secretaria' || currentUser?.tipo_usuario === 'GESTOR') {
      return;
    }

    setPacienteIdSeleccionado(pacienteId);
    setCitaIdSeleccionada(citaId);
    setActiveItem('pacientes');
  };

  // Limpiar estados cuando se cambia de vista manualmente
  const handleMenuItemClick = (itemId: MenuItem) => {
    if (itemId !== 'pacientes') {
      setPacienteIdSeleccionado(null);
      setCitaIdSeleccionada(null);
    }
    setActiveItem(itemId);
  };

  // Al entrar a un módulo siempre se abre su primera pantalla (Consulta Externa → Agenda, Servicios → Agenda Servicios)
  const handleModuloGestorClick = (moduloId: ModuloGestor) => {
    const modulo = MODULOS_GESTOR.find(item => item.id === moduloId);
    if (modulo && !modulo.hijos.includes(activeItem)) handleMenuItemClick(modulo.hijos[0]);
  };

  const renderContent = () => {
    switch (activeItem) {
      case 'agenda':
        if (esUsuarioServicio) {
          return <AgendaServiciosView currentUser={currentUser} modoUsuarioServicio />;
        }
        return <AgendaViewSupabase currentUser={currentUser} onIniciarConsulta={handleIniciarConsultaDesdeAgenda} />;
      case 'dashboard-servicios':
        return <DashboardServiciosView currentUser={currentUser} />;
      case 'agenda-servicios':
        return <AgendaServiciosView currentUser={currentUser} />;
      case 'pacientes':
        return (
          <PacientesViewSupabase
            currentUser={currentUser}
            pacienteIdInicial={pacienteIdSeleccionado}
            citaIdInicial={citaIdSeleccionada}
            onConsultaCompletada={() => {
              setPacienteIdSeleccionado(null);
              setCitaIdSeleccionada(null);
            }}
          />
        );
      case 'citas':
        return <CitasDashboardSupabase currentUser={currentUser} />;
      case 'cargos':
        return <CargosViewSupabase />;
      case 'reportes':
        return <ReportesViewSupabase />;
      case 'chatbot':
        return <ChatBotViewSupabase currentUser={currentUser} />;
      case 'planificacion':
        return <PlanificacionHorarioView />;
      case 'interconsultas':
        return <InterconsultasView currentUser={currentUser} />;
      case 'medicos-horarios':
        return <GestionMedicosView currentUser={currentUser} onTerminar={() => handleMenuItemClick('agenda')} />;
      case 'recordatorios':
        return <RecordatoriosPacientesView currentUser={currentUser} />;
      case 'chatbot-solicitudes':
        return <SolicitudesChatbotView currentUser={currentUser} />;
      case 'configuraciones':
        return <ConfiguracionesViewSupabase />;
      default:
        return null;
    }
  };

  if (esGestor) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header con navegación por pestañas */}
        <header className="bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-3">
            <img src={logoClinica} alt="Clínicas ATLAS" className="h-9 object-contain" />

            <div className="flex items-center gap-4">
              {currentUser && (
                <div className="hidden md:flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  <div className="flex flex-col items-end">
                    <span className="text-sm text-gray-800">{currentUser.name}</span>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {currentUser.compania && (
                        <>
                          <Building2 className="size-3" />
                          <span>{currentUser.compania}</span>
                        </>
                      )}
                      {currentUser.sucursal && (
                        <>
                          <span>•</span>
                          <MapPin className="size-3" />
                          <span>{currentUser.sucursal}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="bg-blue-100 p-2 rounded-full">
                    <User className="size-4 text-blue-600" />
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                onClick={onLogout}
                className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </Button>
            </div>
          </div>

          {/* Navegación nivel 1: módulos (desktop) */}
          <div className="hidden md:flex items-center gap-2 px-6 pt-2 pb-2" role="tablist" aria-label="Módulos">
            {MODULOS_GESTOR.map((modulo) => {
              const Icon = modulo.icon;
              const activo = modulo.id === moduloGestorActivo.id;
              return (
                <button
                  key={modulo.id}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => handleModuloGestorClick(modulo.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${
                    activo ? 'font-medium' : 'text-gray-600 border-transparent hover:bg-gray-50'
                  }`}
                  style={activo ? { backgroundColor: modulo.colorFondo, color: modulo.color, borderColor: modulo.color } : undefined}
                >
                  <Icon className="size-4" />
                  <span>{modulo.label}</span>
                  {modulo.id === 'chatbot' && pendientesChatbot > 0 && (
                    <span
                      className="rounded-full text-white text-xs"
                      style={{
                        backgroundColor: '#dc2626',
                        minWidth: 20,
                        height: 20,
                        padding: '0 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      aria-label={`${pendientesChatbot} solicitudes pendientes`}
                    >
                      {pendientesChatbot}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Navegación nivel 2: pantallas del módulo activo (desktop) */}
          {moduloGestorActivo.hijos.length === 1 ? (
            <p className="hidden md:flex px-6 py-2 text-sm text-gray-500 border-t border-gray-200">
              {moduloGestorActivo.descripcion}
            </p>
          ) : (
            <nav className="hidden md:flex items-center gap-1 px-6 overflow-x-auto border-t border-gray-200" aria-label={moduloGestorActivo.label}>
              {moduloGestorActivo.hijos.map((hijoId) => {
                const item = menuItems.find(menuItem => menuItem.id === hijoId);
                if (!item) return null;
                const Icon = ICONOS_HIJO_GESTOR[hijoId] || item.icon;
                const activo = activeItem === hijoId;
                return (
                  <button
                    key={hijoId}
                    type="button"
                    onClick={() => handleMenuItemClick(hijoId)}
                    aria-current={activo ? 'page' : undefined}
                    className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                      activo ? 'font-medium' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                    style={{
                      borderBottom: `2px solid ${activo ? moduloGestorActivo.color : 'transparent'}`,
                      marginBottom: -1,
                      ...(activo ? { color: moduloGestorActivo.color } : {}),
                    }}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Navegación por selector agrupado por módulo (mobile) */}
          <div className="md:hidden px-6 pb-3">
            <Select value={activeItem} onValueChange={(value) => handleMenuItemClick(value as MenuItem)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODULOS_GESTOR.map((modulo) => (
                  <SelectGroup key={modulo.id}>
                    <SelectLabel>{modulo.label}</SelectLabel>
                    {modulo.hijos.map((hijoId) => {
                      const item = menuItems.find(menuItem => menuItem.id === hijoId);
                      if (!item) return null;
                      const Icon = ICONOS_HIJO_GESTOR[hijoId] || item.icon;
                      const etiqueta = hijoId === 'chatbot-solicitudes' && pendientesChatbot > 0
                        ? `${item.label} (${pendientesChatbot})`
                        : item.label;
                      return (
                        <SelectItem key={hijoId} value={hijoId}>
                          <div className="flex items-center gap-2">
                            <Icon className="size-4" />
                            <span>{etiqueta}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>

        {/* Chat AI */}
        {isChatOpen && (
          <ChatAI onClose={() => setIsChatOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`\n          fixed lg:static inset-y-0 left-0 z-40\n          ${isSidebarCollapsed && !isHovering ? 'w-16' : 'w-64'} bg-white border-r border-gray-200\n          transform transition-all duration-300 ease-in-out\n          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}\n        `}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-center">
              {/* Logo expandido */}
              <div className={`${isSidebarCollapsed && !isHovering ? 'hidden' : 'block'}`}>
                <img
                  src={logoClinica}
                  alt="Clínicas ATLAS"
                  className="h-16 object-contain"
                />
              </div>
              {/* Logo colapsado */}
              {isSidebarCollapsed && !isHovering && (
                <img
                  src={logoClinica}
                  alt="Clínicas ATLAS"
                  className="h-10 object-contain"
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden absolute right-2 top-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleMenuItemClick(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-colors duration-200
                    ${activeItem === item.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                  title={isSidebarCollapsed && !isHovering ? item.label : ''}
                >
                  <Icon className="size-5 flex-shrink-0" />
                  <span className={isSidebarCollapsed && !isHovering ? 'hidden' : ''}>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-gray-200 space-y-1">
            {(!isSidebarCollapsed || isHovering) && (
              <Button
                variant="ghost"
                onClick={onLogout}
                className="w-full justify-start gap-3 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="size-5" />
                <span>Cerrar Sesión</span>
              </Button>
            )}
            {isSidebarCollapsed && !isHovering && (
              <Button
                variant="ghost"
                onClick={onLogout}
                className="w-full justify-center text-red-600 hover:bg-red-50 hover:text-red-700"
                title="Cerrar Sesión"
              >
                <LogOut className="size-5" />
              </Button>
            )}

            {/* Toggle Sidebar Button - Solo en desktop */}
            <Button
              variant="ghost"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`hidden lg:flex w-full ${isSidebarCollapsed && !isHovering ? 'justify-center' : 'justify-start gap-3'} text-gray-600 hover:bg-gray-50`}
              title={isSidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
            >
              {isSidebarCollapsed && !isHovering ? (
                <ChevronRight className="size-5" />
              ) : (
                <>
                  <ChevronLeft className="size-5" />
                  <span>Contraer</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-transparent z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="size-6" />
            </Button>

            {/* User Info Section */}
            <div className="flex items-center gap-4 ml-auto">
              {currentUser && (
                <div className="hidden md:flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  <div className="flex flex-col items-end">
                    <span className="text-sm text-gray-800">{currentUser.name}</span>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {currentUser.compania && (
                        <>
                          <Building2 className="size-3" />
                          <span>{currentUser.compania}</span>
                        </>
                      )}
                      {currentUser.sucursal && (
                        <>
                          <span>•</span>
                          <MapPin className="size-3" />
                          <span>{currentUser.sucursal}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="bg-blue-100 p-2 rounded-full">
                    <User className="size-4 text-blue-600" />
                  </div>
                </div>
              )}

              {/* Logout Button */}
              <Button
                variant="outline"
                onClick={onLogout}
                className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Chat AI */}
      {isChatOpen && (
        <ChatAI onClose={() => setIsChatOpen(false)} />
      )}


    </div>
  );
}
