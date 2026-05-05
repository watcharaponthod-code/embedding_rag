# Vector Docs (Enterprise RAG System)

ระบบจัดการเอกสารและฐานความรู้อัจฉริยะ (RAG - Retrieval-Augmented Generation) ที่รองรับการนำเข้าข้อมูลจากหลากหลายแหล่ง (Hybrid Ingestion) เพื่อทำ Vector Search และถาม-ตอบด้วย AI

---

## 🏗 ผังการทำงานของระบบ (Architecture)

### 1. การนำเข้าข้อมูล (Data Ingestion Paths)
ระบบรองรับการนำเข้าข้อมูล 3 ช่องทางหลัก:
*   **Manual Upload**: ผู้ใช้จัดการอัปโหลดไฟล์ (PDF, PPTX, DOCX) ผ่านหน้าเว็บโดยตรง ระบบจะทำการสกัดข้อความและรูปภาพอัตโนมัติ
*   **Automation (Email Ingestion)**: ระบบดักจับข้อมูลจาก Email (Subject, Body, Attachments) ผ่าน Webhook (เช่น n8n) เพื่อนำข้อมูลเข้าสู่ระบบโดยอัตโนมัติ
*   **Pre-processed Data Integration**: รองรับการนำเข้าข้อมูลที่ผ่านการประมวลผลและทำ Embedding มาแล้วจากบริการภายนอก (เช่น Mantis) เพื่อจัดเก็บลงฐานข้อมูลโดยตรง

### 2. การประมวลผล AI (AI Engine)
*   **Embedding**: ใช้โมเดล **BGE-M3** สำหรับการสร้าง Vector ที่มีความละเอียดสูงและรองรับภาษาไทยได้ดีเยี่ยม
*   **Reranking**: ใช้ **BGE-Reranker-v2-m3** เพื่อจัดลำดับความเกี่ยวข้องของข้อมูลใหม่ ให้ได้คำตอบที่แม่นยำที่สุด
*   **Generation**: ใช้โมเดลภาษาขนาดใหญ่ (LLM) เช่น **Llama3** หรือ **Qwen** ในการสร้างคำตอบที่ดูเป็นธรรมชาติและอ้างอิงจากฐานข้อมูลจริง

---

## 🎨 ผังโครงสร้าง Infrastructure (Docker & K8s)
ระบบออกแบบตามมาตรฐาน Cloud-native:
*   **Frontend**: React + Vite + TypeScript
*   **Backend**: Node.js Express + TypeScript
*   **AI Engine**: Ollama (Self-hosted) สำหรับรันโมเดล AI ภายในองค์กร
*   **Database**: PostgreSQL 15+ พร้อม Extension `pgvector` สำหรับค้นหาข้อมูลแบบ Vector 1024-dim
*   **Orchestration**: รองรับการติดตั้งผ่าน Docker Compose และ Kubernetes (K8s) พร้อมระบบ Auto-scaling

---

## 🚀 การติดตั้งและเริ่มต้นใช้งาน (Getting Started)

### 1. ตั้งค่าฐานข้อมูล
```bash
# เตรียมตารางข้อมูลเริ่มต้น
npm run server src/server/scripts/init_db.ts
```

### 2. ติดตั้ง Dependencies
```bash
# Node.js
npm install

# Python (สำหรับ Document Extractors)
pip install pymupdf python-pptx mammoth sharp
```

### 3. การตั้งค่า Environment Variables (`.env`)
ตั้งค่าการเชื่อมต่อฐานข้อมูลและ Ollama Endpoint ในไฟล์ `.env`

### 4. การรันโปรเจ็ค
```bash
npm run dev:all
```

---

## 📝 ฟีเจอร์เด่น
*   **Hybrid Search**: ผสมผสาน Semantic Search และ Keyword Search (Full-text) เพื่อความแม่นยำสูงสุด
*   **Vision Analysis**: วิเคราะห์และอธิบายรูปภาพภายในเอกสารอัตโนมัติ
*   **Multi-tenant Support**: รองรับการแยกข้อมูลตามโครงการ (Project) และลูกค้า (Client)
*   **Real-time Logs**: ระบบติดตามการประมวลผลเอกสารแบบ Real-time ผ่าน SSE

---

## 📄 License
Proprietary - AI Research Team
