import http from 'http';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env.js';
import incidentsRouter from './routes/incidents.js';
import publicRouter from './routes/public.js';
import {initSocket} from './socket.js';
import notificationService from './services/notificationService.js';

const app = express();
const httpServer = http.createServer(app);

app.use(helmet());
app.use(
  cors({
    origin: env.clientOrigin,
  }),
);
app.use(express.json({limit: '1mb'}));
app.use(morgan('dev'));

app.get('/health', (_request, response) => {
  response.json({
    message: 'ResQ AI backend is running',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/incidents', incidentsRouter);
app.use('/api', publicRouter);

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({message: 'Unexpected server error'});
});

initSocket(httpServer, env.clientOrigin);

// Process fallback SMS queue every 60 seconds
setInterval(() => {
  notificationService.processFallbackQueue().catch(console.error);
}, 60000);

httpServer.listen(env.port, () => {
  console.log(`ResQ AI backend listening on http://localhost:${env.port}`);
});
