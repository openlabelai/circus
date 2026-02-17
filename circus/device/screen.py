"""Live screen capture via scrcpy-server + PyAV decode.

Each device gets a ScrcpyCapture instance that:
1. Pushes scrcpy-server.jar to the device (if not already present)
2. Sets up ADB port forwarding
3. Starts the scrcpy server process on-device
4. Connects via TCP, reads raw H264, decodes frames with PyAV
5. Caches the latest frame as JPEG bytes for serving
"""
from __future__ import annotations

import io
import logging
import socket
import subprocess
import threading
import time
from pathlib import Path

import av
from PIL import Image

from circus.device.discovery import _client

logger = logging.getLogger(__name__)

_SCRCPY_JAR = Path(__file__).parent / "bin" / "scrcpy-server.jar"
_SCRCPY_VERSION = "3.3.4"
_DEVICE_JAR_PATH = "/data/local/tmp/scrcpy-server.jar"
_BASE_PORT = 27200
_THUMBNAIL_WIDTH = 480
_JPEG_QUALITY = 60
_TARGET_FPS = 5


class ScrcpyCapture:
    """Captures screen from a single device using scrcpy-server."""

    def __init__(self, serial: str, port: int):
        self.serial = serial
        self.port = port
        # Use a deterministic SCID derived from the port for socket name matching
        self._scid = format(port, "08x")
        self._latest_frame: bytes | None = None
        self._lock = threading.Lock()
        self._running = False
        self._thread: threading.Thread | None = None
        self._server_process: subprocess.Popen | None = None

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._run, daemon=True, name=f"scrcpy-{self.serial}"
        )
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._server_process:
            try:
                self._server_process.terminate()
            except Exception:
                pass
            self._server_process = None
        # Kill any scrcpy processes on device
        try:
            subprocess.run(
                ["adb", "-s", self.serial, "shell", "pkill", "-f", "scrcpy"],
                capture_output=True, timeout=5,
            )
        except Exception:
            pass
        # Clean up port forward
        try:
            subprocess.run(
                ["adb", "-s", self.serial, "forward", "--remove", f"tcp:{self.port}"],
                capture_output=True, timeout=5,
            )
        except Exception:
            pass

    def get_frame(self) -> bytes | None:
        with self._lock:
            return self._latest_frame

    def _push_jar(self) -> None:
        """Push scrcpy-server.jar to device if not present."""
        device = _client().device(serial=self.serial)
        result = device.shell(f"ls -l {_DEVICE_JAR_PATH} 2>/dev/null")
        jar_size = _SCRCPY_JAR.stat().st_size
        if str(jar_size) not in result:
            logger.info(f"[{self.serial}] Pushing scrcpy-server.jar")
            device.push(str(_SCRCPY_JAR), _DEVICE_JAR_PATH)

    def _setup_forward(self) -> None:
        """Set up ADB port forwarding."""
        subprocess.run(
            ["adb", "-s", self.serial, "forward",
             f"tcp:{self.port}", f"localabstract:scrcpy_{self._scid}"],
            capture_output=True, check=True, timeout=10,
        )

    def _start_server(self) -> subprocess.Popen:
        """Start scrcpy server on device."""
        cmd = [
            "adb", "-s", self.serial, "shell",
            f"CLASSPATH={_DEVICE_JAR_PATH}",
            "app_process", "/", "com.genymobile.scrcpy.Server", _SCRCPY_VERSION,
            "tunnel_forward=true",
            "audio=false",
            "control=false",
            "cleanup=false",
            "raw_stream=true",
            f"max_size={_THUMBNAIL_WIDTH}",
            f"max_fps={_TARGET_FPS}",
            "video_bit_rate=500000",
            f"scid={self._scid}",
        ]
        return subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )

    def _connect_socket(self) -> socket.socket:
        """Connect to the forwarded scrcpy TCP port with retries."""
        for attempt in range(10):
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(5)
                sock.connect(("127.0.0.1", self.port))
                return sock
            except (ConnectionRefusedError, OSError):
                time.sleep(0.5)
        raise ConnectionError(f"Cannot connect to scrcpy on port {self.port}")

    def _decode_stream(self, sock: socket.socket) -> None:
        """Read raw H264 from socket and decode frames."""
        codec = av.CodecContext.create("h264", "r")

        while self._running:
            try:
                data = sock.recv(65536)
                if not data:
                    break

                for packet in codec.parse(data):
                    try:
                        for frame in codec.decode(packet):
                            self._frame_to_jpeg(frame)
                    except av.error.InvalidDataError:
                        continue
            except socket.timeout:
                continue
            except Exception as e:
                if self._running:
                    logger.warning(f"[{self.serial}] Stream error: {e}")
                break

    def _frame_to_jpeg(self, frame: av.VideoFrame) -> None:
        """Convert an AV frame to JPEG bytes and cache it."""
        img = frame.to_image()
        if img.width > _THUMBNAIL_WIDTH:
            ratio = _THUMBNAIL_WIDTH / img.width
            img = img.resize(
                (int(img.width * ratio), int(img.height * ratio)),
                Image.LANCZOS,
            )
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=_JPEG_QUALITY)
        with self._lock:
            self._latest_frame = buf.getvalue()

    def _run(self) -> None:
        """Main capture loop with auto-reconnect."""
        # Kill any stale scrcpy processes from previous runs
        try:
            subprocess.run(
                ["adb", "-s", self.serial, "shell", "pkill", "-f", "scrcpy"],
                capture_output=True, timeout=5,
            )
            time.sleep(0.5)
        except Exception:
            pass

        while self._running:
            sock = None
            try:
                self._push_jar()
                self._setup_forward()
                self._server_process = self._start_server()
                time.sleep(1.5)
                # Check if server process is still alive
                if self._server_process.poll() is not None:
                    stderr_out = self._server_process.stderr.read().decode() if self._server_process.stderr else ""
                    logger.warning(f"[{self.serial}] scrcpy server exited: {stderr_out}")
                    if self._running:
                        time.sleep(3)
                    continue
                sock = self._connect_socket()
                logger.info(f"[{self.serial}] Screen capture streaming on port {self.port}")
                self._decode_stream(sock)
            except Exception as e:
                if self._running:
                    logger.warning(f"[{self.serial}] Capture error: {e}, retrying in 3s")
            finally:
                if sock:
                    try:
                        sock.close()
                    except Exception:
                        pass
                if self._server_process:
                    try:
                        self._server_process.terminate()
                    except Exception:
                        pass
                    self._server_process = None

            if self._running:
                time.sleep(3)


class ScreenCaptureManager:
    """Manages ScrcpyCapture instances for all devices."""

    def __init__(self):
        self._captures: dict[str, ScrcpyCapture] = {}
        self._lock = threading.Lock()
        self._next_port = _BASE_PORT

    def start(self, serial: str) -> None:
        with self._lock:
            if serial in self._captures:
                return
            port = self._next_port
            self._next_port += 1
            capture = ScrcpyCapture(serial, port)
            self._captures[serial] = capture
        capture.start()
        logger.info(f"Started screen capture for {serial} on port {port}")

    def stop(self, serial: str) -> None:
        with self._lock:
            capture = self._captures.pop(serial, None)
        if capture:
            capture.stop()
            logger.info(f"Stopped screen capture for {serial}")

    def stop_all(self) -> None:
        with self._lock:
            captures = list(self._captures.values())
            self._captures.clear()
        for capture in captures:
            capture.stop()

    def get_frame(self, serial: str) -> bytes | None:
        with self._lock:
            capture = self._captures.get(serial)
        if capture:
            return capture.get_frame()
        return None

    def stream(self, serial: str):
        """Generator yielding MJPEG multipart chunks."""
        boundary = b"frame"
        while True:
            frame = self.get_frame(serial)
            if frame:
                yield (
                    b"--" + boundary + b"\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(frame)).encode() + b"\r\n"
                    b"\r\n" + frame + b"\r\n"
                )
            time.sleep(1.0 / _TARGET_FPS)

    def active_serials(self) -> list[str]:
        with self._lock:
            return list(self._captures.keys())
