FROM python:3.12-slim

# ADB and USB support
RUN apt-get update && apt-get install -y --no-install-recommends \
    android-tools-adb \
    usbutils \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first for caching
COPY pyproject.toml .
RUN pip install --no-cache-dir hatchling && \
    pip install --no-cache-dir uiautomator2 adbutils pyyaml click rich pillow pytest faker

# Copy source
COPY . .
RUN pip install --no-cache-dir -e .

CMD ["bash"]
