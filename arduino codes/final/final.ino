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

// ------------------- SIM800 Setup -------------------
HardwareSerial sim800(1);
#define SIM800_RX 32
#define SIM800_TX 33
#define SIM800_RESET 14
#define SIM800_BAUD 9600

// ------------------- Sd card Setup -------------------
#define SD_CS 5     // SD card chip select
#define SD_MOSI 23  // SPI MOSI
#define SD_MISO 19  // SPI MISO
#define SD_SCK 18   // SPI SCK

// ------------------- MAX98357A Setup -------------------
#define I2S_BCLK 26
#define I2S_LRC 25
#define I2S_DOUT 27

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
void playServiceSequence(const String &caller, const String &id);
void waitForCallThenAnswerAndPlay();

void oledPrint(const String &line1, const String &line2 = "", const String &line3 = "", const String &line4 = "") {
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
	oledPrint("Init MAX98357A...");
	out = new AudioOutputI2S();
	// Set pins for ESP32 I2S external DAC/amp
	out->SetPinout(I2S_BCLK, I2S_LRC, I2S_DOUT);
	out->SetGain(0.2);
	oledPrint("MAX98357A OK");
	return true;
}

void sim800Send(const char *cmd) {
	sim800.print(cmd);
	sim800.print("\r\n");
}

bool sim800WaitFor(const char *token, unsigned long timeoutMs = 5000) {
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
void playServiceSequence(const String &caller, const String &id) {
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
		if (callEnded) return;
		if (selected == '0') {
			// Repeat sv01..sv09 sequence
			playServiceSequence(caller, id);
			return;
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
			return;
		}
		// No input -> hang up
		sim800Send("ATH");
		sim800WaitFor("OK", 2000);
		oledPrint("Call ended");
		delay(1000);
		return;
	}
}

// Main call handling: answer, play 1.wav, capture ID, then services
void waitForCallThenAnswerAndPlay() {
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
					break;
				}

				// Capture 12-digit ID then '#'
				String code = captureDTMF(60000, caller);
				// Show final code on row2
				oledStatus(caller, String("id: ") + code);
				if (code.length() == 12) {
					playServiceSequence(caller, code);
				}
				// Hang up after finishing
				sim800Send("ATH");
				sim800WaitFor("OK", 2000);
				oledPrint("Call ended");
				delay(1000);
				break;
			}
		}
		delay(50);
	}
}


void setup() {
	// OLED init
	Wire.begin(OLED_SDA, OLED_SCL);
	display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
	display.setRotation(2); // 180-degree rotation
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

	// 5) Show carrier
	String carrier = getCarrier();
	oledPrint(carrier);
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

