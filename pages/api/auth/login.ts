import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  // Obtener credenciales de variables de entorno
  const validUsername = process.env.AUTH_USERNAME || 'admin';
  const validPasswordHash = process.env.AUTH_PASSWORD_HASH;

  if (!validPasswordHash) {
    console.error('AUTH_PASSWORD_HASH not configured in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Validar credenciales
  if (username === validUsername) {
    const isValid = await bcrypt.compare(password, validPasswordHash);

    if (isValid) {
      // Crear token de sesión simple (en producción usar JWT)
      const sessionToken = Buffer.from(
        JSON.stringify({
          username,
          timestamp: Date.now(),
        })
      ).toString('base64');

      // Configurar cookie de sesión
      const cookie = serialize('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 días
        path: '/',
      });

      res.setHeader('Set-Cookie', cookie);
      return res.status(200).json({ success: true, message: 'Login successful' });
    }
  }

  // Credenciales inválidas
  return res.status(401).json({ error: 'Invalid credentials' });
}
