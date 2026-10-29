# ======================================================================================
# MDD Detection Backend - FastAPI Dockerfile
# ======================================================================================

# 1. Use an official Python slim image for a smaller footprint
FROM python:3.12-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Install system dependencies for medical imaging and standard libraries
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy only the requirements file first to leverage Docker cache
COPY requirements.txt .

# 5. Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copy the rest of the application code
# This includes main.py and best_multimodal_model.pth
COPY . .

# 7. Expose the port FastAPI runs on
EXPOSE 8000

# 8. Command to run the server using Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
