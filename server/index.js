require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const List = require('./models/List');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000; // Deployment Ready Port

// Middleware
app.use(cors({ origin: '*' })); // Allows all connections (Phone, Laptop)
app.use(bodyParser.json());

// Example: mongoose.connect('mongodb+srv://user:pass@cluster0.abcde.mongodb.net/scan_app_final?retryWrites=true&w=majority')
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error(err));

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ error: "User already exists" });

  const newUser = new User({ username, password });
  await newUser.save();
  res.json({ message: "User created", userId: newUser._id, username });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.status(400).json({ error: "Invalid credentials" });
  res.json({ userId: user._id, username: user.username });
});

// --- DATA ROUTES ---
app.get('/api/lists', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json([]);
  const lists = await List.find({ userId }).sort({ createdAt: -1 });
  res.json(lists);
});

app.post('/api/lists', async (req, res) => {
  const { name, userId } = req.body;
  const newList = new List({ name, userId, items: [] });
  await newList.save();
  res.json(newList);
});

// Update List (Items array AND name change)
app.put('/api/lists/:id', async (req, res) => {
  const { items, name } = req.body;
  
  const updateFields = {};
  if (items) updateFields.items = items;
  if (name) updateFields.name = name;

  try {
    const updatedList = await List.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    );
    if (!updatedList) return res.status(404).json({ error: "List not found" });
    res.json(updatedList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lists/:id', async (req, res) => {
  await List.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));