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
  // Fallback para desarrollo local si no se lee la variable de entorno
  const validPasswordHash = process.env.AUTH_PASSWORD_HASH || '$2b$10$bQOzYjD/B6S93woCCUnw0uTu69ntKR1V8JQKXeE/Ufq6RH9xz2xYm';

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
