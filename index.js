const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const PORT = process.env.PORT || 8080;
const MONGOURL = process.env.MONGOURL;

app.use(express.json());
app.use(cors({ origin: "*" }));
// Connect to MongoDB
mongoose
  .connect(MONGOURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Schemas
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});
const taskSchema = new mongoose.Schema({
  text: String,
  status: String,
  priority: String,
  userID: mongoose.Schema.Types.ObjectId,
});
const Task = mongoose.model("task", taskSchema);
const User = mongoose.model("user", userSchema);

// Register route
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashed });
  await user.save();
  res.send("User registered");
});

// Login route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ userID: user._id }, "secret", { expiresIn: "1h" });
  res.json({ token });
});

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.header("authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, "secret");
    req.userID = decoded.userID;
    next();
  } catch (e) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// GET task
app.get("/task", authMiddleware, async (req, res) => {
  const task = await Task.find({ userID: req.userID });
  res.json(task);
});

// POST task
app.post("/task", authMiddleware, async (req, res) => {
  const { text, status, priority } = req.body;
  const task = new Task({ text, status, priority, userID: req.userID });
  await task.save();
  res.json(task);
});

// DELETE task
app.delete("/task/:id", authMiddleware, async (req, res) => {
  await Task.findOneAndDelete({ _id: req.params.id, userID: req.userID });
  res.json({ message: "Task deleted" });
});

// PATCH task status
app.patch("/task/:id/status", authMiddleware, async (req, res) => {
  const { status } = req.body;
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userID: req.userID },
    { status },
    { new: true }
  );

  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  res.json(task);
});

app.patch("/task/:id/priority", authMiddleware, async (req, res) => {
  const { priority } = req.body;

  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userID: req.userID },
      { priority },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: "Error updating priority" });
  }
});

// Start server
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
