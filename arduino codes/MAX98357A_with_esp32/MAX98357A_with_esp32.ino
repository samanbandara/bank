#include "ESP_I2S.h"
#include "BluetoothA2DPSink.h"

// I2S Pins
const uint8_t I2S_WS = 25;
const uint8_t I2S_SCK = 26;
const uint8_t I2S_SDOUT = 27;

// Bluetooth + I2S
I2SClass i2s;
BluetoothA2DPSink a2dp_sink(i2s);

// State
bool isPlaying = false;
String currentSong = "No Song";
int currentVolume = 0;  // 0–100 %
unsigned long lastScroll = 0;
int scrollIndex = 0;

// --- Print All Info on Serial ---
void updateSerial() {
    Serial.println("\n==============================");
    Serial.print("Song: ");
    Serial.println(currentSong);

    Serial.print("State: ");
    Serial.println(isPlaying ? "Playing" : "Paused");

    Serial.print("Volume: ");
    Serial.print(currentVolume);
    Serial.println("%");

    Serial.println("==============================\n");
}

void setup() {
    Serial.begin(115200);
    Serial.println("ESP32 Speaker Booting...");
    delay(1000);

    // I2S Initialize
    i2s.setPins(I2S_SCK, I2S_WS, I2S_SDOUT);
    if (!i2s.begin(I2S_MODE_STD, 44100, I2S_DATA_BIT_WIDTH_16BIT,
                   I2S_SLOT_MODE_STEREO, I2S_STD_SLOT_BOTH)) {
        Serial.println("❌ I2S Init Failed!");
        while (1);
    }

    // Bluetooth connection status
    a2dp_sink.set_on_connection_state_changed([](esp_a2d_connection_state_t state, void *) {
        if (state == ESP_A2D_CONNECTION_STATE_CONNECTED) {
            Serial.println("\n📱 Device Connected");
            isPlaying = true;
        } else {
            Serial.println("\n🔌 Device Disconnected");
            isPlaying = false;
            currentSong = "No Song";
        }
        updateSerial();
    });

    // Metadata (song title)
    a2dp_sink.set_avrc_metadata_callback([](uint8_t attr_id, const uint8_t *attr_text) {
        if (attr_id == ESP_AVRC_MD_ATTR_TITLE) {
            currentSong = String((char *)attr_text);
            scrollIndex = 0;
            Serial.println("\n🎵 Now Playing: " + currentSong);
            updateSerial();
        }
    });

    // Volume change from phone
    a2dp_sink.set_avrc_rn_volumechange([](int vol) {
        currentVolume = map(vol, 0, 127, 0, 100);
        Serial.printf("\n🔊 Volume Updated: %d %%\n", currentVolume);
        updateSerial();
    });

    // Start Bluetooth
    a2dp_sink.start("ESP32-Speaker");
    Serial.println("\nBluetooth Ready! Pair as 'ESP32-Speaker'");
}

void loop() {
}
