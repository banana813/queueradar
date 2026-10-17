
const scanButton = document.getElementById("scanButton");
const status = document.getElementById("status");
const emailList = document.getElementById("emailList");

scanButton.addEventListener("click", scanInbox);

function decodeGmailBody(encoded) {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);

    const bytes = Uint8Array.from(
        binary,
        character => character.charCodeAt(0)
    );

    return new TextDecoder("utf-8").decode(bytes);
}

function findMimePart(part, mimeType) {
    if (part.mimeType?.toLowerCase() === mimeType && part.body?.data) {
        return part.body.data;
    }

    for (const child of part.parts || []) {
        const found = findMimePart(child, mimeType);

        if (found) {
            return found;
        }
    }

    return null;
}

function getEmailBody(payload) {
    const plain = findMimePart(payload, "text/plain");

    if (plain) {
        return decodeGmailBody(plain);
    }

    const html = findMimePart(payload, "text/html");

    if (html) {
        const document = new DOMParser().parseFromString(
            decodeGmailBody(html),
            "text/html"
        );

        document.querySelectorAll("script, style").forEach(
            element => element.remove()
        );

        return document.body?.textContent || "";
    }

    return payload.body?.data
        ? decodeGmailBody(payload.body.data)
        : "";
}

async function scanInbox() {
  scanButton.disabled = true;
  status.textContent = "Connecting to Gmail...";
  emailList.replaceChildren();

  try {
    const auth = await chrome.identity.getAuthToken({
      interactive: true
    });

    const token = auth.token;

    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX",
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("Gmail request failed: " + response.status);
    }

    const data = await response.json();
    const messages = data.messages || [];

    if (messages.length === 0) {
      status.textContent = "No inbox messages found.";
      return;
    }

    for (const message of messages) {
      const result = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
      {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!result.ok) {
        throw new Error("Could not retrieve a message.");
      }

      const email = await result.json();
      const headers = email.payload.headers;

      const subject = headers.find(
        header => header.name.toLowerCase() === "subject"
      )?.value || "(No subject)";

      const sender = headers.find(
        header => header.name.toLowerCase() === "from"
      )?.value || "(Unknown sender)";

      const body = getEmailBody(email.payload);

      const analysis = analyzeEmail({
        subject,
        body,
        qrLinks
      });

      // Print results for testing
      console.log("Email analysis:", analysis);

      const item = document.createElement("li");

      const heading = document.createElement("strong");
      const details = document.createElement("p");

      heading.textContent = subject;
      details.textContent = sender;


      // DISPLAY TO-DO TASKS

      const tasks = document.createElement("p");

      tasks.textContent = "To-do: " + (
          analysis.tasks.length
              ? analysis.tasks.map(task =>
                  `${task.title} (deadline: ${task.deadline || "unknown"})`
              ).join(" | ")
              : "None recognized"
      );


      // DISPLAY CALENDAR EVENTS

      const events = document.createElement("p");

      events.textContent = "Calendar: " + (
          analysis.events.length
              ? analysis.events.map(event =>
                  `${event.title} (date: ${event.date}, time: ${event.time || "unknown"})`
              ).join(" | ")
              : "None recognized"
      );


      // DISPLAY QR CODE LINKS

      const qr = document.createElement("p");

      qr.textContent = "Decoded QR links: " + (
          analysis.qrLinks.join(", ") || "Not scanned yet"
      );


      // ADD EVERYTHING TO THE EMAIL LIST

      item.append(
          heading,
          details,
          tasks,
          events,
          qr
      );

      emailList.appendChild(item);
    }

  status.textContent =    `Analyzed ${messages.length} emails (QR scanning not connected yet).`;

  } catch (error) {
    status.textContent = "Error: " + error.message;
  } finally {
    scanButton.disabled = false;
  }
}
