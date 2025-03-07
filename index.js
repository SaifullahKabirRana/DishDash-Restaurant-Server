const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions));
app.use(express.json());

// verify jwt middleware
const verifyToken = (req, res, next) => {

    if (!req.headers?.authorization) {
        return res.status(401).send({ message: 'forbidden access' })
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'forbidden access' });
        }
        req.decoded = decoded;
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xmhoqrm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        const userCollection = client.db("DishDash-Restaurant").collection("users");
        const menuCollection = client.db("DishDash-Restaurant").collection("menu");
        const reviewsCollection = client.db("DishDash-Restaurant").collection("reviews");
        const cartCollection = client.db("DishDash-Restaurant").collection("carts");


        // jwt generate
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            });
            res.send({ token });
        })


        // get all user data
        app.get('/users', verifyToken, async (req, res) => {
            // console.log(req.headers);
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        // save user data in db
        app.post('/users', async (req, res) => {
            const user = req.body;

            // insert email if user doesn't exists
            const query = { email: user?.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User already exists', insertedId: null });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        // update user role
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // delete user data
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // get all menu data
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);

        });

        // get cart data for specific user
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);

        });


        // save cart data in database
        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cartCollection.insertOne(cartItem);
            res.send(result);
            console.log(result);
        })

        // delete a cart data in database
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);


app.get('/', async (req, res) => {
    res.send('DishDash Restaurant app is running...');
});

app.listen(port, () => {
    console.log(`DishDash Restaurant is running on port: ${port}`);
})