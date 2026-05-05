import express from 'express';
import cors from 'cors';
import path from 'path';
import { CONFIG } from './server/config';
import apiRoutes from './server/routes/api';
import authRoutes from './server/routes/auth';
import { getClient } from './utils/db'; // Singleton
import './utils/logBroadcaster'; // Initialize logger hook

const app = express();
const port = CONFIG.SERVER.PORT;

// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Database connection check (Optional: just verify we can connect)
(async () => {
  try {
    const client = await getClient();
    console.log('Database connection established.');
    client.release();
  } catch (err) {
    console.error('Failed to connect to database on startup:', err);
  }
})();

// Serve Static Uploads
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));

  // Catch-all route to serve index.html for client-side routing
  app.get('*', (req, res) => {
    res.sendFile('index.html', { root: 'dist' });
  });
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
