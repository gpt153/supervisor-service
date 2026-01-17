import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export interface AuthOptions {
  jwtSecret: string;
  apiKeys?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    type: 'jwt' | 'apikey';
  };
}

export function createAuthMiddleware(options: AuthOptions) {
  const { jwtSecret, apiKeys = [] } = options;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({ error: 'No authorization header' });
        return;
      }

      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        try {
          const decoded = jwt.verify(token, jwtSecret) as any;
          req.user = {
            id: decoded.sub || decoded.id,
            type: 'jwt',
          };
          next();
        } catch (error) {
          res.status(401).json({ error: 'Invalid JWT token' });
        }
      } else if (authHeader.startsWith('ApiKey ')) {
        const apiKey = authHeader.substring(7);

        const isValid = apiKeys.includes(apiKey);

        if (isValid) {
          req.user = {
            id: 'api-client',
            type: 'apikey',
          };
          next();
        } else {
          res.status(401).json({ error: 'Invalid API key' });
        }
      } else {
        res.status(401).json({ error: 'Invalid authorization header format' });
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export function generateJWT(userId: string, secret: string, expiresIn?: string): string {
  return jwt.sign({ id: userId }, secret, expiresIn ? { expiresIn: expiresIn as any } : undefined);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
