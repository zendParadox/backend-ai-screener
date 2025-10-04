const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { evaluationQueue, jobResults } = require("./worker");

const app = express();
const port = 3000;

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});
const upload = multer({ storage: storage });

app.post(
  "/upload",
  upload.fields([
    { name: "cv", maxCount: 1 },
    { name: "report", maxCount: 1 },
  ]),
  (req, res) => {
    if (!req.files || !req.files.cv || !req.files.report) {
      return res
        .status(400)
        .json({ error: "Both cv and report files are required" });
    }
    res.json({
      message: "Files uploaded successfully",
      cv_id: req.files.cv[0].filename,
      report_id: req.files.report[0].filename,
    });
  }
);

app.post("/evaluate", async (req, res) => {
  const { job_title, cv_id, report_id } = req.body;
  if (!job_title || !cv_id || !report_id) {
    return res
      .status(400)
      .json({ error: "job_title, cv_id, and report_id are required" });
  }

  const jobId = uuidv4();
  await evaluationQueue.add(
    job_title,
    { job_title, cv_id, report_id },
    { jobId }
  );

  jobResults[jobId] = {
    id: jobId,
    status: "queued",
    data: req.body,
    createdAt: new Date().toISOString(),
  };

  res.status(202).json({ job_id: jobId, status: "queued" });
});

app.get("/result/:id", (req, res) => {
  const { id } = req.params;
  const jobInfo = jobResults[id];

  if (!jobInfo) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json(jobInfo);
});

app.listen(port, () => {
  console.log(`[Server] Express server is running at http://localhost:${port}`);
});
