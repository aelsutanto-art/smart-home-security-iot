const mqtt = require("mqtt");

const client = mqtt.connect("mqtt://broker.hivemq.com:1883");
const topic = "/nath314security82/home1/door";

client.on("connect", () => {
    console.log("Door sensor connected");

    setInterval(() => {
        const state = Math.random() < 0.35 ? "open" : "closed";

        const event = {
            homeId: "home1",
            deviceId: "door01",
            deviceType: "door",
            value: state,
            timestamp: new Date().toISOString()
        };

        client.publish(topic, JSON.stringify(event));

        console.log("Door event:", event);
    }, 3000);
});

client.on("error", (error) => {
    console.log("MQTT Error:", error.message);
});