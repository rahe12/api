const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Validation schemas
const studentSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const studentUpdateSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).optional(),
});

// Register a new student
router.post('/register', async (req, res) => {
  try {
    const { error, value } = studentSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { name, email, password } = value;

    // Check if email exists
    const existing = await pool.query('SELECT id FROM students WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Default role 'student'
    const result = await pool.query(
      'INSERT INTO students (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, 'student']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Login (generate JWT)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const userResult = await pool.query('SELECT * FROM students WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    const user = userResult.rows[0];
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(401).json({ message: 'Invalid password' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get all students (admin only)
router.get('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

  try {
    const result = await pool.query('SELECT id, name, email, role FROM students');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get student by ID (self or admin)
router.get('/:id', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id);
  if (req.user.id !== id && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

  try {
    const result = await pool.query('SELECT id, name, email, role FROM students WHERE id=$1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Student not found' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update student by ID (self or admin)
router.put('/:id', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id);
  if (req.user.id !== id && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

  const { error, value } = studentUpdateSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (value.name) {
      fields.push(`name=$${idx++}`);
      values.push(value.name);
    }
    if (value.email) {
      fields.push(`email=$${idx++}`);
      values.push(value.email);
    }
    if (value.password) {
      const hashed = await bcrypt.hash(value.password, 10);
      fields.push(`password=$${idx++}`);
      values.push(hashed);
    }

    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });

    values.push(id);
    const query = `UPDATE students SET ${fields.join(', ')} WHERE id=$${idx} RETURNING id, name, email, role`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) return res.status(404).json({ message: 'Student not found' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
