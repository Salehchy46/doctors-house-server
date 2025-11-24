const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: 'Unauthorized Access' });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }

    req.decoded = decoded;
    next();
  });
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
    
    // Collections
    const userCollection = client.db('doctorsHouse').collection('userCollection');
    const doctorsCollection = client.db('doctorsHouse').collection('doctorsCollection');
    const reviewsCollection = client.db('doctorsHouse').collection('reviewsCollection'); // Fixed typo
    const appointmentCollection = client.db('doctorsHouse').collection('appointmentCollection');

    // Verify Admin Middleware - defined AFTER collections
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
        return res.status(500).send({ message: 'Server error during admin verification' });
      }
    };

    // JWT related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5hr' })
      res.send({ token });
    })

    // User related APIs
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send({ message: 'Server error' });
      }
    })

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'Forbidden Access' })
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
    })

    app.post('/users', async (req, res) => {
      try {
        const user = req.body;
        // Insert email if user is not in the database
        const query = { email: user.email };
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: 'user already exists', insertedId: null })
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
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: 'admin'
          }
        }
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error('Error promoting user to admin:', error);
        res.status(500).send({ message: 'Server error' });
      }
    })

    // Doctors Related APIs
    app.get('/expertDoctors', async (req, res) => {
      const result = await doctorsCollection.find().toArray();
      res.send(result);
    })

    app.get('/doctors', async (req, res) => {
      const result = await doctorsCollection.find().toArray();
      res.send(result);
    })

    app.get('/expertDoctors/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await doctorsCollection.findOne(query); // Use findOne instead of find
      res.send(result);
    })

    app.post('/expertDoctors', async (req, res) => {
      const doctor = req.body;
      const query = { name: doctor.name };
      const existingDoctor = await doctorsCollection.findOne(query);
      if (existingDoctor) {
        return res.send({ message: 'Doctor is already in the list', insertedId: null })
      }
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    })

    // Fixed missing slash in route
    app.patch('/expertDoctors/:id', async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = { $set: updateData };
      const result = await doctorsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // Reviews Related APIs
    app.get('/reviews', async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    })

    // Appointment Related APIs - Single fixed route
    app.post('/appointments', async (req, res) => {
      try {
        const { name, email, date, time } = req.body;
        
        if (!name || !email || !date || !time) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        // Check if appointment exists
        const existing = await appointmentCollection.findOne({ email, date, time });

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
            createdAt: new Date(),
          };

          const result = await appointmentCollection.insertOne(newAppointment);
          return res.send(result);
        }
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: "Server error", error });
      }
    });

    // Get all appointments
    app.get("/appointments", async (req, res) => {
      const list = await appointmentCollection.find().toArray();
      res.json(list);
    });

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