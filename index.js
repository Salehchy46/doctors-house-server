const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vu0s8qh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    // Collections
    const userCollection = client.db('doctorsHouse').collection('userCollection');
    const doctorsCollection = client.db('doctorsHouse').collection('doctorsCollection');
    const reviewsCollectio = client.db('doctorsHouse').collection('reviewsCollection');
    const appointmentCollection = client.db('doctorsHouse').collection('appointmentCollection');

    //User related APIs;

    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      //insert email  if user is not in the database;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Doctors Related APIs

    app.get('/expertDoctors', async (req, res) => {
      const result = await doctorsCollection.find().toArray();
      res.send(result);
    })

    app.get('/expertDoctors/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await doctorsCollection.find(query).toArray();
      res.send(result);
    })

    app.post('expertDoctors', async(req, res) => {
      const doctor = req.body;
      const query = {name : doctor.name};
      const existingDoctor = await doctorsCollection.findOne(query);
      if(existingDoctor) {
        return res.send({message: 'Doctor is already in the list', insertedId: null})
      }
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    })

    app.patch('expertDoctors/:id', async(req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {$set : updateData};
      const result = await doctorsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    //Reviews Related APIs

    app.get('/reviews', async (req, res) => {
      const result = await reviewsCollectio.find().toArray();
      res.send(result);
    })

    // Appointment Related APIs
    app.post('/appointments', async (req, res) => {
      const appointment = req.body;
      const result = await appointmentCollection.insertOne(appointment);
      res.send(result);
    })

    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } finally {
    // do not close
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Doctors are coming soon');
});

app.listen(port, () => {
  console.log(`Doctors are waiting at port: ${port}`);
});
