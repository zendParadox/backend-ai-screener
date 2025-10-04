const { QdrantClient } = require("@qdrant/js-client-rest");
const { v4: uuidv4 } = require("uuid");

// --- Helper function for delay ---
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Data reference (Ground Truth)
const JOB_DESCRIPTION = `
Position: Backend Developer. 
Required Skills: Node.js, Express, Python, Django, SQL (PostgreSQL), NoSQL (MongoDB, Redis), Docker, CI/CD. 
Experience: 3-5 years in backend development. 
Responsibilities: Design and implement scalable APIs, manage databases, write clean and testable code, collaborate with frontend teams.
`;
const CASE_STUDY_BRIEF = `
Task: Build a backend service for a simple URL shortener. 
Requirements:
1. An endpoint to accept a long URL and return a short code.
2. An endpoint to redirect a short code to the original long URL.
3. Must handle high traffic and potential invalid inputs gracefully.
4. The solution should be containerized using Docker.
`;
const CV_RUBRIC = `
CV Evaluation Rubric:
- Technical Skills Match (40%): Compare candidate's skills with required skills (Node.js, Python, SQL, etc.).
- Experience Level (25%): Check if years of experience match the 3-5 year requirement.
- Relevant Achievements (20%): Look for quantifiable achievements like "improved API response time by 30%".
- Cultural Fit (15%): Assess clarity and professionalism in descriptions.
`;
const PROJECT_RUBRIC = `
Project Report Evaluation Rubric:
- Correctness (30%): Does the solution meet all functional requirements of the URL shortener brief?
- Code Quality (25%): Is the code clean, modular, and well-structured?
- Resilience (20%): How does the system handle errors, edge cases, and high loads?
- Documentation (15%): Is the setup and API usage clearly documented?
- Creativity (10%): Are there any innovative solutions or extra features?
`;

const VECTOR_SIZE = 384;
const DUMMY_VECTOR = Array(VECTOR_SIZE).fill(0.1);

async function ingestData() {
  console.log("Starting ingestion process for Qdrant...");

  const client = new QdrantClient({ url: "http://localhost:6333" });

  console.log("Waiting for Qdrant to initialize (2 seconds)...");
  await delay(2000);

  const collectionName = "candidate_screening_references";
  console.log(`Checking for collection: ${collectionName}`);

  const collections = await client.getCollections();
  const collectionExists = collections.collections.some(
    (c) => c.name === collectionName
  );

  if (collectionExists) {
    console.log(
      `Collection "${collectionName}" already exists. Deleting it for a clean ingest.`
    );
    await client.deleteCollection(collectionName);
  }

  console.log(`Creating new collection: "${collectionName}"`);
  await client.createCollection(collectionName, {
    vectors: {
      size: VECTOR_SIZE,
      distance: "Cosine",
    },
  });
  console.log("Collection created successfully.");

  const points = [
    {
      id: uuidv4(),
      vector: DUMMY_VECTOR,
      payload: {
        content: JOB_DESCRIPTION,
        type: "job_description",
        job_title: "Backend Developer",
      },
    },
    {
      id: uuidv4(),
      vector: DUMMY_VECTOR,
      payload: {
        content: CASE_STUDY_BRIEF,
        type: "case_study_brief",
        job_title: "Backend Developer",
      },
    },
    {
      id: uuidv4(),
      vector: DUMMY_VECTOR,
      payload: {
        content: CV_RUBRIC,
        type: "scoring_rubric",
        for: "cv",
      },
    },
    {
      id: uuidv4(),
      vector: DUMMY_VECTOR,
      payload: {
        content: PROJECT_RUBRIC,
        type: "scoring_rubric",
        for: "project",
      },
    },
  ];

  console.log("Upserting 4 documents into the collection...");
  await client.upsert(collectionName, {
    wait: true,
    points: points,
  });

  console.log("✅ Ingestion complete!");

  const collectionInfo = await client.getCollection(collectionName);
  console.log(
    `Verification: Collection now contains ${collectionInfo.points_count} documents.`
  );
}

ingestData().catch(console.error);
