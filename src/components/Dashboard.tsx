import { useState } from 'react';
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
} from 'lucide-react';
import { Button } from './ui/button';
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

type MenuItem = 'pacientes' | 'agenda' | 'agenda-servicios' | 'dashboard-servicios' | 'citas' | 'cargos' | 'reportes' | 'chatbot' | 'configuraciones' | 'planificacion' | 'interconsultas';

export function Dashboard({ onLogout, currentUser }: DashboardProps) {
  const servicioArea = currentUser?.servicio_area?.trim().toUpperCase();
  const servicioDescripcion = currentUser?.servicio?.trim().toUpperCase();
  const esUsuarioServicio =
    !!currentUser?.id_servicio &&
    servicioArea !== 'CONSULTA_EXTERNA' &&
    servicioDescripcion !== 'CONSULTA EXTERNA';

  const [activeItem, setActiveItem] = useState<MenuItem>(
    esUsuarioServicio ? 'agenda'
    : currentUser?.tipo_usuario === 'medico' ? 'pacientes'
    : currentUser?.tipo_usuario === 'GESTOR_IMAGEN' ? 'dashboard-servicios'
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

  // Función para manejar navegación desde Agenda a Pacientes con consulta
  const handleIniciarConsultaDesdeAgenda = (pacienteId: string, citaId: number) => {
    if (currentUser?.tipo_usuario === 'secretaria') {
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
      case 'configuraciones':
        return <ConfiguracionesViewSupabase />;
      default:
        return null;
    }
  };

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
