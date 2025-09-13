// dashboard.js (updated)

const contactsBtn = document.getElementById("contactsBtn");
const panicBtn = document.getElementById("panicBtn");
const safeBtn = document.getElementById("safeBtn");

// Manage Contacts button
if (contactsBtn) {
  contactsBtn.addEventListener("click", () => {
    window.location.href = "/contacts";
  });
}

// Generic function to send fetch request
async function sendRequest(endpoint, includeLocation = false) {
  let bodyData = null;

  if (includeLocation) {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    // Wait for location
    bodyData = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }),
        (err) => reject(err)
      );
    }).catch((err) => {
      console.error(err);
      alert("Unable to retrieve location");
    });
  }

  try {
    const response = await fetch(`/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: bodyData ? JSON.stringify(bodyData) : null
    });

    const result = await response.text();
    alert(result);
  } catch (err) {
    console.error(err);
    alert("Error sending request");
  }
}

// Panic button
if (panicBtn) {
  panicBtn.addEventListener("click", (e) => {
    e.preventDefault();
    sendRequest("panic", true); // send location along with panic
  });
}

// Safe button
if (safeBtn) {
  safeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    sendRequest("safe", true); // send location along with safe
  });
}
