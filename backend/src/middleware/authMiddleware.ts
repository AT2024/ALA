import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Lazy getter for JWT secret with runtime validation
function getJwtSecret(): string {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required but not set');
  }
  return JWT_SECRET;
}

// Middleware to protect routes
// Checks for auth token in HttpOnly cookie first (more secure), then Authorization header (for API clients)
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  // Priority 1: Check for HttpOnly cookie (most secure - OWASP recommended)
  if (req.cookies?.['auth-token']) {
    token = req.cookies['auth-token'];
  }
  // Priority 2: Fallback to Authorization header for API clients and backwards compatibility
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    return next(new Error('Not authorized, no token'));
  }

  try {
    // Verify token (JWT_SECRET validated at runtime)
    const decoded: any = jwt.verify(token, getJwtSecret());

    // Get user from the token
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['verificationCode', 'verificationExpires'] },
    });

    if (!user) {
      res.status(401);
      return next(new Error('Not authorized, user not found'));
    }

    // Set user to req.user
    req.user = user;
    next();
  } catch (error) {
    res.status(401);
    return next(new Error('Not authorized, invalid token'));
  }
};

// Middleware to restrict to specific roles
export const restrict = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401);
      return next(new Error('Not authorized'));
    }

    if (!roles.includes(req.user.role)) {
      res.status(403);
      return next(new Error('Not authorized for this role'));
    }

    next();
  };
};
