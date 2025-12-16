#include <Arduino.h>

HardwareSerial sim800(1);

#define SIM800_RX 32
#define SIM800_TX 33
#define SIM800_BAUD 9600

bool callActive = false;

void setup() {
  Serial.begin(115200);  // Serial Monitor
  sim800.begin(SIM800_BAUD, SERIAL_8N1, SIM800_RX, SIM800_TX);

  Serial.println("SIM800 AT Command Passthrough Ready");


  while (true) {
    sim800.println("AT+CPIN?");
    String resp1 = readClean();
    String simState = "";
    if (resp.indexOf("+CPIN:") != -1) {
      if (resp1.indexOf("READY") != -1) {
        simState = "SIM Ready";
        oled.fillRect(0, 27, 128, 37, SSD1306_BLACK);
        oled.setCursor(0, 27);
        Serial.println(simState);
        oled.println(simState);
        oled.display();
        break;
      } else if (resp1.indexOf("SIM PIN") != -1) {
        simState = "SIM PIN required";
      } else if (resp1.indexOf("SIM PUK") != -1) {
        simState = "SIM PUK required";
      } else if (resp1.indexOf("NOT INSERTED") != -1) {
        simState = "SIM not inserted";
      } else {
        simState = "SIM Error";
      }
    }
    oled.setCursor(0, 27);
    Serial.println(simState);
    oled.println(simState);
    oled.display();
  }
}






String readClean(long timeout = 200) {
  String resp = "";
  long start = millis();

  while (millis() - start < timeout) {
    while (sim800.available()) {
      char c = sim800.read();  // read one character at a time
      resp += c;
    }
    vTaskDelay(1 / portTICK_PERIOD_MS);
  }

  resp.trim();

  // Remove line breaks
  resp.replace("\r", "");
  resp.replace("\n", "");

  // Optional: remove trailing OK
  /*if (resp.endsWith("OK")) {
    resp = resp.substring(0, resp.length() - 2);
    resp.trim();
  }*/

  return resp;
}

void loop() {
}