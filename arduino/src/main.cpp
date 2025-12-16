#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
// Audio I2S + WAV support
#include <AudioFileSourceSD.h>
#include <AudioGeneratorWAV.h>
#include <AudioOutputI2S.h>
// WiFi + HTTP
#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>

// ------------------- SIM800 Setup -------------------
HardwareSerial sim800(1);
#define SIM800_RX 32
#define SIM800_TX 33
#define SIM800_RESET 14
#define SIM800_POWER 12
#define SIM800_BAUD 115200

// ------------------- Sd card Setup -------------------
#define SD_CS 5     // SD card chip select
#define SD_MOSI 23  // SPI MOSI
#define SD_MISO 19  // SPI MISO
#define SD_SCK 18   // SPI SCK

// ------------------- Internal DAC (GPIO25) -------------------
// Using ESP32 internal DAC on GPIO25 (DAC1)

// ------------------- OLED Setup (unused in this example) -------------------
#define OLED_SDA 21
#define OLED_SCL 22
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// Audio objects
AudioGeneratorWAV *wav = nullptr;
AudioFileSourceSD *file = nullptr;
AudioOutputI2S *out = nullptr;

// Helpers
// Forward declarations
String captureDTMF(uint32_t timeoutMs, const String &caller);
char playServiceSequence(const String &caller, const String &id);
void waitForCallThenAnswerAndPlay();

struct TokenResponse {
	String token;
	String countername;
	String userid;
	String date;
	String service;
	String time;
};

TokenResponse sendCallJson(const String &phone, const String &id, const String &service);
void sendSmsToken(const String &phone, const TokenResponse &resp);
void logCallToSD(const TokenResponse &resp, const String &phone);
void sim800Send(const char *cmd);
bool sim800WaitFor(const char *token, unsigned long timeoutMs = 5000);
String sim800ReadLine(unsigned long timeoutMs);
// OLED helper prototype (defined later) used by WiFi/JSON helpers
void oledPrint(const String &line1, const String &line2 = "", const String &line3 = "", const String &line4 = "");

// WiFi / server config - set these before compiling
const char* WIFI_SSID = "SLT-4G-2.4_1C6F08"; // e.g. "MyWiFi"
const char* WIFI_PASS = "EF4382AE"; // e.g. "password"
const char* SERVER_URL = "http://192.168.1.100:5000/calls"; // change to your server (do NOT use "localhost" from ESP)

void ensureWiFiConnected() {
	if (!WIFI_SSID || strlen(WIFI_SSID) == 0) return; // not configured
	if (WiFi.status() == WL_CONNECTED) return;
	WiFi.mode(WIFI_STA);
	WiFi.begin(WIFI_SSID, WIFI_PASS);
	unsigned long start = millis();
	while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
		delay(250);
	}
	// start NTP to get time
	configTime(0, 0, "pool.ntp.org", "time.nist.gov");
}

void getDateTimeStrings(String &dateStr, String &timeStr) {
	time_t now = time(nullptr);
	struct tm timeinfo;
	if (!localtime_r(&now, &timeinfo)) {
		dateStr = ""; timeStr = ""; return;
	}
	char buf[32];
	strftime(buf, sizeof(buf), "%Y-%m-%d", &timeinfo);
	dateStr = String(buf);
	strftime(buf, sizeof(buf), "%H:%M:%S", &timeinfo);
	timeStr = String(buf);
}

// Try to fetch date/time from SIM800 (AT+CCLK?), format to YYYY-MM-DD / HH:MM:SS
void getGsmDateTimeStrings(String &dateStr, String &timeStr) {
	dateStr = ""; timeStr = "";
	sim800Send("AT+CCLK?");
	// Read a couple of lines quickly
	unsigned long start = millis();
	String line;
	while (millis() - start < 1000) {
		if (sim800.available()) {
			line = sim800ReadLine(200);
			if (line.indexOf("+CCLK:") != -1) break;
		}
	}
	int quote1 = line.indexOf('"');
	int quote2 = line.indexOf('"', quote1 + 1);
	if (quote1 == -1 || quote2 == -1) return;
	String ts = line.substring(quote1 + 1, quote2); // e.g. 24/12/09,12:34:56+00
	if (ts.length() < 17) return;
	String y = ts.substring(0, 2);
	String m = ts.substring(3, 5);
	String d = ts.substring(6, 8);
	String t = ts.substring(9, 17);
	// assume 2000+YY
	dateStr = String("20") + y + "-" + m + "-" + d;
	timeStr = t;
}

// Refresh date/time preferring WiFi (NTP), fallback to GSM clock
void refreshDateTime(String &dateStr, String &timeStr) {
	ensureWiFiConnected();
	getDateTimeStrings(dateStr, timeStr);
	if (dateStr.length() == 0 || timeStr.length() == 0) {
		getGsmDateTimeStrings(dateStr, timeStr);
	}
}

TokenResponse sendCallJson(const String &phone, const String &id, const String &service) {
	if (!WIFI_SSID || strlen(WIFI_SSID) == 0) {
		oledPrint("WiFi not configured");
		return {};
	}
	ensureWiFiConnected();
	if (WiFi.status() != WL_CONNECTED) {
		oledPrint("WiFi failed");
		return {};
	}
	String date, timev;
	getDateTimeStrings(date, timev);
	String serviceOut = service;
	if (service.length() > 0) {
		if (service.startsWith("sv") || service.startsWith("SV")) {
			serviceOut = service;
		} else {
			int num = service.toInt();
			if (num >= 0 && num <= 99) {
				char buf[8];
				snprintf(buf, sizeof(buf), "sv%02d", num);
				serviceOut = String(buf);
			}
		}
	}
	String payload = "{";
	payload += "\"date\":\"" + date + "\",";
	payload += "\"time\":\"" + timev + "\",";
	payload += "\"phone_number\":\"" + phone + "\",";
	payload += "\"id_number\":\"" + id + "\",";
	payload += "\"service_number\":\"" + serviceOut + "\"";
	payload += "}";

	HTTPClient http;
	http.begin(SERVER_URL);
	http.addHeader("Content-Type", "application/json");
	Serial.println("POST /calls payload:");
	Serial.println(payload);
	int httpCode = http.POST(payload);
	TokenResponse respOut;
	respOut.userid = id;
	respOut.date = date;
	respOut.time = timev;
	if (httpCode > 0) {
		String resp = http.getString();
		Serial.print("Response ("); Serial.print(httpCode); Serial.println("):");
		Serial.println(resp);
		auto extractField = [&](const char *field) {
			String key = String("\"") + field + "\":\"";
			int pos = resp.indexOf(key);
			if (pos == -1) return String("");
			int start = pos + key.length();
			int end = resp.indexOf('"', start);
			if (end > start) return resp.substring(start, end);
			return String("");
		};
		respOut.token = extractField("token");
		respOut.countername = extractField("countername");
		respOut.userid = extractField("userid");
		respOut.date = extractField("date");
		respOut.service = extractField("service");
		respOut.time = extractField("time");
		if (respOut.token.length()) {
			Serial.print("Parsed token: ");
			Serial.println(respOut.token);
		}
	}
	http.end();
	if (httpCode <= 0) {
		oledPrint("HTTP failed", String(httpCode));
		return {};
	}
	if (respOut.token.length()) {
		String line2 = String("ID: ") + respOut.userid;
		String line3 = String("Counter: ") + respOut.countername;
		String line4 = String("Date: ") + respOut.date;
		oledPrint(String("Token: ") + respOut.token, line2, line3, line4);
	} else {
		oledPrint("No token", String(httpCode));
	}
	return respOut;
}

void sendSmsToken(const String &phone, const TokenResponse &resp) {
	if (phone.length() == 0 || resp.token.length() == 0) return;
	String msg = "Thank you for using queue managment system!\n";
	msg += "Token  - " + resp.token + "\n";
	msg += "ID - " + resp.userid + "\n";
	msg += "Counter - " + (resp.countername.length() ? resp.countername : String("")) + "\n";
	msg += "Date - " + resp.date;
	// Basic SMS send over SIM800
	sim800Send("AT+CMGF=1");
	sim800WaitFor("OK", 2000);
	String cmd = String("AT+CMGS=\"") + phone + "\"";
	sim800Send(cmd.c_str());
	sim800WaitFor(">", 2000);
	sim800.print(msg);
	sim800.write(26); // Ctrl+Z
	sim800WaitFor("OK", 5000);
}

void logCallToSD(const TokenResponse &resp, const String &phone) {
	if (resp.date.length() == 0) return;
	SD.mkdir("/call_log");
	String fname = String("/call_log/") + resp.date + ".txt";
	File f = SD.open(fname, FILE_APPEND);
	if (!f) {
		Serial.println("Failed to open call log file");
		return;
	}
	String line;
	line.reserve(128);
	line += phone;
	line += ",";
	line += resp.time;
	line += ",";
	line += resp.userid;
	line += ",";
	line += resp.service;
	line += ",";
	line += resp.countername;
	line += "\n";
	f.print(line);
	f.close();
}

void oledPrint(const String &line1, const String &line2, const String &line3, const String &line4) {
	display.clearDisplay();
	display.setTextSize(1);
	display.setTextColor(SSD1306_WHITE);
	// Row 1
	display.setCursor(0, 0);
	display.println(line1);
	// Row 2 (gap)
	if (line2.length()) {
		display.setCursor(0, 12);
		display.println(line2);
	}
	// Row 3 (gap)
	if (line3.length()) {
		display.setCursor(0, 24);
		display.println(line3);
	}
	// Row 4 (gap)
	if (line4.length()) {
		display.setCursor(0, 36);
		display.println(line4);
	}
	display.display();
}

// Always keep caller number on first row
void oledStatus(const String &callerNumber, const String &row2 = "", const String &row3 = "", const String &row4 = "") {
	oledPrint(String("Number: ") + callerNumber, row2, row3, row4);
}

bool waitForSD(unsigned long timeoutMs = 10000) {
	oledPrint("Checking SD... ");
	SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
	unsigned long start = millis();
	while (millis() - start < timeoutMs) {
		if (SD.begin(SD_CS)) {
			oledPrint("SD OK", "Card ready");
			return true;
		}
		delay(250);
	}
	oledPrint("SD FAIL");
	return false;
}

bool initAudioI2S() {
	oledPrint("Init DAC (GPIO25)...");
	// Use internal DAC mode instead of external MAX98357A I2S amp
	out = new AudioOutputI2S(0, AudioOutputI2S::INTERNAL_DAC);
	// Keep levels modest for onboard DAC
	out->SetGain(0.2);
	// Force mono output (use single DAC pin)
	out->SetOutputModeMono(true);
	out->SetChannels(1);
	oledPrint("DAC OK");
	return true;
}

void sim800Send(const char *cmd) {
	sim800.print(cmd);
	sim800.print("\r\n");
}

bool sim800WaitFor(const char *token, unsigned long timeoutMs) {
	unsigned long start = millis();
	String buf;
	while (millis() - start < timeoutMs) {
		while (sim800.available()) {
			char c = sim800.read();
			buf += c;
			if (buf.indexOf(token) != -1) return true;
		}
	}
	return false;
}

String sim800ReadLine(unsigned long timeoutMs = 2000) {
	unsigned long start = millis();
	String line;
	while (millis() - start < timeoutMs) {
		while (sim800.available()) {
			char c = sim800.read();
			if (c == '\n') return line;
			if (c != '\r') line += c;
		}
	}
	return line;
}

bool waitForSIM800Ready() {
	pinMode(SIM800_POWER, OUTPUT);
  	digitalWrite(SIM800_POWER, LOW);      // pull LOW for 1 second
  	delay(1000);
  	pinMode(SIM800_POWER, INPUT_PULLUP);
	delay(100); // wait for power up
	oledPrint("Init SIM800L...");
	pinMode(SIM800_RESET, OUTPUT);
	digitalWrite(SIM800_RESET, HIGH);
	sim800.begin(SIM800_BAUD, SERIAL_8N1, SIM800_RX, SIM800_TX);
	delay(500);
	// Basic AT check loop
	unsigned long start = millis();
	while (millis() - start < 10000) {
		sim800Send("AT");
		if (sim800WaitFor("OK", 1000)) {
			oledPrint("SIM800 OK");
			return true;
		}
		delay(500);
	}
	oledPrint("SIM800 FAIL");
	return false;
}

bool waitForNetwork() {
	oledPrint("Waiting network...");
	// Disable echo
	sim800Send("ATE0"); sim800WaitFor("OK", 1000);
	// Set numeric format for operator
	sim800Send("AT+COPS=0"); // auto select operator
	// Wait for registration
	unsigned long start = millis();
	while (millis() - start < 30000) {
		sim800Send("AT+CREG?\r");
		if (sim800WaitFor("+CREG:", 1000)) {
			// Read buffer
		}
		// Alternative: use AT+CSQ to ensure modem responsive
		sim800Send("AT+CSQ");
		sim800WaitFor("OK", 1000);
		sim800Send("AT+CREG?\r");
		String resp = "";
		unsigned long t0 = millis();
		while (millis() - t0 < 1000) {
			while (sim800.available()) resp += (char)sim800.read();
		}
		if (resp.indexOf("+CREG: ") != -1 && (resp.indexOf(",1") != -1 || resp.indexOf(",5") != -1)) {
			oledPrint("Network OK");
			return true;
		}
		delay(1000);
	}
	oledPrint("Network FAIL");
	return false;
}

String getCarrier() {
	sim800Send("AT+COPS?");
	String resp;
	unsigned long t0 = millis();
	while (millis() - t0 < 2000) {
		while (sim800.available()) resp += (char)sim800.read();
	}
	// Response: +COPS: <mode>,<format>,<oper>
	int idx = resp.indexOf("+COPS:");
	if (idx != -1) {
		int newline = resp.indexOf('\n', idx);
		String line = newline != -1 ? resp.substring(idx, newline) : resp.substring(idx);
		int lastComma = line.lastIndexOf(',');
		if (lastComma != -1 && lastComma + 1 < (int)line.length()) {
			String oper = line.substring(lastComma + 1);
			oper.trim();
			oper.replace('"', ' ');
			oper.trim();
			return oper;
		}
	}
	return String("Unknown");
}

void playWav(const char *path) {
	if (wav && wav->isRunning()) wav->stop();
	if (file) { delete file; file = nullptr; }
	file = new AudioFileSourceSD(path);
	if (!file || !file->isOpen()) {
		oledPrint("WAV open fail", path);
		return;
	}
	if (!wav) wav = new AudioGeneratorWAV();
	if (!out) initAudioI2S();
	wav->begin(file, out);
}

// Capture 12-digit DTMF code followed by '#'. Shows progress on OLED.
String captureDTMF(uint32_t timeoutMs, const String &caller) {
	sim800Send("AT+DDET=1");
	sim800WaitFor("OK", 1000);
	String code = "";
	bool hashPressed = false;
	unsigned long start = millis();
	oledStatus(caller, String("id: ") + code, "Press # to confirm");
	while (millis() - start < timeoutMs) {
		if (sim800.available()) {
			String line = sim800ReadLine(500);
			if (line.indexOf("+DTMF:") != -1) {
				int colon = line.indexOf(':');
				if (colon != -1) {
					String tok = line.substring(colon + 1);
					tok.trim();
					if (tok.length() > 0) {
						char d = tok[0];
						if (d >= '0' && d <= '9') {
							if (code.length() < 12) {
								code += d;
								oledStatus(caller, String("id: ") + code, "Press # to confirm");
							}
						} else if (d == '#') {
							hashPressed = true;
							break;
						}
					}
				}
			} else if (line.indexOf("NO CARRIER") != -1) {
				break;
			}
		}
		delay(20);
	}
	sim800Send("AT+DDET=0");
	sim800WaitFor("OK", 500);
	if (hashPressed && code.length() == 12) return code;
	return String("");
}

// After # entered, play sv01..sv09 and allow single-digit selection
char playServiceSequence(const String &caller, const String &id) {
	// Enable DTMF detection during playback
	sim800Send("AT+DDET=1");
	sim800WaitFor("OK", 1000);
	char selected = '\0';
	for (int i = 1; i <= 9; ++i) {
		char fname[64];
		snprintf(fname, sizeof(fname), "/audio_files/services/sv%02d.wav", i);
		// Row2: always show id; Row3: playing file
		oledStatus(caller, String("id: ") + id, String("Playing sv") + (i < 10 ? "0" : "") + String(i));
		playWav(fname);
		unsigned long lastRun = millis();
		bool callEnded = false;
		while (true) {
			if (wav && wav->isRunning()) { wav->loop(); lastRun = millis(); }
			if (sim800.available()) {
				String l = sim800ReadLine(200);
				if (l.indexOf("+DTMF:") != -1) {
					int colon = l.indexOf(':');
					if (colon != -1) {
						String tok = l.substring(colon + 1);
						tok.trim();
						if (tok.length() > 0) {
							char d = tok[0];
							if (d >= '0' && d <= '9') {
								selected = d;
								// Stop current playback on selection
								if (wav && wav->isRunning()) wav->stop();
								// Row3: show entered number labeled
								oledStatus(caller, String("id: ") + id, String("Service No: ") + selected);
								callEnded = false;
								break; // exit current file loop
							}
						}
					}
				}
				if (l.indexOf("NO CARRIER") != -1 || l.indexOf("BUSY") != -1) { callEnded = true; break; }
			}
			if (!(wav && wav->isRunning()) && millis() - lastRun > 500) break;
		}
		// If user selected a digit, end sequence early
		if (selected >= '0' && selected <= '9') break;
		if (callEnded) break;
	}
	// If user selected a digit during sv01..sv09
		if (selected >= '0' && selected <= '9') {
		oledStatus(caller, String("id: ") + id, String("Service No: ") + selected, "Playing 2.wav");
		playWav("/audio_files/2.wav");
		unsigned long lastRun = millis();
		bool callEnded = false;
		while (true) {
			if (wav && wav->isRunning()) { wav->loop(); lastRun = millis(); }
			if (sim800.available()) {
				String l = sim800ReadLine(200);
				if (l.indexOf("NO CARRIER") != -1 || l.indexOf("BUSY") != -1) { callEnded = true; break; }
			}
			if (!(wav && wav->isRunning()) && millis() - lastRun > 500) break;
		}
			// If call already ended from remote side, just return selected
			if (callEnded) {
				return selected;
			}
			// finished playing confirmation - return selected to caller to handle hangup/json
			return selected;
	}
	// If no selection yet, wait up to 10 seconds for a digit
	{
		unsigned long waitStart = millis();
		selected = '\0';
		bool callEnded = false;
		while (true) {
			if (sim800.available()) {
				String l = sim800ReadLine(200);
				if (l.indexOf("+DTMF:") != -1) {
					int colon = l.indexOf(':');
					if (colon != -1) {
						String tok = l.substring(colon + 1);
						tok.trim();
						if (tok.length() > 0) {
							char d = tok[0];
							if (d >= '0' && d <= '9') { selected = d; break; }
						}
					}
				}
				if (l.indexOf("NO CARRIER") != -1 || l.indexOf("BUSY") != -1) { callEnded = true; break; }
			}
			if (millis() - waitStart > 10000) break; // 10 second timeout
		}
		// Act on selection
		if (callEnded) return selected;
		if (selected == '0') {
			// Repeat sv01..sv09 sequence
			selected = playServiceSequence(caller, id);
			return selected;
		}
		if (selected >= '1' && selected <= '8') {
			oledStatus(caller, String("id: ") + id, String("Service No: ") + selected, "Playing 2.wav");
			playWav("/audio_files/2.wav");
			unsigned long lastRun = millis();
			while (true) {
				if (wav && wav->isRunning()) { wav->loop(); lastRun = millis(); }
				if (sim800.available()) {
					String l = sim800ReadLine(200);
					if (l.indexOf("NO CARRIER") != -1 || l.indexOf("BUSY") != -1) { break; }
				}
				if (!(wav && wav->isRunning()) && millis() - lastRun > 500) break;
			}
			// finished playing confirmation - return selected to caller
			return selected;
		}
		// No input -> return no selection
		return '\0';
	}
	// Default return
	return selected;
}

// Main call handling: answer, play 1.wav, capture ID, then services
void waitForCallThenAnswerAndPlay() {
	// Update date/time before handling calls
	String _date, _time;
	refreshDateTime(_date, _time);
	oledPrint("Waiting for call...");
	// Enable caller ID
	sim800Send("AT+CLIP=1"); sim800WaitFor("OK", 1000);
	String caller = "";
	while (true) {
		if (sim800.available()) {
			String line = sim800ReadLine(1000);
			if (line.indexOf("RING") != -1) {
				// Next line typically: +CLIP: "<number>",...
				unsigned long t0 = millis();
				while (millis() - t0 < 2000) {
					String l2 = sim800ReadLine(500);
					if (l2.indexOf("+CLIP:") != -1) {
						int q1 = l2.indexOf('"');
						int q2 = l2.indexOf('"', q1 + 1);
						if (q1 != -1 && q2 != -1) caller = l2.substring(q1 + 1, q2);
						break;
					}
				}
				oledPrint("Incoming call", "Answering in 2s...");
				delay(2000);
				// Answer
				sim800Send("ATA");
				sim800WaitFor("OK", 2000);
				// Play 1.wav and keep number on row1
				oledStatus(caller, "Playing 1.wav");
				playWav("/audio_files/1.wav");
				// Pump audio until finished or call ends
				unsigned long lastRun = millis();
				bool callEnded = false;
				while (true) {
					if (wav && wav->isRunning()) { wav->loop(); lastRun = millis(); }
					if (sim800.available()) {
						String l = sim800ReadLine(200);
						if (l.indexOf("NO CARRIER") != -1 || l.indexOf("BUSY") != -1) { callEnded = true; break; }
					}
					if (!(wav && wav->isRunning()) && millis() - lastRun > 500) break;
				}
				if (callEnded) {
					sim800Send("ATH");
					sim800WaitFor("OK", 2000);
					oledPrint("Call ended");
					delay(1000);
					// Send JSON with no id/service (call dropped early)
					TokenResponse t = sendCallJson(caller, String(""), String(""));
					if (t.token.length()) {
						sendSmsToken(caller, t);
						logCallToSD(t, caller);
					}
					break;
				}

				// Capture 12-digit ID then '#'
				String code = captureDTMF(60000, caller);
				// Show final code on row2
				oledStatus(caller, String("id: ") + code);
				char sel = '\0';
				if (code.length() == 12) {
					sel = playServiceSequence(caller, code);
				}
				// Hang up after finishing
				sim800Send("ATH");
				sim800WaitFor("OK", 2000);
				oledPrint("Call ended");
				delay(1000);
				// Send JSON over WiFi (if configured) and SMS token back to caller
				{
					String service = (sel >= '0' && sel <= '9') ? String(sel) : String("");
					TokenResponse resp = sendCallJson(caller, code, service);
					if (resp.token.length()) {
						sendSmsToken(caller, resp);
						logCallToSD(resp, caller);
					}
				}
				break;
			}
		}
		delay(50);
	}
}


void setup() {
	Serial.begin(115200);
	delay(200);
	// OLED init
	pinMode(SIM800_POWER,INPUT_PULLUP);
	Wire.begin(OLED_SDA, OLED_SCL);
	display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
	//display.setRotation(2); // 180-degree rotation
	display.clearDisplay();
	display.display();

	// 1) Wait for SD OK
	waitForSD();

	// 2) Init MAX98357A
	initAudioI2S();

	// 3) Wait for SIM800 AT OK
	if (!waitForSIM800Ready()) {
		// Keep trying gently
		while (!waitForSIM800Ready()) delay(1000);
	}

	// 4) Wait to connect network
	while (!waitForNetwork()) {
		delay(2000);
	}

	// 5) Connect WiFi (for JSON + NTP) and show carrier/IP/date/time
	String dateStr, timeStr;
	refreshDateTime(dateStr, timeStr);
	String carrier = getCarrier();
	String ip = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString() : String("WiFi not connected");
	oledPrint(carrier, ip, dateStr, timeStr);
	delay(3000);
	display.clearDisplay();
	display.display();
}

void loop() {
	// 7) Wait for call
	waitForCallThenAnswerAndPlay();
	// After handling, small pause
	delay(100);
}