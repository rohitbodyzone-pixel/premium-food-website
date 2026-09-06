import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

dotenv.config();

import authRoutes from './routes/auth.routes';
import phoneAuthRoutes from './routes/phone-auth.routes';
import countryRoutes from './routes/country.routes';
import categoryRoutes from './routes/category.routes';
import expertRoutes from './routes/expert.routes';
import chatRoutes from './routes/chat.routes';
import callRoutes from './routes/call.routes';
import appointmentRoutes from './routes/appointment.routes';
import reviewRoutes from './routes/review.routes';
import adminRoutes from './routes/admin.routes';
import expertOnboardingRoutes from './routes/expert-onboarding.routes';
import paymentRoutes from './routes/payment.routes';
import expertEarningsRoutes from './routes/expert-earnings.routes';
import webhookRoutes from './routes/webhook.routes';
import notificationRoutes from './routes/notification.routes';
import { notificationService } from './services/notification.service';
import { setupSocketServer } from './socket';
import { appointmentReminderService } from './services/appointment-reminder.service';

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

app.set('io', io);

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin ${origin} not allowed by PropertyTalk security policy`));
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// API Routes
app.use('/api/auth/phone', phoneAuthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/countries', countryRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/experts', expertRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/expert/onboarding', expertOnboardingRoutes);
app.use('/api/expert', expertEarningsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/notifications', notificationRoutes);

notificationService.setSocketServer(io);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PropertyTalk API',
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend static files if built
import path from 'path';
import fs from 'fs';

const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Setup Socket.io real-time layer
setupSocketServer(io);

// Start background appointment reminders runner
appointmentReminderService.startScheduler();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 PropertyTalk Backend Server running on http://localhost:${PORT}`);
  console.log(`📡 Realtime Socket.io active on port ${PORT}`);
});

export { app, server, io };
