const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Move collections to top level so they're accessible everywhere
let userCollection, doctorsCollection, reviewsCollection, appointmentCollection;

// Fixed JWT verification
const verifyToken = (req, res, next) => {
  console.log('inside verify token', req.headers.authorization);

  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'Unauthorized Access' });
  }

  const token = req.headers.authorization.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.decoded = decoded;
    next();
  } catch (error) {
    console.error('JWT verification failed:', error);
    return res.status(401).send({ message: 'Unauthorized Access' });
  }
};

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

    // Initialize collections
    userCollection = client.db('doctorsHouse').collection('userCollection');
    doctorsCollection = client.db('doctorsHouse').collection('doctorsCollection');
    reviewsCollection = client.db('doctorsHouse').collection('reviewsCollection'); // Fixed typo
    appointmentCollection = client.db('doctorsHouse').collection('appointmentCollection');

    console.log('Connected to MongoDB collections');

    // Add verifyAdmin inside run function to access collections
    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);

        if (user?.role !== 'admin') {
          return res.status(403).send({ message: 'Forbidden Access' });
        }
        next();
      } catch (error) {
        console.error('Admin verification error:', error);
        return res.status(500).send({ message: 'Internal server error' });
      }
    };

    // JWT related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' });
      res.send({ token });
    });

    // User related APIs
    app.get('/users', async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'Forbidden Access' });
        }

        const query = { email: email };
        const user = await userCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === 'admin';
        }

        res.send({ admin });
      } catch (error) {
        console.error('Error checking admin status:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.post('/users', async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await userCollection.findOne(query);

        if (existingUser) {
          return res.send({ message: 'User already exists', insertedId: null });
        }

        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;

        // Validate ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid user ID' });
        }

        const filter = { _id: new ObjectId(id) };

        // First check if user exists
        const existingUser = await userCollection.findOne(filter);
        if (!existingUser) {
          return res.status(404).send({ message: 'User not found' });
        }

        const updateDoc = {
          $set: { role: 'admin' }
        };

        const result = await userCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount === 0) {
          return res.status(400).send({ message: 'User role update failed' });
        }

        res.send({
          message: 'User promoted to admin successfully',
          ...result
        });
      } catch (error) {
        console.error('Error updating user to admin:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    // Doctors Related APIs
    app.get('/expertDoctors', async (req, res) => {
      try {
        const result = await doctorsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching expert doctors:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.get('/doctors', async (req, res) => {
      try {
        const result = await doctorsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.delete('/doctors/:id', async(req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.deleteOne(doctor);
      res.send(result);
    })

    app.get('/expertDoctors/:id', async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid ID format' });
        }

        const query = { _id: new ObjectId(id) };
        const result = await doctorsCollection.findOne(query); 

        if (!result) {
          return res.status(404).send({ message: 'Doctor not found' });
        }

        res.send(result);
      } catch (error) {
        console.error('Error fetching doctor:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.post('/expertDoctors', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const doctor = req.body;
        const query = { name: doctor.name };
        const existingDoctor = await doctorsCollection.findOne(query);

        if (existingDoctor) {
          return res.send({ message: 'Doctor is already in the list', insertedId: null });
        }

        const result = await doctorsCollection.insertOne(doctor);
        res.send(result);
      } catch (error) {
        console.error('Error adding doctor:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.patch('/expertDoctors/:id', verifyToken, verifyAdmin, async (req, res) => { 
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid ID format' });
        }

        const updateData = req.body;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: updateData };
        const result = await doctorsCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error('Error updating doctor:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    // Reviews Related APIs
    app.get('/reviews', async (req, res) => {
      try {
        const result = await reviewsCollection.find().toArray(); 
        res.send(result);
      } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    // Appointment Related APIs - Fixed duplicate route
    app.post('/appointments', async (req, res) => {
      try {
        const { name, email, date, time, doctorId } = req.body;

        if (!name || !email || !date || !time) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        // Check if appointment exists
        const existing = await appointmentCollection.findOne({
          email,
          date,
          time
        });

        if (existing) {
          await appointmentCollection.deleteOne({ _id: existing._id });
          return res.json({
            message: "Appointment canceled successfully",
            canceledAppointment: existing,
          });
        } else {
          // Create new appointment
          const newAppointment = {
            name,
            email,
            date,
            time,
            doctorId: doctorId || null,
            createdAt: new Date(),
          };

          const result = await appointmentCollection.insertOne(newAppointment);
          return res.json({
            message: "Appointment created successfully",
            appointment: newAppointment,
            insertedId: result.insertedId
          });
        }
      } catch (error) {
        console.error("Appointment error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    // Get all appointments
    app.get("/appointments", async (req, res) => {
      try {
        const list = await appointmentCollection.find().toArray();
        res.json(list);
      } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Doctors House Server is running!');
});

app.listen(port, () => {
  console.log(`Doctors House Server is running on port: ${port}`);
});