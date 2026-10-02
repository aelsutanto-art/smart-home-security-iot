const mqtt = require("mqtt");

const client = mqtt.connect("mqtt://broker.hivemq.com:1883");
const topic = "/nath314security82/home1/smoke";

client.on("connect", () => {
    console.log("Smoke sensor connected");

    setInterval(() => {
        const smokeLevel = Math.floor(Math.random() * 20);

        const event = {
            homeId: "home1",
            deviceId: "smoke01",
            deviceType: "smoke",
            value: smokeLevel,
            timestamp: new Date().toISOString()
        };

        client.publish(topic, JSON.stringify(event));

        console.log("Smoke event:", event);
    }, 3000);
});

client.on("error", (error) => {
    console.log("MQTT Error:", error.message);
});