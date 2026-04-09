const cors = require('cors');
const express = require('express');
const amqp = require('amqplib');
const client = require('prom-client');

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Prometheus metrics setup
client.collectDefaultMetrics();

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

const RABBITMQ_URL = 'amqp://rabbitmq';

let channel;

// 🔹 Connect to RabbitMQ (with retry)
async function connectQueue() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        await channel.assertQueue('events');

        console.log("Event Service connected to RabbitMQ ✅");

    } catch (error) {
        console.log("RabbitMQ connection failed ❌ retrying...");
        setTimeout(connectQueue, 5000);
    }
}

connectQueue();

// 🔹 Send event
app.post('/event', async (req, res) => {
    const event = req.body;

    console.log("Incoming event:", event);

    if (!channel) {
        console.log("❌ Channel not ready");
        return res.status(500).json({ error: "Queue not ready" });
    }

    channel.sendToQueue('events', Buffer.from(JSON.stringify(event)));

    console.log("✅ Event sent to RabbitMQ");

    res.json({ message: "Event sent to queue", event });
});

// 🔹 Start server
app.listen(3002, () => console.log("Event service running 🚀"));