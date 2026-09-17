import type { VercelRequest, VercelResponse } from '@vercel/node';

let appHandler: any = null;

export default async (req: VercelRequest, res: VercelResponse) => {
  if (!appHandler) {
    const serverModule = await import('./_server.js');
    appHandler = serverModule.default || serverModule;
  }
  return appHandler(req as any, res as any);
};

