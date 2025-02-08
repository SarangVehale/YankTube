# 🎬 **YankTube** 🎵  
_A Fast & Reliable YouTube Video & Audio Downloader_  

![YankTube](https://raw.githubusercontent.com/SarangVehale/YankTube/main/assets/banner.png)  

---

## 📌 **About YankTube**  
YankTube is a high-performance **YouTube downloader** that allows users to download videos in **MP4** and audio in **MP3** format. It features a **FastAPI backend** and a **React-based frontend**, providing:  

🔹 **MP4 & MP3 downloads**  
🔹 **Real-time progress tracking**  
🔹 **Rate limiting to prevent abuse**  
🔹 **Automatic cleanup of old files**  
🔹 **Simple & user-friendly interface**  

---

## 🚀 **Tech Stack**  

### **Backend (FastAPI)**
- FastAPI (for high-performance APIs)
- yt-dlp (for downloading videos & audio)
- SlowAPI (rate limiting)
- Loguru (logging)
- Aiofiles & JSON (metadata storage)
- CORS Middleware (frontend-backend communication)

### **Frontend (React)**
- React.js (modern UI)
- TailwindCSS (responsive styling)
- Axios (API communication)

---

## ⚙️ **Installation & Setup**  

### 🖥️ **Backend Setup (FastAPI)**
1. Clone the repository:
   ```sh
   git clone https://github.com/SarangVehale/YankTube.git
   cd YankTube/project/backend
   ```

2. Create a virtual environment and activate it:
   ```sh
   python -m venv venv
   source venv/bin/activate   # macOS/Linux
   venv\Scripts\activate      # Windows
   ```

3. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```

4. Run the FastAPI server:
   ```sh
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   The backend will be live at: **http://localhost:8000**

---

### 🎨 **Frontend Setup (React)**
1. Navigate to the frontend directory:
   ```sh
   cd ../frontend
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Start the React development server:
   ```sh
   npm run dev
   ```
   The frontend will be live at: **http://localhost:5173**

---

## 🎯 **API Endpoints**
| Method | Endpoint | Description |
|--------|---------|-------------|
| `POST` | `/api/download` | Download a YouTube video/audio |
| `GET`  | `/api/progress/{download_id}` | Check download progress |
| `GET`  | `/api/download/{download_id}` | Download the file |
| `GET`  | `/docs` | Swagger API documentation |

---

## 📸 **Preview**
![YankTube UI](https://raw.githubusercontent.com/SarangVehale/YankTube/main/assets/preview.png)  

---

## 🔥 **Features**
✅ **Download Videos & Audio** – Supports MP4 & MP3 formats.  
✅ **Real-time Progress** – Track download percentage and speed.  
✅ **Rate Limiting** – Prevents excessive requests per user.  
✅ **Clean Logs** – Stores metadata & logs in JSON format.  
✅ **Auto Cleanup** – Deletes old files automatically.  

---

## 📜 **License**
This project is licensed under the **MIT License**.  

---

## 🤝 **Contributing**
We welcome contributions! Feel free to fork the repo, submit pull requests, or report issues. 🚀  

**🔗 GitHub Repository:** [YankTube](https://github.com/SarangVehale/YankTube)  

---