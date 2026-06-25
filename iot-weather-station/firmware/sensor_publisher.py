#!/usr/bin/env python3
"""
IoT Weather Station — sensor publisher.

Reads temperature/humidity (DHT22) and air quality (PMS5003) on a Raspberry Pi and
publishes a JSON message to an MQTT topic every few seconds.

Run with real sensors:
    python sensor_publisher.py

Run without hardware (realistic simulated data):
    python sensor_publisher.py --simulate

Config is read from config.json (see config.example.json).
"""

import argparse
import json
import math
import os
import random
import time

import paho.mqtt.client as mqtt

# Optional hardware deps — only imported when not simulating.
# DHT22:   adafruit-circuitpython-dht
# PMS5003: pms5003


def load_config(path="config.json"):
    defaults = {
        "broker_host": "localhost",
        "broker_port": 1883,
        "topic": "amir/iot/weather",
        "interval_seconds": 3,
        "client_id": "rpi-weather-station",
    }
    if os.path.exists(path):
        with open(path) as f:
            defaults.update(json.load(f))
    return defaults


class RealSensors:
    """Thin wrapper around DHT22 + PMS5003. Imports are lazy so simulate mode needs nothing."""

    def __init__(self):
        import board
        import adafruit_dht
        from pms5003 import PMS5003

        self.dht = adafruit_dht.DHT22(board.D4)
        self.pms = PMS5003(device="/dev/serial0", baudrate=9600)

    def read(self):
        temperature = self.dht.temperature
        humidity = self.dht.humidity
        pm25 = self.pms.read().pm_ug_per_m3(2.5)
        return temperature, humidity, float(pm25)


class SimulatedSensors:
    """Smooth random walk that mirrors the dashboard's demo engine."""

    def __init__(self):
        self.t, self.h, self.p = 25.5, 61.0, 16.0
        self.i = 0

    def read(self):
        self.i += 1
        self.t += (random.random() - 0.5) * 0.7 + math.sin(self.i / 6) * 0.18
        self.h += (random.random() - 0.5) * 1.1 - math.sin(self.i / 6) * 0.25
        self.p += (random.random() - 0.5) * 1.6 + math.sin(self.i / 9) * 0.35
        self.t = min(33.0, max(19.0, self.t))
        self.h = min(78.0, max(38.0, self.h))
        self.p = min(52.0, max(5.0, self.p))
        return round(self.t, 1), round(self.h, 1), round(self.p, 1)


def main():
    parser = argparse.ArgumentParser(description="IoT Weather Station publisher")
    parser.add_argument("--simulate", action="store_true",
                        help="generate realistic data instead of reading hardware")
    parser.add_argument("--config", default="config.json")
    args = parser.parse_args()

    cfg = load_config(args.config)
    sensors = SimulatedSensors() if args.simulate else RealSensors()

    client = mqtt.Client(client_id=cfg["client_id"])
    client.connect(cfg["broker_host"], cfg["broker_port"], keepalive=60)
    client.loop_start()

    mode = "SIMULATE" if args.simulate else "LIVE"
    print(f"[{mode}] publishing to {cfg['broker_host']}:{cfg['broker_port']} "
          f"topic '{cfg['topic']}' every {cfg['interval_seconds']}s")

    try:
        while True:
            try:
                temperature, humidity, pm25 = sensors.read()
            except RuntimeError as e:
                # DHT22 reads fail occasionally — skip and retry.
                print("sensor read error:", e)
                time.sleep(cfg["interval_seconds"])
                continue

            payload = {
                "temperature": temperature,
                "humidity": humidity,
                "pm25": pm25,
                "ts": int(time.time()),
            }
            client.publish(cfg["topic"], json.dumps(payload))
            print("published", payload)
            time.sleep(cfg["interval_seconds"])
    except KeyboardInterrupt:
        print("\nstopping…")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
