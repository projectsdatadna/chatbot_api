import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import bodyParser from "body-parser"
import { initMemoryStore, queryRag } from "./services/chatService.js";


dotenv.config()
const app = express()


const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

app.use(cors({ origin: allowedOrigin }));

app.use(express.json())
app.use(bodyParser.json());

await initMemoryStore()

app.post("/chat", async (req, res) => {
    const { query, customerID } = req.body;
    if (!query && !customerID) return res.status(400).send({ error: "Missing query" });

    try {
        let ans = await queryRag(query, customerID)
        res.send({ answer: ans });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
})


app.listen(process.env.PORT, () => {
    console.log("Server is Running on", process.env.PORT)
})