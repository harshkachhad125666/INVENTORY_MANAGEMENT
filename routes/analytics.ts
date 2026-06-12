import { Router, Request, Response } from 'express';
import { dbService } from '../src/supabaseClient.ts';

export const analyticsRouter = Router();

// Handle GET /dashboard - Compile high-fidelity financial charts data and stock levels
analyticsRouter.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const analytics = await dbService.getDashboardAnalytics();
    res.json({ 
      success: true, 
      analytics,
      isUsingSupabase: dbService.isUsingRealSupabase(),
      supabaseError: dbService.getSupabaseError()
    });
  } catch (error: any) {
    console.error('Error compiling analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to compile dashboard metrics', error: error.message });
  }
});
