import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from './_server.js';

export default (req: VercelRequest, res: VercelResponse) => {
  return app(req as any, res as any);
};

