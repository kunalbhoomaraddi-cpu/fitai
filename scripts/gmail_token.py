#!/usr/bin/env python3
"""One-time helper: lets FitAI send email from your Gmail through the Gmail API.

Run it on your own computer:   python3 scripts/gmail_token.py

It asks for the Client ID and Client secret of your Google Cloud "Desktop app" client,
opens Google's sign-in page in your browser, and after you click Allow it prints the
GMAIL_REFRESH_TOKEN. Paste the three values into Render (and your backend/.env if you like).
Never share them in chats, screenshots or Git. Only the "send email" permission is requested:
FitAI can't read, change or delete your mail.

Uses only the Python standard library.
"""
import getpass
import http.server
import json
import secrets
import socket
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser

SCOPE = "https://www.googleapis.com/auth/gmail.send"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> None:
    print("\nFitAI · Gmail setup\n" + "-" * 40)
    client_id = input("Paste the Client ID: ").strip()
    client_secret = getpass.getpass("Paste the Client secret (hidden as you paste): ").strip()
    if not client_id.endswith(".apps.googleusercontent.com") or not client_secret:
        sys.exit("\nThat doesn't look right. The Client ID ends with .apps.googleusercontent.com — try again.")

    port = free_port()
    redirect = f"http://127.0.0.1:{port}"
    state = secrets.token_urlsafe(16)
    result: dict = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if "code" in q or "error" in q:
                result.update({k: v[0] for k, v in q.items()})
                ok = "code" in q and q.get("state", [""])[0] == state
                body = ("<h2>Done! FitAI can now send email from your Gmail.</h2><p>You can close this tab and go back to Terminal.</p>"
                        if ok else "<h2>Something went wrong.</h2><p>Go back to Terminal for details.</p>")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(body.encode())
                threading.Thread(target=self.server.shutdown, daemon=True).start()
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, *args):
            pass

    server = http.server.HTTPServer(("127.0.0.1", port), Handler)
    url = AUTH_URL + "?" + urllib.parse.urlencode({
        "client_id": client_id, "redirect_uri": redirect, "response_type": "code", "scope": SCOPE,
        "access_type": "offline", "prompt": "consent", "state": state})
    print("\nOpening Google in your browser. Sign in with the Gmail that should send FitAI's emails.")
    print("If you see 'Google hasn't verified this app': click Advanced → Go to FitAI (unsafe) → Continue.")
    print(f"\nIf the browser doesn't open, copy this link into it:\n{url}\n")
    webbrowser.open(url)
    server.serve_forever()

    if result.get("error"):
        sys.exit(f"\nGoogle said: {result['error']}. Run the script again and click Allow/Continue.")
    if result.get("state") != state:
        sys.exit("\nSecurity check failed (state mismatch). Run the script again.")

    data = urllib.parse.urlencode({"code": result["code"], "client_id": client_id, "client_secret": client_secret,
                                   "redirect_uri": redirect, "grant_type": "authorization_code"}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=data), timeout=30) as r:
            tokens = json.load(r)
    except urllib.error.HTTPError as e:
        detail = json.loads(e.read() or b"{}")
        sys.exit(f"\nGoogle refused the code: {detail.get('error')} {detail.get('error_description', '')}")

    refresh = tokens.get("refresh_token")
    if not refresh:
        sys.exit("\nGoogle didn't return a refresh token. Remove FitAI at https://myaccount.google.com/permissions and run again.")

    print("\nSuccess! Add these three settings in Render → fitai-api → Environment:\n")
    print(f"GMAIL_CLIENT_ID={client_id}")
    print("GMAIL_CLIENT_SECRET=(the Client secret you pasted above)")
    print(f"GMAIL_REFRESH_TOKEN={refresh}")
    print("\nKeep these private: don't paste them into chats or screenshots, and never commit them to Git.\n")


if __name__ == "__main__":
    main()
