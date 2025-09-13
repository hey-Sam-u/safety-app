require("dotenv").config();
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

function sendAlert(contacts, type, location) {
  const { latitude, longitude } = location || {};

  // Google Maps clickable link
  const googleMapsUrl =
    latitude && longitude
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : "Location not available";

  contacts.forEach((c) => {
    const message =
      type.toLowerCase() === "panic"
        ? `🚨 PANIC ALERT 🚨\nLocation: ${googleMapsUrl}`
        : `✅ SAFE ALERT ✅\nLocation: ${googleMapsUrl}`;

    // Console log
    console.log(
      `ALERT (${type.toUpperCase()}) sent to ${c.name} | Phone: ${c.phone} | Location: ${latitude},${longitude}`
    );

    // SMS send karega
    client.messages
      .create({
        body: message,
        from: process.env.TWILIO_PHONE, // Twilio number
        to: c.phone, // Contact number
      })
      .then((msg) => console.log(`SMS sent to ${c.name}: ${msg.sid}`))
      .catch((err) => console.error(`SMS error for ${c.name}:`, err.message));
  });
}

module.exports = { sendAlert };
