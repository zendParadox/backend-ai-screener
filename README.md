# Backend Service: AI-Powered Candidate Screening

Proyek ini adalah sebuah backend service yang dirancang untuk mengotomatisasi proses screening awal lamaran kerja. Service ini menerima CV dan laporan proyek dari kandidat, lalu menggunakan alur kerja berbasis AI (RAG dan LLM) untuk mengevaluasinya berdasarkan dokumen referensi internal (Deskripsi Pekerjaan dan Case Study Brief), dan menghasilkan laporan evaluasi terstruktur dalam format JSON.

## Arsitektur Sistem

- Sistem ini dibangun dengan arsitektur berbasis antrian (queue) untuk menangani proses evaluasi AI yang dapat memakan waktu lama tanpa memblokir respons API.
- API Layer (Express.js): Menerima permintaan HTTP untuk mengunggah file dan memulai evaluasi.
- Job Queue (BullMQ + Redis): POST /evaluate tidak langsung memproses evaluasi, melainkan menambahkan pekerjaan ke dalam antrian di Redis.
- Worker Process: Sebuah proses Node.js terpisah yang terus memantau antrian, mengambil pekerjaan, dan menjalankan logika evaluasi AI.
- Vector Database (Qdrant): Menyimpan dokumen referensi (Job Description, Rubrics, dll.) sebagai vektor untuk pencarian konteks yang relevan (RAG).
- LLM Service (Google Gemini): Model AI generatif yang digunakan untuk melakukan analisis akhir berdasarkan konteks dari RAG dan data kandidat.

## Tech Stack

- Framework: Node.js, Express.js
- Job Queue: BullMQ
- Database: Redis (untuk BullMQ), Qdrant (Vector Database)
- AI / LLM: Google Gemini API (gemini-2.5-flash)
- Embedding: @xenova/transformers (Model: all-MiniLM-L6-v2, berjalan lokal)
- Lainnya: Docker, Multer, pdf2json

## Requirement

Sebelum memulai, pastikan Anda telah menginstal perangkat lunak berikut:

- Node.js (v18 atau lebih baru)
- Docker dan Docker Compose
- cURL atau klien API seperti Postman/Insomnia

## Getting Started

1. Clone Repositori:
   ```bash
   git clone https://github.com/zendParadox/backend-ai-screener.git
   ```
2. Install Dependensi
   ```bash
   npm install
   ```
3. Konfigurasi Environment Variables
   Buat file `.env ` di direktori utama proyek dan tambahkan kunci API Google Gemini Anda.
   ```bash
   GEMINI_API_KEY=[KUNCI_API_GEMINI_ANDA]
   ```

## Menjalankan Aplikasi

Ikuti langkah-langkah ini secara berurutan untuk menjalankan seluruh sistem.

1. Jalankan Layanan Eksternal (Database)

   Gunakan Docker Compose untuk menjalankan instance Qdrant dan Redis di latar belakang.

   ```bash
   docker-compose up -d
   ```

   Anda dapat memeriksa statusnya dengan `docker-compose ps`.

2. Ingest Dokumen Referensi

   Jalankan skrip ingest satu kali untuk mengisi database Qdrant dengan dokumen-dokumen referensi (Job Description, Case Study Brief, dll.).

   ```bash
   npm run ingest
   ```

   Skrip ini akan menghapus koleksi lama (jika ada) dan membuat yang baru untuk memastikan data yang bersih.

3. Jalankan Server dan Worker

   Jalankan server API dan worker pemrosesan antrian secara bersamaan.

   ```bash
   npm run dev
   ```

   Anda akan melihat log dari kedua proses di terminal Anda, yang menandakan sistem siap menerima permintaan.

## Dokumentasi API

1. Upload Dokumen
   - Endpoint: `POST /upload`
   - Deskripsi: Mengunggah file CV dan laporan proyek kandidat.
   - Request Body: `multipart/form-data` dengan dua field: `cv` (file PDF) dan `report` (file PDF).
   - Contoh cURL:
   ```bash
   curl -X POST -F "cv=@my_cv.pdf" -F "report=@my_report.pdf" http://localhost:3000/upload
   ```
   - Respons Sukses (200 OK):
   ```bash
   {
   "message": "Files uploaded successfully",
   "cv_id": "cv-1759479135442-791936654.pdf",
   "report_id": "report-1759479135446-41499137.pdf"
   }
   ```
2. Memulai Evaluasi
   - Endpoint: `POST /evaluate`
   - Deskripsi: Menambahkan pekerjaan evaluasi ke dalam antrian.
   - Request Body: `application/json`
   - Contoh cURL:
   ```bash
   curl -X POST -H "Content-Type: application/json" -d "{\"job_title\":\"Backend Developer\",\"cv_id\":\"[MASUKKAN-CV-ID]\",\"report_id\":\"[MASUKKAN-REPORT-ID]\"}" "http://localhost:3000/evaluate"
   ```
   - Respons Sukses (202 Accepted):
   ```bash
   {
   "job_id": "[JOB-ID]",
   "status": "queued"
   }
   ```
3. Memeriksa Hasil Evaluasi
   - Endpoint: `GET /result/:id`
   - Deskripsi: Memeriksa status dan hasil dari sebuah pekerjaan evaluasi.
   - Contoh cURL:
   ```bash
   curl http://localhost:3000/result/4b65611a-f90a-4be4-a3f7-6175d863e947
   ```
   - Respons Saat Sedang Diproses:
   ```bash
   {
   "status": "processing",
   "data": { ... }
   }
   ```
   - Respons Setelah Selesai:
   ```bash
   {
   "status": "completed",
   "result": {
       "cv_match_rate": 0.85,
       "cv_feedback": "...",
       "project_score": 4.2,
       "project_feedback": "...",
       "overall_summary": "..."
   }
   }
   ```
   - Respons Jika Gagal:
   ```bash
   {
   "status": "failed",
   "error": "Pesan error yang relevan"
   }
   ```
