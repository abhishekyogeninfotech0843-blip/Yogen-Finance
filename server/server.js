require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cors = require("cors");
const helmet = require("helmet");

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "20kb" }));

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["admin", "user"],
      required: true,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const User = mongoose.model("User", UserSchema);

app.use(
  session({
    name: "yogen_finance_session",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Please log in first." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", database: mongoose.connection.readyState === 1 });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = String(req.body.username || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    if (
      !username ||
      !password ||
      username.length > 100 ||
      password.length > 200
    ) {
      return res
        .status(400)
        .json({ message: "Username and password are required." });
    }

    const user = await User.findOne({ username }).select("+passwordHash");

    if (!user || !user.active) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).json({ message: "Could not start session." });
      }

      req.session.user = {
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        role: user.role,
      };

      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).json({ message: "Could not save session." });
        }

        res.json({ user: req.session.user });
      });
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Server error during login." });
  }
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not logged in." });
  }
  res.json({ user: req.session.user });
});

app.post("/api/auth/logout", (req, res) => {
  if (!req.session) {
    res.clearCookie("yogen_finance_session");
    return res.json({ message: "Logged out." });
  }

  req.session.destroy((error) => {
    res.clearCookie("yogen_finance_session", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    if (error) {
      return res.status(500).json({ message: "Could not log out." });
    }
    res.json({ message: "Logged out." });
  });
});

// Protected test route: logged-in users can access this.
app.get("/api/account", requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

// Admin-only test route.
app.get("/api/admin/check", requireAdmin, (req, res) => {
  res.json({ message: "Admin access verified." });
});

async function start() {
  const required = [
    "MONGODB_URI",
    "SESSION_SECRET",
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
    "DEMO_USER_PASSWORD",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error("Missing .env values: " + missing.join(", "));
  }

  if (process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long.");
  }

  if (process.env.ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters long.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const adminUsername = process.env.ADMIN_USERNAME.trim().toLowerCase();
  const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

  await User.updateOne(
    { username: adminUsername },
    {
      $setOnInsert: {
        name: process.env.ADMIN_NAME || "Yogen Finance Admin",
        username: adminUsername,
        passwordHash: adminHash,
        role: "admin",
      },
    },
    { upsert: true },
  );

  // Seed demo users for development only.
  if (process.env.NODE_ENV !== "production") {
    const demoPassword = process.env.DEMO_USER_PASSWORD;

    for (const demoUser of [
      { name: "Rahul Sharma", username: "rahul" },
      { name: "Amit Kumar", username: "amit" },
    ]) {
      const existing = await User.findOne({ username: demoUser.username });

      if (!existing) {
        await User.create({
          ...demoUser,
          passwordHash: await bcrypt.hash(demoPassword, 12),
          role: "user",
        });
      }
    }
  }

  const port = Number(process.env.PORT) || 5000;

  app.listen(port, () => {
    console.log(`Yogen Finance API running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Backend startup failed:", error.message);
  process.exit(1);
});
