const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");
const db = require("./db/db");
const { sendAlert } = require("./utils/alertSender"); // utils folder ke andar

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // location data ke liye
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: true
}));

// ===== Signup Route =====
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query("INSERT INTO users (email, password) VALUES (?, ?)", 
  [email, hashedPassword], (err) => {
    if (err) {
      console.error(err);
      return res.send("Error: user may already exist!");
    }
    res.redirect("login.html");
  });
});

// ===== Login Route =====
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.send("DB error");
    if (results.length === 0) return res.send("User not found");

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      req.session.user = user;
      res.redirect("dashboard.html");
    } else {
      res.send("Invalid credentials");
    }
  });
});

// ===== Logout Route =====
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("login.html");
  });
});

// ===== Add Contact Route =====
app.post("/add-contact", (req, res) => {
  if (!req.session.user) return res.redirect("login.html");

  const { name, phone } = req.body;
  const userId = req.session.user.id;

  db.query(
    "INSERT INTO contacts (user_id, name, phone) VALUES (?, ?, ?)",
    [userId, name, phone],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.send("Error adding contact");
      }
      res.redirect("/contacts"); 
    }
  );
});

// ===== Show Contacts Route =====
app.get("/contacts", (req, res) => {
  if (!req.session.user) return res.redirect("login.html");

  const userId = req.session.user.id;

  db.query(
    "SELECT * FROM contacts WHERE user_id = ?",
    [userId],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.send("Error fetching contacts");
      }

      let contactList = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Manage Contacts</title>
        <link rel="stylesheet" href="dashboard.css">
      </head>
      <body>
        <div class="container">
          <h2>Your Contacts</h2>
          <form action="/add-contact" method="POST">
            <input type="text" name="name" placeholder="Enter Name" required>
            <input type="text" name="phone" placeholder="Enter Phone Number" required>
            <button type="submit">Add Contact</button>
          </form>
          <h3>Saved Contacts</h3>
          <ul style="list-style:none; padding:0;">
      `;

      results.forEach(c => {
        contactList += `<li>${c.name} - ${c.phone}</li>`;
      });

      contactList += `
          </ul>
          <br>
          <button onclick="window.location.href='dashboard.html'">Back to Dashboard</button>
        </div>
      </body>
      </html>
      `;

      res.send(contactList);
    }
  );
});

// ===== Panic Route with Location & Alerts =====
app.post("/panic", (req, res) => {
  if (!req.session.user) return res.redirect("login.html");

  const userId = req.session.user.id;
  const { latitude, longitude } = req.body || {};

  db.query("SELECT * FROM contacts WHERE user_id = ?", [userId], (err, results) => {
    if (err) return res.send("Error fetching contacts");
    if (results.length === 0) return res.send("No contacts saved.");

    const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

    // Twilio SMS send
    sendAlert(results, "panic", { latitude, longitude });

    let contactNames = results.map(c => c.name).join(", ");
    console.log(`🚨 PANIC ALERT SENT TO FAMILY: ${contactNames}`);
    res.send(`🚨 PANIC alert triggered! Location sent to: ${contactNames}\nLink: ${googleMapsUrl}`);
  });
});

// ===== Safe Route with Location & Alerts =====
app.post("/safe", (req, res) => {
  if (!req.session.user) return res.redirect("login.html");

  const userId = req.session.user.id;
  const { latitude, longitude } = req.body || {};

  let query = "UPDATE users SET status = 'safe'";
  const params = [];

  if (latitude && longitude) {
    query += ", last_lat = ?, last_lng = ?";
    params.push(latitude, longitude);
  }

  query += " WHERE id = ?";
  params.push(userId);

  db.query(query, params, (err) => {
    if (err) return res.send("Error updating status");

    // Notify family contacts
    db.query("SELECT * FROM contacts WHERE user_id = ?", [userId], (err, results) => {
      if (err) return res.send("Error fetching contacts");

      if (results.length > 0) {
        const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        sendAlert(results, "safe", { latitude, longitude });

        let contactNames = results.map(c => c.name).join(", ");
        console.log(`✅ SAFE ALERT SENT TO FAMILY: ${contactNames}`);
        res.send(`✅ You are SAFE! Location sent to: ${contactNames}\nLink: ${googleMapsUrl}`);
      } else {
        console.log("No contacts to notify for SAFE status.");
        res.send("✅ You are SAFE! No contacts to notify.");
      }
    });
  });
});



// ===== Start Server =====
// app.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
