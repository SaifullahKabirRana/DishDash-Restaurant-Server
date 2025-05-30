const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// for send email
const nodemailer = require("nodemailer");
// transporter create
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'https://dish-dash-restaurant.vercel.app', 'https://dishdash-restaurant.web.app'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions));
app.use(express.json());

// verify jwt middleware
const verifyToken = (req, res, next) => {

    if (!req.headers?.authorization) {
        return res.status(401).send({ message: 'Unauthorized' })
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized' });
        }
        req.user = decoded;
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
        const paymentCollection = client.db("DishDash-Restaurant").collection("payments");


        // jwt generate
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '7d'
            });
            res.send({ token });
        })

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.user?.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden' });
            }
            next();
        }


        // get all user data
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        // check users(admin)
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const tokenEmail = req.user?.email;
            const email = req.params.email;
            if (tokenEmail !== email) {
                return res.status(403).send({ message: 'Forbidden' });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
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
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
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
        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
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

        // get a specific menu data using id
        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.findOne(query);
            res.send(result);
        })

        // save a menu item data in db
        app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
            const menuItem = req.body;
            const result = await menuCollection.insertOne(menuItem);
            res.send(result);
        });

        // update menu item data using patch
        app.patch('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const menuItem = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    name: menuItem.name,
                    category: menuItem.category,
                    price: menuItem.price,
                    recipe: menuItem.recipe,
                    image: menuItem.image
                }
            }

            const result = await menuCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // delete a menu item data in db
        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.deleteOne(query);
            res.send(result);
        })


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
        })

        // delete a cart data in database
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })

        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        // save payment data in db
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);

            // carefully delete each item from the cart
            const query = {
                _id: {
                    $in: payment.cartIds.map(id => new ObjectId(id))
                }
            };
            const deleteResult = await cartCollection.deleteMany(query);

            // send user email about payment confirmation
            const mailOptions = {
                from: `"DishDash" <${process.env.EMAIL_USER}>`,
                to: payment.email,
                subject: "DishDash Order Confirmation",
                html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2>Dear ${payment.name},</h2>
                    <p>Thank you for your order!</p>
                    <p>Your <strong>Transaction ID</strong>: ${payment.transactionId}</p>
                    <p>We would love to hear your feedback about our food. ❤️</p>
                </div>
                `
            };
            transporter.sendMail(mailOptions)
                .then(info => console.log("Email sent:", info.messageId))
                .catch(error => console.error("Email error", error));

            res.send({ paymentResult, deleteResult });
        })

        // get payment history for specific user
        app.get('/payments/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const tokenEmail = req.user?.email;
            const query = { email: email };
            if (email !== tokenEmail) {
                return res.status(403).send({ message: 'Forbidden' });
            }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        });

        // get all payment for admin
        app.get('/allPayments', verifyToken, verifyAdmin, async (req, res) => {
            const result = await paymentCollection.find().toArray();
            res.send(result);
        });

        // Update payment status
        app.patch('/allPayments/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: status
            };
            const result = await paymentCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        // stats or analytics
        app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
            const users = await userCollection.estimatedDocumentCount();
            const menuItems = await menuCollection.estimatedDocumentCount();
            const orders = await paymentCollection.estimatedDocumentCount();

            // this is not the best way 
            // const payments = await paymentCollection.find().toArray();
            // const revenue = payments.reduce((total, payment) => total + payment.price, 0);

            const result = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: '$price'
                        }
                    }
                }
            ]).toArray();
            const revenue = result.length > 0 ? result[0].totalRevenue : 0;

            res.send({
                users,
                menuItems,
                orders,
                revenue
            })

        });

        // using aggregate pipeline
        app.get('/order-stats', verifyToken, verifyAdmin, async (req, res) => {
            const result = await paymentCollection.aggregate([
                {
                    $unwind: '$menuItemIds'
                },
                {
                    $addFields: {
                        menuItemIds: { $toObjectId: '$menuItemIds' }  // Convert string to ObjectId
                    }
                },
                {
                    $lookup: {
                        from: 'menu',
                        localField: 'menuItemIds',
                        foreignField: '_id',
                        as: 'menuItems'
                    }
                },
                {
                    $unwind: '$menuItems'
                },
                {
                    $group: {
                        _id: '$menuItems.category',
                        quantity: { $sum: 1 },
                        totalRevenue: { $sum: '$menuItems.price' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        category: '$_id',
                        quantity: '$quantity',
                        totalRevenue: '$totalRevenue'
                    }
                }
            ]).toArray();

            res.send(result);
        });

        // user stats (specific user)
        app.get('/user-stats/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const tokenEmail = req.user?.email;
            const query = { email: email };
            if (email !== tokenEmail) {
                return res.status(403).send({ message: 'Forbidden' });
            }
            const orders = await paymentCollection.countDocuments(query); // use countDocuments for specific user data
            const result = await paymentCollection.aggregate([
                {
                    $match: query
                },
                {
                    $project: {
                        price: 1,
                        menuCount: { $size: '$menuItemIds' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalPayments: { $sum: '$price' },
                        totalMenuItems: { $sum: '$menuCount' }
                    }
                }

            ]).toArray();
            const totalPayments = result.length > 0 ? result[0].totalPayments : 0;
            const totalMenuItems = result.length > 0 ? result[0].totalMenuItems : 0;

            res.send({
                orders,
                totalPayments,
                totalMenuItems
            })

        });

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