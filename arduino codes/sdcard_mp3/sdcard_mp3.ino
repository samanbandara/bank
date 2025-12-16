#define LOG_LOCAL_LEVEL ESP_LOG_NONE
#include "esp_log.h"

#include <Arduino.h>
#include <AudioFileSourceSD.h>
#include <AudioGeneratorMP3.h>
#include <AudioOutputI2S.h>
#include <SPI.h>
#include <SD.h>

#define SD_CS 5

// I2S pins
#define I2S_BCLK 26
#define I2S_LRC  25
#define I2S_DOUT 27

AudioGeneratorMP3 *mp3;
AudioFileSourceSD *file;
AudioOutputI2S *out;

String mp3List[50];
int totalFiles = 0;
int currentFile = 0;

// For single file play
int singleFileRepeat = 0;
String singleFileName = "";
bool singleFileMode = false;

void loadMP3Files() {
  File root = SD.open("/");
  File entry;
  totalFiles = 0;

  while ((entry = root.openNextFile())) {
    String name = String(entry.name());
    name.toLowerCase();
    if (name.endsWith(".mp3")) {
      mp3List[totalFiles] = "/" + String(entry.name());
      Serial.println("Found: " + mp3List[totalFiles]);
      totalFiles++;
    }
    entry.close();
  }
  root.close();
}

void playFile(const String &name) {
  for (int i = 0; i < totalFiles; i++) {
    if (mp3List[i].endsWith(name)) {
      currentFile = i;
      delete file;
      file = new AudioFileSourceSD(mp3List[currentFile].c_str());
      mp3->begin(file, out);
      return;
    }
  }
  Serial.println("File not found: " + name);
}

void setup() {
  Serial.begin(115200);
  delay(500);

  esp_log_level_set("*", ESP_LOG_NONE);

  if (!SD.begin(SD_CS)) {
    Serial.println("SD card mount failed!");
    while (1);
  }

  out = new AudioOutputI2S(0, AudioOutputI2S::EXTERNAL_I2S);
  out->SetPinout(I2S_BCLK, I2S_LRC, I2S_DOUT);
  out->SetGain(0.9);

  mp3 = new AudioGeneratorMP3();

  loadMP3Files();
  if (totalFiles == 0) {
    Serial.println("No MP3 found!");
    while (1);
  }
}

// ------------------- FUNCTIONS YOU CALL IN LOOP -------------------

// Play all files continuously
void playAll() {
  if (singleFileMode) return; // if a single file is playing, ignore

  if (mp3->isRunning()) {
    if (!mp3->loop()) {  // file finished
      mp3->stop();
      delete file;
      currentFile++;
      if (currentFile >= totalFiles) currentFile = 0;
      file = new AudioFileSourceSD(mp3List[currentFile].c_str());
      mp3->begin(file, out);
    }
  } else {
    // first run: start the current file
    file = new AudioFileSourceSD(mp3List[currentFile].c_str());
    mp3->begin(file, out);
  }
}


// Play a specific file N times
void play(const String &name, int times = 1) {
  if (!singleFileMode) {
    singleFileMode = true;
    singleFileName = name;
    singleFileRepeat = times;
    playFile(singleFileName);
    return;
  }

  if (!mp3->loop()) {   // finished current repetition
    mp3->stop();
    singleFileRepeat--;
    if (singleFileRepeat > 0) {
      delete file;
      playFile(singleFileName); // repeat
    } else {
      singleFileMode = false;
      currentFile++;
      if (currentFile >= totalFiles) currentFile = 0;
      delete file;
      playFile(mp3List[currentFile]); // resume playlist
    }
  }
}


// ------------------- LOOP -------------------
void loop() {
  out->SetGain(0.8);
  playAll();
  //play("Oya Muwe Hasaral _ ඔය මුවේ හසරැල් (Slow & Reverb.mp3");
  //play("PEM BANDA _ පෙම් බැන්ද සිත් බැන්ද - EDM @REVIBESL-k3c.mp3");
  //play("ZOORY _ Yamu Sella Katharagama _ යමු සෙල්ල කතරගම EDM Cover.mp3");
}