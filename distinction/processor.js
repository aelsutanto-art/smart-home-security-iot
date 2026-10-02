require("dotenv").config();

const os = require("os");

const {
    SQSClient,
    ReceiveMessageCommand,
    DeleteMessageCommand,
    SendMessageCommand
} = require("@aws-sdk/client-sqs");

const sqs = new SQSClient({
    region: process.env.AWS_REGION
});

const EVENTS_QUEUE_URL = process.env.EVENTS_QUEUE_URL;
const RESULTS_QUEUE_URL = process.env.RESULTS_QUEUE_URL;

const PROCESSING_DELAY_MS =
    Number(process.env.PROCESSING_DELAY_MS) || 200;

const WORKER_ID =
    process.env.WORKER_ID || os.hostname();

let processedCount = 0;
let totalLatency = 0;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function checkSecurityRule(event) {
    if (
        event.deviceType === "door" &&
        event.value === "open"
    ) {
        return {
            alert: true,
            severity: "WARNING",
            message: `Door opened - ${event.deviceId}`
        };
    }

    if (
        event.deviceType === "motion" &&
        event.value === "detected"
    ) {
        return {
            alert: true,
            severity: "WARNING",
            message: `Motion detected - ${event.deviceId}`
        };
    }

    if (
        event.deviceType === "smoke" &&
        Number(event.value) > 10
    ) {
        return {
            alert: true,
            severity: "CRITICAL",
            message: `High smoke level - ${event.deviceId}`
        };
    }

    return {
        alert: false,
        severity: "NORMAL",
        message: "No security alert"
    };
}

async function processMessage(message) {
    const event = JSON.parse(message.Body);

    const processingStartedAt = new Date();

    // Simulated work performed by the processing service.
    await sleep(PROCESSING_DELAY_MS);

    const decision = checkSecurityRule(event);

    const processedAt = new Date();

    const queuedTime = new Date(event.queuedAt).getTime();

    const latencyMs =
        processedAt.getTime() - queuedTime;

    const result = {
        homeId: event.homeId,
        deviceId: event.deviceId,
        deviceType: event.deviceType,
        value: event.value,

        alert: decision.alert,
        severity: decision.severity,
        alertMessage: decision.message,

        sensorTimestamp: event.timestamp,
        queuedAt: event.queuedAt,
        processingStartedAt:
            processingStartedAt.toISOString(),
        processedAt:
            processedAt.toISOString(),

        latencyMs: latencyMs,

        workerId: WORKER_ID
    };

    await sqs.send(
        new SendMessageCommand({
            QueueUrl: RESULTS_QUEUE_URL,
            MessageBody: JSON.stringify(result)
        })
    );

    await sqs.send(
        new DeleteMessageCommand({
            QueueUrl: EVENTS_QUEUE_URL,
            ReceiptHandle: message.ReceiptHandle
        })
    );

    processedCount++;
    totalLatency += latencyMs;

    const averageLatency =
        Math.round(totalLatency / processedCount);

    console.log(
        `Processed ${processedCount}` +
        ` | ${event.deviceType}` +
        ` | ${event.deviceId}` +
        ` | ${decision.severity}` +
        ` | latency ${latencyMs} ms` +
        ` | avg ${averageLatency} ms` +
        ` | worker ${WORKER_ID}`
    );
}

async function pollQueue() {
    console.log("Smart Home Security Processor");
    console.log(`Worker: ${WORKER_ID}`);
    console.log(
        `Processing delay: ${PROCESSING_DELAY_MS} ms`
    );
    console.log("Waiting for SQS events...\n");

    while (true) {
        try {
            const response = await sqs.send(
                new ReceiveMessageCommand({
                    QueueUrl: EVENTS_QUEUE_URL,

                    MaxNumberOfMessages: 1,

                    WaitTimeSeconds: 10,

                    VisibilityTimeout: 30
                })
            );

            if (!response.Messages) {
                continue;
            }

            for (const message of response.Messages) {
                await processMessage(message);
            }

        } catch (error) {
            console.error("Processor error:");
            console.error(error);

            await sleep(2000);
        }
    }
}

pollQueue();