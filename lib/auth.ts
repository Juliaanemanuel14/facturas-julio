import { parse } from 'cookie';
import type { NextApiRequest } from 'next';
import type { GetServerSidePropsContext } from 'next';

export function isAuthenticated(req: NextApiRequest | GetServerSidePropsContext['req']): boolean {
  const cookies = parse(req.headers.cookie || '');
  const session = cookies.session;

  if (!session) {
    return false;
  }

  try {
    // Decodificar token de sesión
    const sessionData = JSON.parse(Buffer.from(session, 'base64').toString());

    // Verificar que no haya expirado (7 días)
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos
    const isExpired = Date.now() - sessionData.timestamp > maxAge;

    return !isExpired;
  } catch {
    return false;
  }
}

export function requireAuth(context: GetServerSidePropsContext) {
  if (!isAuthenticated(context.req)) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
}
