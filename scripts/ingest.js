const { QdrantClient } = require("@qdrant/js-client-rest");
const { v4: uuidv4 } = require("uuid");

// --- Utility function to delay execution (for Qdrant initialization wait) ---
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Ground truth reference documents used for candidate evaluation ---
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
- Technical Skills Match (40%).
- Experience Level (25%).
- Relevant Achievements (20%).
- Cultural Fit (15%).
`;

const PROJECT_RUBRIC = `
Project Report Evaluation Rubric:
- Correctness (30%).
- Code Quality (25%).
- Resilience (20%).
- Documentation (15%).
- Creativity (10%).
`;

// --- Vector config for Qdrant ---
const VECTOR_SIZE = 384; // Size of embeddings expected
const DUMMY_VECTOR = Array(VECTOR_SIZE).fill(0.1); // Dummy vector placeholder

// --- Ingestion pipeline ---
async function ingestData() {
  console.log("Starting ingestion process for Qdrant...");

  const client = new QdrantClient({ url: "http://localhost:6333" });

  // Allow Qdrant server to warm up
  console.log("Waiting for Qdrant to initialize (2 seconds)...");
  await delay(2000);

  const collectionName = "candidate_screening_references";
  console.log(`Checking for collection: ${collectionName}`);

  // Check if collection already exists
  const collections = await client.getCollections();
  const collectionExists = collections.collections.some(
    (c) => c.name === collectionName
  );

  // Drop existing collection to avoid duplicates
  if (collectionExists) {
    console.log(
      `Collection "${collectionName}" already exists. Deleting it for a clean ingest.`
    );
    await client.deleteCollection(collectionName);
  }

  // Create a new collection
  console.log(`Creating new collection: "${collectionName}"`);
  await client.createCollection(collectionName, {
    vectors: {
      size: VECTOR_SIZE,
      distance: "Cosine", // Cosine similarity for vector search
    },
  });
  console.log("Collection created successfully.");

  // Define reference points/documents to insert
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

  // Insert documents into Qdrant
  console.log("Upserting 4 documents into the collection...");
  await client.upsert(collectionName, {
    wait: true,
    points: points,
  });

  console.log("✅ Ingestion complete!");

  // Verify ingestion
  const collectionInfo = await client.getCollection(collectionName);
  console.log(
    `Verification: Collection now contains ${collectionInfo.points_count} documents.`
  );
}

// Run ingestion process
ingestData().catch(console.error);
