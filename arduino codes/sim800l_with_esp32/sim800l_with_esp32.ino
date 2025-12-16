#include <HardwareSerial.h>
#include <Arduino.h>

// Define your Serial Port and Pins
HardwareSerial sim800(1);

#define SIM800_RX 32
#define SIM800_TX 33
#define SIM800_BAUD 9600

String dtmfInput = "";
bool callActive = false;
bool ringDetected = false; // New flag to manage RING detection timing
unsigned long ringTime = 0; // New variable to store time of RING

// Function Prototypes
void clearSIM800Buffer();
void sendATCommand(const char* command, unsigned long wait_ms);

void setup() {
  Serial.begin(115200);
  delay(1000);

  sim800.begin(SIM800_BAUD, SERIAL_8N1, SIM800_RX, SIM800_TX);
  delay(100);

  Serial.println("Initializing SIM800...");
  clearSIM800Buffer();

  // Send initialization commands with a small delay for stability
  sendATCommand("AT+DDET=1", 200); // Enable DTMF detection
  sendATCommand("AT+CLIP=1", 200); // Enable Caller ID

  Serial.println("SIM800 Initialized.");
}

void loop() {
  
  // --- STATE MACHINE FOR CALL ANSWERING ---
  // If RING was detected and it's been 2 seconds, answer the call
  if (ringDetected && !callActive && (millis() - ringTime >= 2000)) {
      Serial.println("Answering call now (2 seconds elapsed)...");
      sim800.println("ATA"); // *** ANSWER THE CALL ***
      callActive = true;
      ringDetected = false; // Reset the ring detection
      dtmfInput = "";
  }
  
  // --- SIM800 Serial Reading ---
  if (sim800.available()) {
    String line = sim800.readStringUntil('\n');
    line.trim();

    if (line.length() == 0) return;

    Serial.println("SIM800: " + line);

    // Incoming call detected
    if (line.indexOf("RING") != -1 && !callActive && !ringDetected) {
      Serial.println("RING detected. Will answer in 2 seconds.");
      ringDetected = true; // Set flag
      ringTime = millis(); // Record the time of the first RING
    }

    // DTMF detection
    if (line.startsWith("+DTMF:")) {
      char dtmfChar = line.charAt(6);
      if (dtmfChar == '#') {
        Serial.println("DTMF input complete: " + dtmfInput);
        // Note: No delay needed here. The loop continues immediately.
        sim800.println("ATH"); // Hang up
        callActive = false;
        ringDetected = false;
        dtmfInput = "";
      } else {
        dtmfInput += dtmfChar;
        Serial.println("Current DTMF Input: " + dtmfInput);
      }
    }

    // Call ended by caller or module
    if (line.indexOf("NO CARRIER") != -1 || line.indexOf("HANGUP") != -1 || line.indexOf("BUSY") != -1) {
      if (callActive || ringDetected) {
        Serial.println("Call ended / No Carrier.");
        if (callActive) {
          Serial.println("DTMF received: " + dtmfInput);
        }
        callActive = false;
        ringDetected = false;
        dtmfInput = "";
      }
    }
  }
}

// Utility function to clear buffer (more reliable)
void clearSIM800Buffer() {
  while (sim800.available()) {
    sim800.read();
  }
}

// Utility function to send command and wait
void sendATCommand(const char* command, unsigned long wait_ms) {
    sim800.println(command);
    delay(wait_ms);
}


/*
//send massages
String getUnreadSMSJson() {
  String smsJson = ""; // start JSON array

  // Set SMS text mode
  sim800.println("AT+CMGF=1");
  delay(200);
  while (sim800.available()) sim800.readString(); // clear buffer

  // List all unread SMS
  sim800.println("AT+CMGL=\"REC UNREAD\"");
  delay(500);

  String resp = "";
  while (sim800.available()) resp += sim800.readString();

  int index = 0;
  while ((index = resp.indexOf("+CMGL:", index)) != -1) {
    int endLine = resp.indexOf('\n', index);
    if (endLine == -1) break;

    String header = resp.substring(index, endLine);
    header.trim();
    index = endLine + 1;

    // Extract message index (first number after "+CMGL:")
    int colonPos = header.indexOf(':');
    int commaPos = header.indexOf(',', colonPos + 1);
    String msgIndex = "";
    if (colonPos != -1 && commaPos != -1) {
      msgIndex = header.substring(colonPos + 1, commaPos);
      msgIndex.trim();
    }

    // Extract sender (third quoted string)
    int firstQuote = header.indexOf('"');             
    int secondQuote = header.indexOf('"', firstQuote + 1); 
    int thirdQuote = header.indexOf('"', secondQuote + 1); 
    int fourthQuote = header.indexOf('"', thirdQuote + 1); 
    String sender = "";
    if (thirdQuote != -1 && fourthQuote != -1) {
      sender = header.substring(thirdQuote + 1, fourthQuote);
    }

    // Extract date/time (last quoted string)
    int lastQuoteStart = header.lastIndexOf('"', header.length() - 1 - 1);
    int lastQuoteEnd = header.lastIndexOf('"');
    String dateTime = "";
    if (lastQuoteStart != -1 && lastQuoteEnd != -1 && lastQuoteEnd > lastQuoteStart) {
      dateTime = header.substring(lastQuoteStart + 1, lastQuoteEnd);
      // Remove time zone (+22)
      if (dateTime.length() > 3) {
        dateTime = dateTime.substring(0, dateTime.length() - 3);
      }
      dateTime.trim();
    }

    // Message body (next line)
    int nextLine = resp.indexOf('\n', index);
    String message = "";
    if (nextLine != -1) {
      message = resp.substring(index, nextLine);
      message.trim();
      index = nextLine + 1;
    }

    // Build JSON object
    smsJson += "{";
    smsJson += "\"msgNumber\":\"" + msgIndex + "\",";
    smsJson += "\"sender\":\"" + sender + "\",";
    smsJson += "\"dateTime\":\"" + dateTime + "\",";
    smsJson += "\"message\":\"" + message + "\"";
    smsJson += "},"; // comma for next object
  }

  // Remove trailing comma
  if (smsJson.endsWith(",")) smsJson.remove(smsJson.length() - 1);

  smsJson += ""; // end JSON array
  return smsJson;
}

//get the massages
String getAllSMSJson() {
  String smsJson = "["; // start JSON array

  // Set SMS text mode
  sim800.println("AT+CMGF=1");
  delay(200);
  while (sim800.available()) sim800.readString(); // clear buffer

  // List all messages
  sim800.println("AT+CMGL=\"ALL\"");
  delay(500);

  String resp = "";
  while (sim800.available()) resp += sim800.readString();

  int index = 0;
  while ((index = resp.indexOf("+CMGL:", index)) != -1) {
    int endLine = resp.indexOf('\n', index);
    if (endLine == -1) break;

    String header = resp.substring(index, endLine);
    header.trim();
    index = endLine + 1;

    // Extract message index (first number after "+CMGL:")
    int colonPos = header.indexOf(':');
    int commaPos = header.indexOf(',', colonPos + 1);
    String msgIndex = "";
    if (colonPos != -1 && commaPos != -1) {
      msgIndex = header.substring(colonPos + 1, commaPos);
      msgIndex.trim();
    }

    // Extract sender (third quoted string)
    int firstQuote = header.indexOf('"');             
    int secondQuote = header.indexOf('"', firstQuote + 1); 
    int thirdQuote = header.indexOf('"', secondQuote + 1); 
    int fourthQuote = header.indexOf('"', thirdQuote + 1); 
    String sender = "";
    if (thirdQuote != -1 && fourthQuote != -1) {
      sender = header.substring(thirdQuote + 1, fourthQuote);
    }

    // Extract date/time (last quoted string)
    int lastQuoteStart = header.lastIndexOf('"', header.length() - 1 - 1);
    int lastQuoteEnd = header.lastIndexOf('"');
    String dateTime = "";
    if (lastQuoteStart != -1 && lastQuoteEnd != -1 && lastQuoteEnd > lastQuoteStart) {
      dateTime = header.substring(lastQuoteStart + 1, lastQuoteEnd);
      // Remove time zone (+22)
      if (dateTime.length() > 3) {
        dateTime = dateTime.substring(0, dateTime.length() - 3);
      }
      dateTime.trim();
    }

    // Message body (next line)
    int nextLine = resp.indexOf('\n', index);
    String message = "";
    if (nextLine != -1) {
      message = resp.substring(index, nextLine);
      message.trim();
      index = nextLine + 1;
    }

    // Build JSON object
    smsJson += "{";
    smsJson += "\"msgNumber\":\"" + msgIndex + "\",";
    smsJson += "\"sender\":\"" + sender + "\",";
    smsJson += "\"dateTime\":\"" + dateTime + "\",";
    smsJson += "\"message\":\"" + message + "\"";
    smsJson += "},"; // comma for next object
  }

  // Remove trailing comma
  if (smsJson.endsWith(",")) smsJson.remove(smsJson.length() - 1);

  smsJson += "]"; // end JSON array
  return smsJson;
}

// send realtime data
String gsm_json_creator() {
  String gsm_json = "{";

  // Helper function to read and clean response
  auto readClean = []() -> String {
    String resp = "";
    long start = millis();
    while (millis() - start < 500) {  
      while (sim800.available()) resp += sim800.readString();
    }
    resp.trim();
    resp.replace("OK", "");
    resp.replace("\r", "");
    resp.replace("\n", "");
    return resp;
  };

  // ---------- RSSI ----------
  sim800.println("AT+CSQ");
  delay(200);
  String resp = readClean();
  int rssi = 0;
  int csqIndex = resp.indexOf("+CSQ:");
  if (csqIndex != -1) {
    int colon = resp.indexOf(':', csqIndex);
    int comma = resp.indexOf(',', colon);
    if (colon != -1 && comma != -1) {
      int rssiVal = resp.substring(colon + 1, comma).toInt();
      rssi = -113 + (rssiVal * 2);
    }
  }
  gsm_json += "\"dBm\":" + String(rssi) + ",";

  // ---------- SIM Status ----------
  sim800.println("AT+CPIN?");
  delay(200);
  resp = readClean();
  int idx = resp.indexOf(":");
  String simStatus = (idx != -1) ? resp.substring(idx + 1) : resp;
  simStatus.trim();
  gsm_json += "\"SIM\":\"" + simStatus + "\",";

  // ---------- Voice Network Registration ----------
  sim800.println("AT+CREG?");
  delay(200);
  resp = readClean();
  idx = resp.indexOf(":");
  String voiceNetwork = "";
  if (idx != -1) {
    String tmp = resp.substring(idx + 1);
    tmp.trim();
    int commaPos = tmp.indexOf(',');
    if (commaPos != -1) {
      int stat = tmp.substring(commaPos + 1).toInt();
      switch (stat) {
        case 0: voiceNetwork = "Not registered"; break;
        case 1: voiceNetwork = "Registered, home network"; break;
        case 2: voiceNetwork = "Searching"; break;
        case 3: voiceNetwork = "Registration denied"; break;
        case 4: voiceNetwork = "Unknown"; break;
        case 5: voiceNetwork = "Registered, roaming"; break;
        default: voiceNetwork = "Unknown"; break;
      }
    }
  }
  gsm_json += "\"VoiceNetwork\":\"" + voiceNetwork + "\",";

  // ---------- Operator ----------
  sim800.println("AT+COPS?");
  delay(200);
  resp = readClean();
  idx = resp.indexOf(":");
  String operatorName = "";
  if (idx != -1) {
    String tmp = resp.substring(idx + 1);
    tmp.trim();
    int firstQuote = tmp.indexOf('"');
    int secondQuote = tmp.indexOf('"', firstQuote + 1);
    if (firstQuote != -1 && secondQuote != -1) {
      operatorName = tmp.substring(firstQuote + 1, secondQuote);
    } else {
      operatorName = tmp;
    }
  }
  gsm_json += "\"Operator\":\"" + operatorName + "\",";

  // ---------- Data Network Registration ----------
  sim800.println("AT+CGREG?");
  delay(200);
  resp = readClean();
  idx = resp.indexOf(":");
  String dataNetwork = "";
  if (idx != -1) {
    String tmp = resp.substring(idx + 1);
    tmp.trim();
    int commaPos = tmp.indexOf(',');
    if (commaPos != -1) {
      int stat = tmp.substring(commaPos + 1).toInt();
      switch (stat) {
        case 0: dataNetwork = "Not registered"; break;
        case 1: dataNetwork = "Registered, home network"; break;
        case 2: dataNetwork = "Searching"; break;
        case 3: dataNetwork = "Registration denied"; break;
        case 4: dataNetwork = "Unknown"; break;
        case 5: dataNetwork = "Registered, roaming"; break;
        default: dataNetwork = "Unknown"; break;
      }
    }
  }
  gsm_json += "\"DataNetwork\":\"" + dataNetwork + "\"";

  gsm_json += "}";
  return gsm_json;
}*/