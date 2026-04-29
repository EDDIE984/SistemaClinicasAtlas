import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Mail,
  Lock,
  Calendar,
  Building2,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import {
  getUsuarioByEmail,
  getAsignacionesCompletasByUsuario,
  validateCredentials,
  type Usuario,
  type AsignacionCompleta,
} from "../lib/authService";
// import logoClinica from "figma:asset/535c4fa3c95ae864b14ba302621119ba18d73bbc.png";
const logoClinica = 'https://clinicas-atlas.com/wp-content/uploads/2024/11/clinicas-atlas-ecuador.png';

interface LoginProps {
  onLogin: (
    usuario: Usuario,
    asignacion: AsignacionCompleta,
  ) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"credentials" | "selection">(
    "credentials",
  );
  const [validatedUser, setValidatedUser] =
    useState<Usuario | null>(null);
  const [asignaciones, setAsignaciones] = useState<
    AsignacionCompleta[]
  >([]);
  const [selectedAsignacion, setSelectedAsignacion] =
    useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmitCredentials = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Por favor complete todos los campos");
      return;
    }

    setIsLoading(true);

    try {
      // Validar credenciales con Supabase
      const validation = await validateCredentials(
        email,
        password,
      );

      if (!validation.success || !validation.usuario) {
        toast.error(
          validation.message || "Error al iniciar sesión",
        );
        setIsLoading(false);
        return;
      }

      const usuario = validation.usuario;

      // Obtener asignaciones del usuario desde Supabase
      const asignacionesUsuario =
        await getAsignacionesCompletasByUsuario(
          usuario.id_usuario,
        );

      if (asignacionesUsuario.length === 0) {
        toast.error("El usuario no tiene asignaciones activas");
        setIsLoading(false);
        return;
      }

      // Si tiene solo una asignación, ingresar directamente
      if (asignacionesUsuario.length === 1) {
        toast.success("¡Bienvenido!");
        // Guardar email en localStorage para cancelaciones
        localStorage.setItem("currentUserEmail", email);
        localStorage.setItem(
          "currentUserId",
          usuario.id_usuario.toString(),
        );
        localStorage.setItem(
          "currentUserName",
          `${usuario.tipo_usuario === 'medico' ? 'Dr. ' : ''}${usuario.nombre} ${usuario.apellido}`,
        );
        localStorage.setItem(
          "currentUsuarioSucursalId",
          asignacionesUsuario[0].id_usuario_sucursal.toString(),
        );
        localStorage.setItem(
          "currentSucursalId",
          asignacionesUsuario[0].sucursal.id_sucursal.toString(),
        );
        localStorage.setItem(
          "currentCompaniaId",
          asignacionesUsuario[0].compania.id_compania.toString(),
        );
        onLogin(usuario, asignacionesUsuario[0]);
        return;
      }

      // Si tiene múltiples asignaciones, mostrar selector
      setValidatedUser(usuario);
      setAsignaciones(asignacionesUsuario);
      setStep("selection");
      setIsLoading(false);
    } catch (error) {
      console.error("❌ Error en login:", error);
      toast.error("Error al conectar con el servidor");
      setIsLoading(false);
    }
  };

  const handleSubmitSelection = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAsignacion || !validatedUser) {
      toast.error("Por favor selecciona una sucursal");
      return;
    }

    const asignacionSeleccionada = asignaciones.find(
      (a) =>
        a.id_usuario_sucursal.toString() === selectedAsignacion,
    );

    if (asignacionSeleccionada) {
      toast.success("¡Bienvenido!");
      // Guardar email en localStorage para cancelaciones
      localStorage.setItem(
        "currentUserEmail",
        validatedUser.email,
      );
      localStorage.setItem(
        "currentUserId",
        validatedUser.id_usuario.toString(),
      );
      localStorage.setItem(
        "currentUserName",
        `${validatedUser.tipo_usuario === 'medico' ? 'Dr. ' : ''}${validatedUser.nombre} ${validatedUser.apellido}`,
      );
      localStorage.setItem(
        "currentUsuarioSucursalId",
        asignacionSeleccionada.id_usuario_sucursal.toString(),
      );
      localStorage.setItem(
        "currentSucursalId",
        asignacionSeleccionada.sucursal.id_sucursal.toString(),
      );
      localStorage.setItem(
        "currentCompaniaId",
        asignacionSeleccionada.compania.id_compania.toString(),
      );
      onLogin(validatedUser, asignacionSeleccionada);
    }
  };

  const handleBack = () => {
    setStep("credentials");
    setValidatedUser(null);
    setAsignaciones([]);
    setSelectedAsignacion("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img
              src={logoClinica}
              alt="Clínicas ATLAS"
              className="h-20 object-contain"
            />
          </div>
          <CardTitle className="text-2xl">
            Sistema de Control de Citas
          </CardTitle>
          <CardDescription>
            {step === "credentials"
              ? "Ingresa tus credenciales para acceder al sistema"
              : "Selecciona la compañía y sucursal"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "credentials" ? (
            <form
              onSubmit={handleSubmitCredentials}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">
                  Correo Electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 size-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 size-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading
                  ? "Iniciando sesión..."
                  : "Iniciar Sesión"}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={handleSubmitSelection}
              className="space-y-4"
            >
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-600">
                  Bienvenido/a{" "}
                  <span className="font-semibold">
                    {validatedUser?.nombre}{" "}
                    {validatedUser?.apellido}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tienes acceso a {asignaciones.length}{" "}
                  ubicaciones
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="asignacion">
                  Selecciona Compañía y Sucursal
                </Label>
                <Select
                  value={selectedAsignacion}
                  onValueChange={setSelectedAsignacion}
                >
                  <SelectTrigger id="asignacion">
                    <SelectValue placeholder="Seleccione una opción" />
                  </SelectTrigger>
                  <SelectContent>
                    {asignaciones.map((asig) => (
                      <SelectItem
                        key={asig.id_usuario_sucursal}
                        value={asig.id_usuario_sucursal.toString()}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="size-4 text-blue-600" />
                          <span>{asig.compania.nombre}</span>
                          <span className="text-gray-400">
                            •
                          </span>
                          <MapPin className="size-4 text-green-600" />
                          <span>{asig.sucursal.nombre}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedAsignacion && (
                <div className="bg-gray-50 p-3 rounded-lg border space-y-2">
                  {(() => {
                    const asig = asignaciones.find(
                      (a) =>
                        a.id_usuario_sucursal.toString() ===
                        selectedAsignacion,
                    );
                    return asig ? (
                      <>
                        <div className="flex items-start gap-2">
                          <Building2 className="size-4 text-blue-600 mt-0.5" />
                          <div>
                            <p className="text-sm">
                              <span className="text-gray-600">
                                Compañía:
                              </span>{" "}
                              {asig.compania.nombre}
                            </p>
                            <p className="text-xs text-gray-500">
                              {asig.compania.direccion}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="size-4 text-green-600 mt-0.5" />
                          <div>
                            <p className="text-sm">
                              <span className="text-gray-600">
                                Sucursal:
                              </span>{" "}
                              {asig.sucursal.nombre}
                            </p>
                            <p className="text-xs text-gray-500">
                              {asig.sucursal.direccion}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Calendar className="size-4 text-purple-600 mt-0.5" />
                          <div>
                            <p className="text-sm">
                              <span className="text-gray-600">
                                Especialidad:
                              </span>{" "}
                              {asig.especialidad}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : null;
                  })()}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  Atrás
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={!selectedAsignacion}
                >
                  Ingresar
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
