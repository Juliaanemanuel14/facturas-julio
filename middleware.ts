import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // TEMPORAL: Autenticación deshabilitada para desarrollo
  // Permitir acceso a todas las rutas sin verificación
  return NextResponse.next();

  /* DESHABILITADO TEMPORALMENTE
  const { pathname } = request.nextUrl;

  // Rutas públicas que no requieren autenticación
  const publicPaths = ['/login', '/api/auth/login'];

  // Si la ruta es pública, permitir acceso
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Verificar si hay cookie de sesión
  const session = request.cookies.get('session');

  if (!session) {
    // No hay sesión - redirigir a login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Decodificar y verificar sesión
    const sessionData = JSON.parse(
      Buffer.from(session.value, 'base64').toString()
    );

    // Verificar que no haya expirado (7 días)
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    const isExpired = Date.now() - sessionData.timestamp > maxAge;

    if (isExpired) {
      // Sesión expirada - redirigir a login
      const loginUrl = new URL('/login', request.url);
      const response = NextResponse.redirect(loginUrl);

      // Eliminar cookie expirada
      response.cookies.delete('session');

      return response;
    }

    // Sesión válida - permitir acceso
    return NextResponse.next();
  } catch {
    // Error al verificar sesión - redirigir a login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  */
}

// Configurar en qué rutas se ejecuta el middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$).*)',
  ],
};
