require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const studentRoutes = require('./routes/students');
const timetableRoutes = require('./routes/timetable');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes
app.use('/students', studentRoutes);
app.use('/timetable', timetableRoutes);

// Swagger documentation (optional - can expand later)
const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Student and Timetable API',
    version: '1.0.0',
    description: 'API for managing students and timetable with JWT authentication',
  },
  servers: [{ url: `http://localhost:${PORT}` }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/students/register': {
      post: {
        summary: 'Register a new student',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' } }, required: ['name', 'email', 'password'] },
            },
          },
        },
        responses: { '201': { description: 'Created' }, '400': { description: 'Bad Request' } },
      },
    },
    '/students/login': {
      post: {
        summary: 'Login student',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } }, required: ['email', 'password'] },
            },
          },
        },
        responses: { '200': { description: 'JWT token' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/students': {
      get: {
        summary: 'Get all students (admin only)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of students' }, '403': { description: 'Forbidden' } },
      },
    },
    '/students/{id}': {
      get: {
        summary: 'Get student by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Student data' }, '403': { description: 'Forbidden' }, '404': { description: 'Not found' } },
      },
      put: {
        summary: 'Update student by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' } } },
            },
          },
        },
        responses: { '200': { description: 'Updated student' }, '403': { description: 'Forbidden' } },
      },
    },
    '/timetable': {
      get: {
        summary: 'List all timetable entries',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of timetable entries' } },
      },
      post: {
        summary: 'Add timetable entry (admin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  course: { type: 'string' },
                  day: { type: 'string', enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
                  start_time: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
                  end_time: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
                },
                required: ['course', 'day', 'start_time', 'end_time'],
              },
            },
          },
        },
        responses: { '201': { description: 'Created timetable entry' }, '403': { description: 'Forbidden' } },
      },
    },
  },
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Student and Timetable API');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
