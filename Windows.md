# Installing ffmpeg on Windows based system

### **Windows**
1. **Download FFmpeg**  
   - Go to the official website: [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)  
   - Click **"Windows"**, then select **"Windows builds from gyan.dev"**.  
   - Download the latest **"full"** or **"essentials"** build.

2. **Extract the Files**  
   - Extract the downloaded `.7z` or `.zip` file using [7-Zip](https://www.7-zip.org/) or WinRAR.  
   - Move the extracted folder to a convenient location, e.g., `C:\ffmpeg`.

3. **Add FFmpeg to System Path**  
   - Open **Control Panel** → **System** → **Advanced system settings**.  
   - Click **Environment Variables**.  
   - Under **System Variables**, find `Path`, select it, and click **Edit**.  
   - Click **New**, then add `C:\ffmpeg\bin` (or the path where you extracted it).  
   - Click **OK** to save.

4. **Verify Installation**  
   - Open **Command Prompt** (`Win + R`, type `cmd`, press Enter).  
   - Type:  
     ```sh
     ffmpeg -versio
