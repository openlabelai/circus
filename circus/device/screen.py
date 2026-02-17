"""Live screen capture via scrcpy-server + PyAV decode.

Each device gets a ScrcpyCapture instance that:
1. Pushes scrcpy-server.jar to the device (if not already present)
2. Starts the scrcpy server process on-device via adbutils shell
3. Connects directly to the device's abstract socket via adbutils
4. Reads raw H264, decodes frames with PyAV, caches as JPEG
"""
from __future__ import annotations

import io
import logging
import socket
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

    def __init__(self, serial: str, scid: str):
        self.serial = serial
        self._scid = scid
        self._latest_frame: bytes | None = None
        self._lock = threading.Lock()
        self._running = False
        self._thread: threading.Thread | None = None
        self._shell_conn = None

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
        if self._shell_conn:
            try:
                self._shell_conn.close()
            except Exception:
                pass
            self._shell_conn = None
        # Kill scrcpy processes on device
        try:
            _client().device(serial=self.serial).shell("pkill -f scrcpy")
        except Exception:
            pass

    def get_frame(self) -> bytes | None:
        with self._lock:
            return self._latest_frame

    def _device(self):
        return _client().device(serial=self.serial)

    def _push_jar(self) -> None:
        """Push scrcpy-server.jar to device if not present."""
        device = self._device()
        result = device.shell(f"ls -l {_DEVICE_JAR_PATH} 2>/dev/null")
        jar_size = _SCRCPY_JAR.stat().st_size
        if str(jar_size) not in result:
            logger.info(f"[{self.serial}] Pushing scrcpy-server.jar")
            device.push(str(_SCRCPY_JAR), _DEVICE_JAR_PATH)

    def _start_server(self):
        """Start scrcpy server on device, returns the shell connection."""
        device = self._device()
        cmd = (
            f"CLASSPATH={_DEVICE_JAR_PATH} "
            f"app_process / com.genymobile.scrcpy.Server {_SCRCPY_VERSION} "
            f"tunnel_forward=true "
            f"audio=false "
            f"control=false "
            f"cleanup=false "
            f"raw_stream=true "
            f"max_size={_THUMBNAIL_WIDTH} "
            f"max_fps={_TARGET_FPS} "
            f"video_bit_rate=500000 "
            f"scid={self._scid}"
        )
        # stream=True returns an AdbConnection that keeps the shell running
        conn = device.shell(cmd, stream=True)
        return conn

    def _connect_to_device(self) -> socket.socket:
        """Connect directly to scrcpy's abstract socket on the device."""
        from adbutils._proto import Network
        device = self._device()
        for attempt in range(15):
            try:
                sock = device.create_connection(
                    Network.LOCAL_ABSTRACT, f"scrcpy_{self._scid}"
                )
                sock.settimeout(5)
                return sock
            except Exception:
                time.sleep(0.5)
        raise ConnectionError(
            f"Cannot connect to scrcpy socket scrcpy_{self._scid}"
        )

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
            self._device().shell("pkill -f scrcpy")
            time.sleep(0.5)
        except Exception:
            pass

        while self._running:
            sock = None
            try:
                self._push_jar()
                self._shell_conn = self._start_server()
                time.sleep(1.5)
                sock = self._connect_to_device()
                logger.info(f"[{self.serial}] Screen capture streaming")
                self._decode_stream(sock)
            except Exception as e:
                if self._running:
                    logger.warning(
                        f"[{self.serial}] Capture error: {e}, retrying in 3s"
                    )
            finally:
                if sock:
                    try:
                        sock.close()
                    except Exception:
                        pass
                if self._shell_conn:
                    try:
                        self._shell_conn.close()
                    except Exception:
                        pass
                    self._shell_conn = None

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
            scid = format(self._next_port, "08x")
            self._next_port += 1
            capture = ScrcpyCapture(serial, scid)
            self._captures[serial] = capture
        capture.start()
        logger.info(f"Started screen capture for {serial}")

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
