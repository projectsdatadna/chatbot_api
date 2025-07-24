import { cosineSimilarity } from "../utils.js"
import dotenv from "dotenv";

import { TextLoader } from "langchain/document_loaders/fs/text";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";

import { AzureOpenAI } from "openai";
import { AzureOpenAIEmbeddings } from "@langchain/openai";


dotenv.config();

const memoryStore = [];

const memoryStore1 = [];

const {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_INSTANCE_NAME,
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
  AZURE_OPENAI_CHAT_DEPLOYMENT,
  AZURE_OPENAI_ENDPOINT
} = process.env;

const embeddings = new AzureOpenAIEmbeddings({
  azureOpenAIApiKey: AZURE_OPENAI_API_KEY,
  azureOpenAIApiInstanceName: AZURE_OPENAI_INSTANCE_NAME,
  azureOpenAIApiDeploymentName: AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
  azureOpenAIApiVersion: AZURE_OPENAI_API_VERSION,
});


export async function initMemoryStore() {

  const textloader = new TextLoader("./docs/content.txt")
  const textDocs = await textloader.load()

  const pdfloader = new PDFLoader("./docs/sample.pdf")
  const pdfDocs = await pdfloader.load()


  const docxloader = new DocxLoader("./docs/sample.docx")
  const docxDocs = await docxloader.load()

  var text = pdfDocs.map(d => d.pageContent).join(" ");

  const chunks = text.match(/.{1,300}(\s|$)/g);

  for (const chunk of chunks) {
    const vector = await embeddings.embedQuery(chunk);
    memoryStore.push({ text: chunk, embedding: vector });
  }


  var text1 = textDocs.map(d => d.pageContent).join(" ");

  const chunks1 = text1.match(/.{1,300}(\s|$)/g);

  for (const chunk of chunks1) {
    const vector = await embeddings.embedQuery(chunk);
    memoryStore1.push({ text: chunk, embedding: vector });
  }
}

export async function queryRag(ques, customerID) {

  const quesVec = await embeddings.embedQuery(ques)
  var memory
  if (customerID === 'cust-001') {
    memory = memoryStore
  } else if (customerID === 'cust-002') {
    memory = memoryStore1
  }

  const scored = memory.map((doc) => ({
    text: doc.text,
    score: cosineSimilarity(quesVec, doc.embedding),
  }));

  const topChunks = scored.sort((a, b) => b.score - a.score).slice(0, 2).map((d) => d.text).join("\n");

  const prompt = `Answer the question based on the following text:\n\n${topChunks}\n\nQ: ${ques}`;


  const client = new AzureOpenAI({
    apiKey: AZURE_OPENAI_API_KEY,
    endpoint: AZURE_OPENAI_ENDPOINT,
    apiVersion: AZURE_OPENAI_API_VERSION,
    deployment: AZURE_OPENAI_CHAT_DEPLOYMENT,
  });

  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: prompt }
  ];

  const response = await client.chat.completions.create({
    messages: messages,
    max_tokens: 4096,
    temperature: 1,
    top_p: 1,
    model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME
  });

  if (response?.error !== undefined && response.status !== "200") {
    throw response.error;
  }
  console.log(response.choices[0].message.content);
  return response.choices[0].message.content
}