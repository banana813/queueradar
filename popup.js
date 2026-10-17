
const scanButton = document.getElementById("scanButton");
const status = document.getElementById("status");
const emailList = document.getElementById("emailList");

scanButton.addEventListener("click", scanInbox);

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
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
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

      const item = document.createElement("li");
      const heading = document.createElement("strong");
      const details = document.createElement("p");

      heading.textContent = subject;
      details.textContent = sender;

      item.append(heading, details);
      emailList.appendChild(item);
    }

    status.textContent = `Found ${messages.length} emails.`;

  } catch (error) {
    status.textContent = "Error: " + error.message;
  } finally {
    scanButton.disabled = false;
  }
}
