const express = require('express')
const cors = require('cors');
const app = express()
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const query = require('express/lib/middleware/query');
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8t2hr.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' });
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const serviceCollectino = client.db("doctors_portal").collection("services");
        const bookingCollectino = client.db("doctors_portal").collection("booking");
        const userCollectino = client.db("doctors_portal").collection("users");

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollectino.find(query);
            const services = await cursor.toArray();
            res.send(services);
        });

        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const booking = await bookingCollectino.find(query).toArray();
                return res.send(booking);
            }
            else{
                return res.status(403).send({message: 'Forbidden Access'});
            }
        });

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollectino.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient };
            const exist = await bookingCollectino.findOne(query);
            if (exist) {
                return res.send({ success: false, booking: exist });
            }
            const result = await bookingCollectino.insertOne(booking);
            return res.send({ success: true, result });
        });

        app.get('/available', async (req, res) => {
            const date = req.query.date;

            const services = await serviceCollectino.find().toArray();

            const query = { date: date };
            const booking = await bookingCollectino.find(query).toArray();

            services.forEach(service => {
                const serviceBooking = booking.filter(book => book.treatment === service.name);
                const bookedSlots = serviceBooking.map(book => book.slot);
                // // service.booked = booked;
                // service.booked = serviceBooking.map(s => s.slot);
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                service.slots = available;
            });

            res.send(services);
        })

    }
    finally {

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from final project!')
})

app.listen(port, () => {
    console.log(`Final project listening on port ${port}`)
})