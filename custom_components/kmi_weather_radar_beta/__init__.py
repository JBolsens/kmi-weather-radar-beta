from __future__ import annotations

import logging
import re
import time
from pathlib import Path
from typing import Any

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    ANIMATION_FILES_URL,
    BASE_URL,
    CACHE_TTL_SECONDS,
    DOMAIN,
    MAX_FRAMES_DEFAULT,
)

_LOGGER = logging.getLogger(__name__)

FILE_RE = re.compile(r"geocontours-[^"]+?\.pbf")
SAFE_FILE_RE = re.compile(r"^geocontours-[0-9]{12}-[0-9]{12}\.pbf$")

PLATFORMS: list[str] = []


def _store(hass: HomeAssistant) -> dict[str, Any]:
    return hass.data.setdefault(
        DOMAIN,
        {
            "files": [],
            "files_updated_at": 0.0,
            "frames": {},
        },
    )


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    _register_http_views_once(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    _register_http_views_once(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return True


def _register_http_views_once(hass: HomeAssistant) -> None:
    store = _store(hass)
    if store.get("views_registered"):
        return
    hass.http.register_view(KmiRadarFilesView)
    hass.http.register_view(KmiRadarFrameView)
    hass.http.register_view(KmiRadarCardView)
    store["views_registered"] = True


async def _fetch_files(hass: HomeAssistant, max_frames: int = MAX_FRAMES_DEFAULT) -> list[str]:
    store = _store(hass)
    now = time.time()
    if store["files"] and now - store["files_updated_at"] < CACHE_TTL_SECONDS:
        return store["files"][:max_frames]

    session = async_get_clientsession(hass)
    url = f"{ANIMATION_FILES_URL}?cache={int(now)}"
    headers = {
        "Cache-Control": "no-cache, no-store, max-age=0",
        "Pragma": "no-cache",
    }
    async with session.get(url, headers=headers) as resp:
        resp.raise_for_status()
        text = await resp.text()

    files = FILE_RE.findall(text)
    files = [f for f in files if SAFE_FILE_RE.match(f)]
    files = files[:max_frames]

    store["files"] = files
    store["files_updated_at"] = now

    # Drop cached frames that are no longer announced by KMI. This matters because
    # updated nowcasts can replace previous predictions with a new creation time.
    announced = set(files)
    store["frames"] = {
        name: data for name, data in store["frames"].items() if name in announced
    }

    return files


async def _fetch_frame(hass: HomeAssistant, filename: str) -> bytes:
    if not SAFE_FILE_RE.match(filename):
        raise web.HTTPBadRequest(text="Invalid frame filename")

    store = _store(hass)
    if filename in store["frames"]:
        return store["frames"][filename]

    session = async_get_clientsession(hass)
    url = f"{BASE_URL}/{filename}?cache={int(time.time())}"
    headers = {
        "Cache-Control": "no-cache, no-store, max-age=0",
        "Pragma": "no-cache",
    }
    async with session.get(url, headers=headers) as resp:
        resp.raise_for_status()
        data = await resp.read()

    store["frames"][filename] = data
    return data


class KmiRadarFilesView(HomeAssistantView):
    url = "/api/kmi_weather_radar_beta/files"
    name = "api:kmi_weather_radar_beta:files"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        try:
            max_frames = int(request.query.get("max", MAX_FRAMES_DEFAULT))
        except ValueError:
            max_frames = MAX_FRAMES_DEFAULT
        max_frames = max(1, min(max_frames, 80))
        files = await _fetch_files(hass, max_frames=max_frames)
        response = {
            "files": files,
            "latest": files[0] if files else None,
            "updated_at": _store(hass)["files_updated_at"],
        }
        return self.json(response)


class KmiRadarFrameView(HomeAssistantView):
    url = "/api/kmi_weather_radar_beta/frame/{filename}"
    name = "api:kmi_weather_radar_beta:frame"
    requires_auth = True

    async def get(self, request: web.Request, filename: str) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        data = await _fetch_frame(hass, filename)
        return web.Response(
            body=data,
            content_type="application/x-protobuf",
            headers={"Cache-Control": "no-store"},
        )


class KmiRadarCardView(HomeAssistantView):
    url = "/kmi_weather_radar_beta/kmi-weather-radar-beta.js"
    name = "kmi_weather_radar_beta:card"
    requires_auth = False

    async def get(self, request: web.Request) -> web.Response:
        path = Path(__file__).parent / "frontend" / "kmi-weather-radar-beta.js"
        return web.FileResponse(
            path,
            headers={"Cache-Control": "no-cache"},
        )
