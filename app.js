const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");
const db = require("./db/db");
const { sendAlert } = require("./utils/alertSender");

const app = express();
const PORT = process.env.PORT || 3000; // Railway PORT use

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: true
}));

// ===== Root Route =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ===== Signup =====
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (email, password) VALUES (?, ?)",
    [email, hashedPassword],
    (err) => {
      if (err) return res.send("Error: user may already exist!");
      res.redirect("/"); // root route ke liye
    }
  );
});

// ===== Login =====
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.send("DB error");
    if (!results.length) return res.send("User not found");

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      req.session.user = user;
      res.redirect("/dashboard.html");
    } else {
      res.send("Invalid credentials");
    }
  });
});

// ===== Logout =====
app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// ===== Add Contact =====
app.post("/add-contact", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const { name, phone } = req.body;
  const userId = req.session.user.id;

  db.query(
    "INSERT INTO contacts (user_id, name, phone) VALUES (?, ?, ?)",
    [userId, name, phone],
    (err) => {
      if (err) return res.send("Error adding contact");
      res.redirect("/contacts");
    }
  );
});

// ===== Show Contacts =====
app.get("/contacts", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const userId = req.session.user.id;

  db.query("SELECT * FROM contacts WHERE user_id = ?", [userId], (err, results) => {
    if (err) return res.send("Error fetching contacts");

    let contactList = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Contacts</title>
      <link rel="stylesheet" href="/dashboard.css">
    </head>
    <body>
      <div class="container">
        <h2>Your Contacts</h2>
        <form action="/add-contact" method="POST">
          <input type="text" name="name" placeholder="Enter Name" required>
          <input type="text" name="phone" placeholder="Enter Phone Number" required>
          <button type="submit">Add Contact</button>
        </form>
        <ul>
    `;
    results.forEach(c => contactList += `<li>${c.name} - ${c.phone}</li>`);
    contactList += `
        </ul>
        <button onclick="window.location.href='/dashboard.html'">Back</button>
      </div>
    </body>
    </html>
    `;
    res.send(contactList);
  });
});

// ===== Panic & Safe Routes =====
app.post("/panic", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const { latitude, longitude } = req.body || {};
  const userId = req.session.user.id;

  db.query("SELECT * FROM contacts WHERE user_id = ?", [userId], (err, contacts) => {
    if (err) return res.send("Error fetching contacts");
    if (!contacts.length) return res.send("No contacts saved.");

    const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    sendAlert(contacts, "panic", { latitude, longitude });

    let names = contacts.map(c => c.name).join(", ");
    console.log(`🚨 PANIC ALERT SENT TO: ${names}`);
    res.send(`🚨 Panic alert sent to: ${names}\nLocation: ${googleMapsUrl}`);
  });
});

app.post("/safe", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const { latitude, longitude } = req.body || {};
  const userId = req.session.user.id;

  let query = "UPDATE users SET status='safe'";
  const params = [];

  if (latitude && longitude) {
    query += ", last_lat=?, last_lng=?";
    params.push(latitude, longitude);
  }
  query += " WHERE id=?";
  params.push(userId);

  db.query(query, params, (err) => {
    if (err) return res.send("Error updating status");

    db.query("SELECT * FROM contacts WHERE user_id=?", [userId], (err, contacts) => {
      if (err) return res.send("Error fetching contacts");

      if (contacts.length) {
        const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        sendAlert(contacts, "safe", { latitude, longitude });
        let names = contacts.map(c => c.name).join(", ");
        console.log(`✅ SAFE ALERT SENT TO: ${names}`);
        res.send(`✅ You are safe! Notified: ${names}\nLocation: ${googleMapsUrl}`);
      } else {
        res.send("✅ You are safe! No contacts to notify.");
      }
    });
  });
});

// ===== Start Server =====
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
