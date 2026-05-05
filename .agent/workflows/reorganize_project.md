# Workflow: reorganize_project
---
description: จัดระเบียบโครงสร้างไฟล์ของ webclient‑chat ให้เป็นโมดูลแยกชัดเจนโดยไม่ทำให้โค้ดพัง
---

## ขั้นตอนการจัดระเบียบโครงการ

### 1️⃣ สร้างโฟลเดอร์ใหม่
```bash
mkdir -p infra/docker infra/ci infra/k8s infra/scripts logs
mkdir -p config public/assets/images public/assets/fonts src/components/Auth src/components/Common src/services src/utils
```

### 2️⃣ ย้ายไฟล์ Docker / CI / K8s
```bash
# Docker
mv Dockerfile Dockerfile.dev docker-compose.dev.yml infra/docker/
# CI
mv .gitlab-ci.yml GITLAB_CICD_SETUP.md build-and-push.* infra/ci/
# K8s
mv -r k8s/* infra/k8s/
```

### 3️⃣ ย้ายสคริปต์และไฟล์ล็อก
```bash
mv -r server/scripts/* infra/scripts/
mv *.txt logs/
```

### 4️⃣ ย้ายไฟล์คอนฟิก
```bash
mv .env config/
mv config.ts config/
mv metadata.json config/
```

### 5️⃣ ย้ายไฟล์สาธารณะ (static)
```bash
mv index.html public/
mv -r image/* public/assets/images/
```

### 6️⃣ ย้ายโค้ดแอป React
```bash
# ย้ายไฟล์ src หลัก
mv index.tsx src/
mv App.tsx src/
mv types.ts src/
mv vite.config.ts src/
mv vite‑env.d.ts src/

# ย้ายคอมโพเนนท์
mv components/* src/components/
# แบ่งย่อย Auth คอมโพเนนท์
mkdir -p src/components/Auth src/components/Common
mv src/components/AuthView.tsx src/components/Auth/
mv src/components/Navbar.tsx src/components/Auth/
# ย้ายคอมโพเนนท์อื่น ๆ ไป Common (ถ้ามี)
mv src/components/* src/components/Common/ 2>/dev/null || true
```

### 7️⃣ ย้าย Service / Utility
```bash
mv server/services/* src/services/
mv server/utils/* src/utils/
mv server/app.ts src/
```

### 8️⃣ ปรับ import paths ทั้งหมด
ใช้ `sed` หรือ IDE เพื่ออัปเดตเส้นทาง import ให้สอดคล้องกับโครงสร้างใหม่ ตัวอย่าง:
```bash
# ตัวอย่างการอัปเดต import ของ db.ts
sed -i 's|../utils/db|../utils/db|g' src/services/*.ts
# ปรับ import ของ AuthView
sed -i 's|../../components|../components/Auth|g' src/components/Auth/AuthView.tsx
```
> **วิธีง่าย** – เปิดโปรเจกต์ใน VS Code → “Search & Replace” ทั้งหมด (Regex) เพื่อเปลี่ยน `../../` หรือ `../` ให้ตรงกับตำแหน่งใหม่

### 9️⃣ ตรวจสอบการคอมไพล์
```bash
npm install   # (หากมีการเปลี่ยนแปลง package)
npm run dev:all
```
ตรวจสอบว่าไม่มี error จาก import หรือไฟล์หาย

### 🔟 (ถ้าต้องการ) ลบไฟล์เก่า (optional)
เมื่อแน่ใจว่าแอปทำงานได้อย่างสมบูรณ์แล้ว ให้ลบไฟล์/โฟลเดอร์ที่ถูกย้ายออกจากตำแหน่งเดิม:
```bash
rm -rf Dockerfile Dockerfile.dev docker-compose.dev.yml .gitlab-ci.yml GITLAB_CICD_SETUP.md build-and-push.* k8s server/scripts *.txt image components server utils
```
