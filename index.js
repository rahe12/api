require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const adminRoutes = require('./routes/admin');
const newsRoutes = require('./routes/news');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes
app.use('/admin', adminRoutes);
app.use('/news', newsRoutes);

// Swagger documentation
const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Admin and News API',
    version: '1.0.0',
    description: 'API for managing admin users and news with JWT authentication',
  },
  servers: [{ url: `http://localhost:${PORT}` }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/admin/register': {
      post: {
        summary: 'Register a new admin',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['name', 'email', 'password'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Bad Request' },
        },
      },
    },
    '/admin/login': {
      post: {
        summary: 'Login admin',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'JWT token' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/admin': {
      get: {
        summary: 'Get all admins (admin only)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of admins' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/admin/{id}': {
      get: {
        summary: 'Get admin by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': { description: 'Admin data' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
        },
      },
      put: {
        summary: 'Update admin by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Updated admin' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/news': {
      get: {
        summary: 'List all news entries',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of news entries' },
        },
      },
      post: {
        summary: 'Add news entry (admin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                  published_at: { type: 'string', format: 'date-time' },
                },
                required: ['title', 'content', 'published_at'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Created news entry' },
          '403': { description: 'Forbidden' },
        },
      },
    },
  },
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Admin and News API');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
