require("dotenv").config();

const mqtt = require("mqtt");
const {
  SQSClient,
  SendMessageCommand
} = require("@aws-sdk/client-sqs");

const MQTT_BROKER = "mqtt://broker.hivemq.com:1883";

// Matches the MQTT topic used by the existing Distinction project sensors
const MQTT_TOPIC = "/nath314security82/#";

const sqs = new SQSClient({
  region: process.env.AWS_REGION
});

const mqttClient = mqtt.connect(MQTT_BROKER);

let forwardedCount = 0;

mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");

  mqttClient.subscribe(MQTT_TOPIC, (error) => {
    if (error) {
      console.error("MQTT subscribe error:", error);
      return;
    }

    console.log(`Subscribed to ${MQTT_TOPIC}`);
    console.log("Waiting for smart-home sensor events...");
  });
});

mqttClient.on("message", async (topic, message) => {
  try {
    const rawMessage = message.toString();

    let sensorEvent;

    try {
      sensorEvent = JSON.parse(rawMessage);
    } catch {
      console.log("Ignored non-JSON MQTT message");
      return;
    }

    const queuedEvent = {
      ...sensorEvent,
      mqttTopic: topic,
      queuedAt: new Date().toISOString()
    };

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: process.env.EVENTS_QUEUE_URL,
        MessageBody: JSON.stringify(queuedEvent)
      })
    );

    forwardedCount++;

    console.log(
      `Forwarded ${forwardedCount} | ` +
      `${sensorEvent.deviceType || "sensor"} | ` +
      `${sensorEvent.deviceId || "unknown"} -> SQS`
    );

  } catch (error) {
    console.error("Failed to forward event to SQS:");
    console.error(error);
  }
});

mqttClient.on("error", (error) => {
  console.error("MQTT error:", error);
});