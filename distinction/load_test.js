const mqtt = require("mqtt");

const client = mqtt.connect("mqtt://broker.hivemq.com:1883");

const topic = "/nath314security82/home1/motion";

let sent = 0;

client.on("connect", () => {
    console.log("Load test connected");
    console.log("Starting increased message workload...");

    const interval = setInterval(() => {
        const deviceNumber = Math.floor(Math.random() * 100) + 1;

        const event = {
            homeId: "home1",
            deviceId: `motion${deviceNumber}`,
            deviceType: "motion",
            value: Math.random() < 0.5 ? "detected" : "clear",
            timestamp: new Date().toISOString()
        };

        client.publish(topic, JSON.stringify(event));

        sent++;

        console.log(`Messages sent: ${sent}`);

        if (sent >= 200) {
            clearInterval(interval);

            console.log(
                "Load test completed. Total messages: " + sent
            );

            setTimeout(() => client.end(), 1000);
        }
    }, 100);
});

client.on("error", (error) => {
    console.log("MQTT Error:", error.message);
});