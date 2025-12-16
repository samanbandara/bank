#include <Arduino.h>
#include <FS.h>
#include <SD.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_SSD1306.h>
#include "AudioFileSourceSD.h"
#include "AudioGeneratorMP3.h"
#include "AudioOutputI2S.h"

// ====== OLED Setup ======
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ====== I2S DAC (MAX98357A) ======
#define I2S_BCLK 26
#define I2S_LRC  25
#define I2S_DOUT 27
AudioOutputI2S audioOutput;

// ====== MP3 Player ======
AudioGeneratorMP3 *mp3;
AudioFileSourceSD *file;

// ====== SD Card CS Pin ======
#define SD_CS 5

void setup() {
  Serial.begin(115200);

  // Initialize OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 allocation failed");
    while(true);
  }
  display.clearDisplay();
  display.setTextColor(WHITE);
  display.setTextSize(1);
  display.setCursor(0,0);
  display.println("Initializing...");
  display.display();

  // Initialize SD card
  if(!SD.begin(SD_CS)) {
    Serial.println("SD Card Mount Failed");
    display.println("SD Mount Failed");
    display.display();
    while(true);
  }

  // List MP3 files
  display.println("Files:");
  File root = SD.open("/");
  File entry = root.openNextFile();
  while(entry) {
    String fname = entry.name();
    if(fname.endsWith(".mp3")) {
      display.println(fname);
      Serial.println(fname);
    }
    entry = root.openNextFile();
  }
  display.display();

  // Initialize MP3 player
  file = new AudioFileSourceSD("/example.mp3"); // change to your file name
  audioOutput.begin();
  mp3 = new AudioGeneratorMP3();
  mp3->begin(file, &audioOutput);

  display.clearDisplay();
  display.setCursor(0,0);
  display.println("Playing: example.mp3");
  display.display();
}

void loop() {
  if(mp3->isRunning()) {
    mp3->loop();
  } else {
    Serial.println("MP3 done");
    display.clearDisplay();
    display.setCursor(0,0);
    display.println("Playback finished");
    display.display();
    delay(1000);
    // Restart or pick another file if needed
  }
}
