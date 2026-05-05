# Health Endpoint Implementation

The Kubernetes deployment expects a health endpoint at `/api/health` for liveness and readiness probes.

## Quick Implementation

Add this endpoint to your `server/routes/api.ts`:

```typescript
// Health check endpoint for Kubernetes probes
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

## Advanced Implementation (with DB check)

For a more robust health check that verifies database connectivity:

```typescript
import { getClient } from '../utils/db';

router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const client = await getClient();
    await client.query('SELECT 1');
    client.release();

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});
```

## Testing

Test the endpoint locally:
```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```
