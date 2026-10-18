
const scanButton = document.getElementById("scanButton");
const status = document.getElementById("status");
const emailList = document.getElementById("emailList");
const qrList = document.getElementById("qrList");

scanButton.addEventListener("click", scanInbox);

async function scanInbox() {
  scanButton.disabled = true;
  status.textContent = "Connecting to Gmail...";
  qrList.replaceChildren();

  try {
    await chrome.identity.clearAllCachedAuthTokens();
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

      const imageParts = findImages(email.payload);

      for(const part of imageParts){
        try{
          const bytes = await getImageBytes(part, message.id, token);
      
          if(!bytes) continue;
      
          const qrData = await decodeQr(bytes, part.mimeType);

          if(qrData){
            const item = document.createElement("li");
            const title = document.createElement("strong");
            const link = document.createElement("p");
            const analysis = document.createElement("p");

            title.textContent = "QR code detected";
            link.textContent = qrData;
            analysis.textContent = "Analyzing with Gemini...";

            item.append(title, link, analysis);
            qrList.appendChild(item);

            try {
              const result = await analyzeQr(qrData);

              analysis.textContent =
                `Purpose: ${result.purpose}\n` +
                `Action: ${result.actionRequired}\n` +
                `Deadline: ${result.deadline}\n` +
                `Summary: ${result.summary}`;

              analysis.style.whiteSpace = "pre-line";
            } catch (error) {
              analysis.textContent = `Gemini analysis failed: ${error.message}`;
            }
          }

        }catch(error){
          console.error("Could not scan image:", error);
        }
      }

      const item = document.createElement("li");
      const heading = document.createElement("strong");
      const details = document.createElement("p");

      heading.textContent = subject;
      details.textContent = sender;

      item.append(heading, details);
    }

    status.textContent = `Found ${messages.length} emails.`;

  } catch (error) {
    status.textContent = "Error: " + error.message;
  } finally {
    scanButton.disabled = false;
  }
}

function findImages(part, images = []){
  if (!part){
    return images;
  }

  if(part.mimeType?.startsWith("image/")){
    images.push(part);
  }

  for(const child of part.parts || []){
    findImages(child, images);
  }
  return images;
}

async function getImageBytes(part, messageId, token) {
  let base64 = part.body?.data;

  if(!base64 && part.body?.attachmentId){
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${part.body.attachmentId}`, { headers: { Authorization: `Bearer ${token}` } });
    
    if(!response.ok){
      throw new Error("Couldn't download an image.");
    }

    const attachment = await response.json();
    base64 = attachment.data;
  }

  if(!base64) return null;

  base64 = base64.replace(/-/g, "+").replace(/_/g,"/");
  base64 = base64.padEnd(Math.ceil(base64.length/4) * 4, "=");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for(let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function decodeQr(bytes, mimeType) {
  let blob = new Blob([bytes], {type: mimeType});
  let bitmap = await createImageBitmap(blob);
  try {
    let canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    let context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    let result = jsQR(imageData.data, imageData.width, imageData.height)
    return result ? result.data : null;
  } finally {
    bitmap.close();
  }
}
