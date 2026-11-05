import express from "express";
import {MongoClient} from 'mongodb';
import 'dotenv/config'
const app = express();
const PORT = 5000;

const client = new MongoClient(process.env.MONGODB_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();

const db = mongoClient.db("plan-social")
const eventsCollection = db.collection("events")

app.post('/add-event', async(req, res) => {
    const data = req.body
    const result = await eventsCollection.insertOne(data)
    console.log(result);
    res.send(result)
})

app.get('/', (req, res) => {
    res.send({message: `server is running fine.`})
})

app.listen(PORT, ()=>{
    console.log(`SERVER IS RUNNING ${PORT}` );
})
