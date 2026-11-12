import io
from datetime import date, timedelta

from PIL import Image

from tests.conftest import PROFILE, verify


def _jpeg(w=900, h=1200, exif_gps=True, orientation=None) -> bytes:
    img = Image.new("RGB", (w, h), (120, 160, 90))
    exif = Image.Exif()
    if exif_gps:
        exif[0x8825] = {1: "N", 2: (12.0, 58.0, 0.0)}  # GPS IFD
        exif[0x010F] = "PhoneMaker"
    if orientation:
        exif[0x0112] = orientation
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    return buf.getvalue()


def _up(client, auth, data=None, **form):
    return client.post("/api/photos", headers=auth, data={"pose": "front", **form},
                       files={"file": ("me.jpg", data if data is not None else _jpeg(), "image/jpeg")})


def test_upload_strips_metadata_resizes_and_lists(client, auth):
    client.post("/api/progress/weights", json={"recorded_on": date.today().isoformat(), "weight_kg": 69.4}, headers=auth)
    r = _up(client, auth, _jpeg(3000, 4000), note="Week 1")
    assert r.status_code == 201, r.text
    p = r.json()
    assert (p["width"], p["height"]) == (1200, 1600) and p["weight_kg"] == 69.4 and p["note"] == "Week 1"
    full = client.get(f"/api/photos/{p['id']}/image", headers=auth)
    assert full.status_code == 200 and full.headers["content-type"] == "image/jpeg"
    assert "private" in full.headers["cache-control"]
    im = Image.open(io.BytesIO(full.content))
    assert im.size == (1200, 1600) and len(im.getexif()) == 0  # GPS / camera data removed
    th = Image.open(io.BytesIO(client.get(f"/api/photos/{p['id']}/image?size=thumb", headers=auth).content))
    assert max(th.size) == 480
    assert [x["id"] for x in client.get("/api/photos", headers=auth).json()] == [p["id"]]


def test_orientation_is_applied(client, auth):
    p = _up(client, auth, _jpeg(1200, 800, orientation=6)).json()  # camera held sideways
    assert p["height"] > p["width"]


def test_rejects_bad_files_and_inputs(client, auth):
    assert _up(client, auth, b"not an image at all").status_code == 415
    assert _up(client, auth, b"").status_code == 400
    assert _up(client, auth, _jpeg(80, 80)).status_code == 400
    assert _up(client, auth, pose="sideways").status_code == 422
    future = (date.today() + timedelta(days=2)).isoformat()
    assert _up(client, auth, taken_on=future).status_code == 422
    gif = io.BytesIO(); Image.new("RGB", (300, 300)).save(gif, "GIF")
    assert _up(client, auth, gif.getvalue()).status_code == 415
    png = io.BytesIO(); Image.new("RGBA", (400, 500), (0, 0, 0, 0)).save(png, "PNG")
    assert _up(client, auth, png.getvalue()).status_code == 201


def test_photos_are_private_and_editable(client, auth):
    pid = _up(client, auth).json()["id"]
    r = client.post("/api/auth/register", json={"full_name": "Snoop", "email": "snoop@example.com", "password": "secret123"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    verify(client, h, "snoop@example.com")
    client.put("/api/profile", json=PROFILE, headers=h)
    assert client.get(f"/api/photos/{pid}/image", headers=h).status_code == 404
    assert client.get(f"/api/photos/{pid}/image").status_code in (401, 403)
    assert client.delete(f"/api/photos/{pid}", headers=h).status_code == 404
    assert client.get("/api/photos", headers=h).json() == []
    r = client.patch(f"/api/photos/{pid}", json={"pose": "side", "note": "  after leg day "}, headers=auth)
    assert r.json()["pose"] == "side" and r.json()["note"] == "after leg day"
    assert client.patch(f"/api/photos/{pid}", json={"note": None}, headers=auth).json()["note"] is None
    assert client.delete(f"/api/photos/{pid}", headers=auth).status_code == 204
    assert client.get("/api/photos", headers=auth).json() == []


def test_demo_cannot_upload_and_account_delete_removes_photos(client, auth):
    demo = client.post("/api/auth/demo").json()["access_token"]
    assert _up(client, {"Authorization": f"Bearer {demo}"}).status_code == 403
    _up(client, auth)
    from app.database import SessionLocal
    from app.models import ProgressPhoto
    uid = client.get("/api/auth/me", headers=auth).json()["id"]
    assert client.delete("/api/settings/account", headers=auth).status_code in (200, 204)
    with SessionLocal() as db:
        assert db.query(ProgressPhoto).filter_by(user_id=uid).count() == 0
