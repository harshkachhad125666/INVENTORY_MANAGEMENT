import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Fix ESM dir variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Load Back-end Modular Routers
import { inventoryRouter } from './routes/inventory.ts';
import { billingRouter } from './routes/billing.ts';
import { analyticsRouter } from './routes/analytics.ts';

app.use('/api/inventory', inventoryRouter);
app.use('/api/billing', billingRouter);
app.use('/api/analytics', analyticsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'Active', timestamp: new Date().toISOString() });
});

const PORT = 3000;

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🚀 Starting Express in DEVELOPMENT mode and attaching Vite DevServer programmatically value...');
    
    // Import Vite programmatically to run side-by-side with HMR disabled or enabled appropriately
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true', // Follow config constraint
      },
      appType: 'spa'
    });

    // Use Vite's mount middlewares
    app.use(vite.middlewares);
  } else {
    console.log('📦 Starting Express in PRODUCTION mode, serving compiled web assets...');
    
    // Serve static files from the dist folder
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res, next) => {
      // Direct API endpoints should never fallback to index.html
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`📡 Fullstack inventory service listening on PORT: http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Fatal crash on full-stack webserver startup:', err);
});
