const mqtt = require("mqtt");

const client = mqtt.connect("mqtt://broker.hivemq.com:1883");
const topic = "/nath314security82/home1/motion";

client.on("connect", () => {
    console.log("Motion sensor connected");

    setInterval(() => {
        const state = Math.random() < 0.4 ? "detected" : "clear";

        const event = {
            homeId: "home1",
            deviceId: "motion01",
            deviceType: "motion",
            value: state,
            timestamp: new Date().toISOString()
        };

        client.publish(topic, JSON.stringify(event));

        console.log("Motion event:", event);
    }, 3000);
});

client.on("error", (error) => {
    console.log("MQTT Error:", error.message);
});