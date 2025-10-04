const { Worker, Queue } = require("bullmq");
const { QdrantClient } = require("@qdrant/js-client-rest");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const IORedis = require("ioredis");
const fs = require("fs");
const path = require("path");
const PDFParser = require("pdf2json");
require("dotenv").config();

const QUEUE_NAME = "evaluation-queue";
const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
});
const evaluationQueue = new Queue(QUEUE_NAME, { connection });
const jobResults = {};
const qdrantClient = new QdrantClient({ url: "http://localhost:6333" });
const collectionName = "candidate_screening_references";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function parsePdf(filePath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(this, 1);

    pdfParser.on("pdfParser_dataError", (errData) => {
      console.error("Error in PDFParser:", errData.parserError);
      reject(
        new Error(`Failed to parse PDF content: ${path.basename(filePath)}`)
      );
    });

    pdfParser.on("pdfParser_dataReady", () => {
      const rawText = pdfParser.getRawTextContent().replace(/\r\n/g, " ");
      resolve(rawText);
    });

    if (fs.existsSync(filePath)) {
      pdfParser.loadPDF(filePath);
    } else {
      reject(new Error(`File not found: ${filePath}`));
    }
  });
}

async function getEmbedding(text) {
  const { pipeline } = await import("@xenova/transformers");
  const embedder = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  );
  const result = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(result.data);
}

const setupWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { id, data } = job;
      console.log(`[Worker] Processing job ${id} for: ${data.job_title}`);
      jobResults[id] = { status: "processing", data };

      try {
        console.log("[Worker] Parsing CV and Report PDF files...");
        const cvPath = path.join(__dirname, "uploads", data.cv_id);
        const reportPath = path.join(__dirname, "uploads", data.report_id);

        const cvText = await parsePdf(cvPath);
        const reportText = await parsePdf(reportPath);
        console.log("[Worker] PDFs parsed successfully.");

        console.log("[Worker] Creating embedding for CV content...");
        const queryVector = await getEmbedding(cvText.substring(0, 500));
        console.log("[Worker] Embedding created.");

        console.log(
          "[Worker] Retrieving relevant context from Qdrant (RAG)..."
        );
        const searchResult = await qdrantClient.search(collectionName, {
          vector: queryVector,
          limit: 4,
          with_payload: true,
        });
        const context = searchResult
          .map(
            (res) =>
              `--- DOCUMENT: ${res.payload.type} ---\n${res.payload.content}`
          )
          .join("\n\n");
        console.log(
          `[Worker] Retrieved ${searchResult.length} documents from Qdrant.`
        );

        const prompt = `
                You are an expert AI HR assistant for a backend developer position. Your task is to evaluate a candidate based on their CV and a project report.
                You must use the provided context documents (Job Description, Case Study Brief, and Scoring Rubrics) as the absolute ground truth for your evaluation.
                Your output must be a valid JSON object with no extra text or explanations.

                The required JSON structure is:
                {
                  "cv_match_rate": float (0.0 to 1.0),
                  "cv_feedback": "string",
                  "project_score": float (1.0 to 5.0),
                  "project_feedback": "string",
                  "overall_summary": "A 3-5 sentence summary of the candidate's strengths, weaknesses, and a final recommendation."
                }

                Here are the documents for your evaluation:

                --- CONTEXT DOCUMENTS ---
                ${context}
                --- END OF CONTEXT DOCUMENTS ---

                Now, evaluate the following candidate materials:

                --- CANDIDATE CV ---
                ${cvText}
                --- END OF CANDIDATE CV ---

                --- CANDIDATE PROJECT REPORT ---
                ${reportText}
                --- END OF CANDIDATE PROJECT REPORT ---

                Produce the JSON output now.
            `;

        console.log("[Worker] Calling Gemini API for evaluation...");
        const result = await geminiModel.generateContent(prompt);
        const responseText = result.response.text();

        const cleanedJsonString = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        const evaluationResult = JSON.parse(cleanedJsonString);

        console.log("[Worker] Received evaluation from Gemini.");

        jobResults[id] = { status: "completed", result: evaluationResult };
        console.log(`[Worker] Job ${id} completed successfully.`);
      } catch (error) {
        console.error(`[Worker] Job ${id} failed:`, error);
        jobResults[id] = { status: "failed", error: error.message };
      }
    },
    { connection }
  );

  worker.on("completed", (job) =>
    console.log(`[Worker] Job ${job.id} has completed.`)
  );
  worker.on("failed", (job, err) =>
    console.log(`[Worker] Job ${job.id} has failed with ${err.message}`)
  );

  console.log(
    "[Worker] Real-time evaluation worker is ready and listening for jobs."
  );
};

setupWorker();

module.exports = {
  evaluationQueue,
  jobResults,
};
