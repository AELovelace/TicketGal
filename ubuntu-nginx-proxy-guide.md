# TicketGal Ubuntu + Nginx Proxy Guide

## Goal

This guide sets up TicketGal on Ubuntu behind Nginx, with the app listening only on localhost and Nginx handling public traffic. It also shows how to use the repo's built-in systemd and ModSecurity assets.

Target topology:

- Nginx listens on `80` or `443`
- TicketGal runs on `127.0.0.1:8000`
- systemd keeps the app alive
- `PUBLIC_BASE_URL` matches the public hostname

## 1. Server Prerequisites

Install or confirm:

- Ubuntu 22.04 or 24.04
- DNS record pointing your hostname at the server
- Python 3.11+
- A valid Atera API key
- Optional: TLS certificate files if you are not terminating TLS elsewhere

If you plan to use Microsoft 365 login, make sure your Entra redirect URI exactly matches:

`https://your-hostname/auth/microsoft/callback`

## 2. Copy The App To The Server

Example target path used by the included service files:

```bash
sudo mkdir -p /home/ticketgal
sudo rsync -a ./ /home/ticketgal/TicketGal/
```

Or clone the repo directly there.

## 3. Run The Included Ubuntu Installer

From the project root on the server:

```bash
sudo bash install.sh
```

What `install.sh` does:

- installs Python and build dependencies
- creates the `ticketgal` service account
- copies the app into `/home/ticketgal/TicketGal` when needed
- creates a virtual environment
- installs `requirements.txt`
- creates a starter `.env` if one does not exist
- installs and enables `ticketgal.service`

## 4. Configure TicketGal

Edit:

```bash
sudo nano /home/ticketgal/TicketGal/.env
```

Recommended values behind Nginx:

```env
HOST=127.0.0.1
PORT=8000
HTTPS_ENABLED=0
PUBLIC_BASE_URL=https://tickets.example.com

ATERA_API_KEY=your_real_key
ATERA_BASE_URL=https://app.atera.com

USER_PASSWORD_AUTH_ENABLED=1
ALLOWED_EMAIL_DOMAINS=@example.com

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change_this_now

BRANDING_ENV_FILE=.env.branding
```

Important notes:

- Keep `HTTPS_ENABLED=0` when Nginx is handling TLS.
- `PUBLIC_BASE_URL` should be the public URL users actually visit.
- If you use Microsoft login, `PUBLIC_BASE_URL` is especially important.

If you want branding overrides:

```bash
sudo cp /home/ticketgal/TicketGal/.env.branding.example /home/ticketgal/TicketGal/.env.branding
sudo nano /home/ticketgal/TicketGal/.env.branding
```

If you want encrypted DB values at rest, generate and set `DATA_ENCRYPTION_KEY` before first production use.

## 5. Start And Verify The App Service

```bash
sudo systemctl start ticketgal
sudo systemctl enable ticketgal
sudo systemctl status ticketgal
```

Check logs:

```bash
sudo journalctl -u ticketgal -f
```

Verify the app is listening locally:

```bash
curl http://127.0.0.1:8000/health
```

You should get a JSON health response.

## 6. Configure Nginx

You have two good options.

### Option A: Use The Included Nginx + ModSecurity Installer

HTTP only:

```bash
sudo bash /home/ticketgal/TicketGal/scripts/install_nginx_modsecurity.sh \
  --server-name tickets.example.com
```

HTTPS with existing certificate files:

```bash
sudo bash /home/ticketgal/TicketGal/scripts/install_nginx_modsecurity.sh \
  --server-name tickets.example.com \
  --tls-cert /etc/letsencrypt/live/tickets.example.com/fullchain.pem \
  --tls-key /etc/letsencrypt/live/tickets.example.com/privkey.pem
```

This installer:

- installs `nginx`, `libnginx-mod-http-modsecurity`, and `modsecurity-crs`
- copies TicketGal ModSecurity config into `/etc/nginx/modsec/ticketgal`
- writes `/etc/nginx/sites-available/ticketgal.conf`
- enables the site
- reloads Nginx

By default, ModSecurity starts in `DetectionOnly` mode, which is the safest way to begin.

### Option B: Manual Nginx Reverse Proxy

If you want a simpler reverse proxy without ModSecurity first, create:

```bash
sudo nano /etc/nginx/sites-available/ticketgal.conf
```

Example HTTPS config:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name tickets.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name tickets.example.com;

    ssl_certificate /etc/letsencrypt/live/tickets.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tickets.example.com/privkey.pem;

    client_max_body_size 25m;
    proxy_read_timeout 300s;
    proxy_connect_timeout 30s;
    proxy_send_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_buffering off;
    }

    location = /health {
        access_log off;
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/ticketgal.conf /etc/nginx/sites-enabled/ticketgal.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 7. TLS Recommendations

If Nginx terminates TLS:

- keep `HTTPS_ENABLED=0` in TicketGal
- ensure Nginx sends `X-Forwarded-Proto https`
- set `PUBLIC_BASE_URL=https://your-hostname`

If you use Let's Encrypt, certificate paths usually look like:

- `/etc/letsencrypt/live/your-hostname/fullchain.pem`
- `/etc/letsencrypt/live/your-hostname/privkey.pem`

## 8. Firewall

Open only what you need publicly:

- `80/tcp`
- `443/tcp`

Do not expose `8000` publicly if Nginx is your edge.

With UFW:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 8000/tcp
```

## 9. Post-Deploy Checks

Check the public site:

```bash
curl -I https://tickets.example.com/
curl https://tickets.example.com/health
```

Verify:

- the login page loads through Nginx
- `/health` returns successfully
- cookies are being set correctly after login
- Microsoft login redirects to the correct public callback URL if enabled

## 10. ModSecurity Notes

If you used the bundled installer:

- config lives in `/etc/nginx/modsec/ticketgal`
- audit log is `/var/log/nginx/modsec_audit.log`
- default mode is `DetectionOnly`

That default is a good idea. Review real traffic before enabling blocking mode.

To install directly in blocking mode:

```bash
sudo bash /home/ticketgal/TicketGal/scripts/install_nginx_modsecurity.sh \
  --server-name tickets.example.com \
  --tls-cert /etc/letsencrypt/live/tickets.example.com/fullchain.pem \
  --tls-key /etc/letsencrypt/live/tickets.example.com/privkey.pem \
  --enable-blocking
```

The repo also includes WAF smoke tests:

- [scripts/test_waf.sh](/c:/Scripts/TicketGal/scripts/test_waf.sh)
- [scripts/test_waf.ps1](/c:/Scripts/TicketGal/scripts/test_waf.ps1)

## 11. Common Problems

### Microsoft Login Redirects Incorrectly

Usually caused by:

- missing or wrong `PUBLIC_BASE_URL`
- Entra redirect URI mismatch
- proxy headers not forwarding the original scheme/host

### Session Cookies Are Not Marked Secure

Usually caused by:

- `PUBLIC_BASE_URL` not set to `https://...`
- missing `X-Forwarded-Proto https`

### Users See Stale Report Data

Reports use the local cache, not direct live Atera reads. Run the admin sync action or confirm cache refreshes are occurring.

### Ticket Writes Queue Instead Of Completing

This usually means Atera is returning an upstream failure and the write queue fallback is working as designed. Check:

- app logs
- queue status endpoint
- Atera availability

## 12. Useful Commands

```bash
sudo systemctl status ticketgal
sudo systemctl restart ticketgal
sudo journalctl -u ticketgal -f

sudo systemctl status nginx
sudo nginx -t
sudo systemctl reload nginx

curl http://127.0.0.1:8000/health
curl https://tickets.example.com/health
```

## 13. Recommended Production Baseline

- TicketGal bound to `127.0.0.1:8000`
- Nginx on `443`
- `PUBLIC_BASE_URL` set to the public HTTPS origin
- strong `ADMIN_PASSWORD`
- `DATA_ENCRYPTION_KEY` set
- regular backups of all three SQLite DB files plus `app/knowledgebase`

## 14. Files This Guide Depends On

- [install.sh](/c:/Scripts/TicketGal/install.sh)
- [start-prod.sh](/c:/Scripts/TicketGal/start-prod.sh)
- [ticketgal.service](/c:/Scripts/TicketGal/ticketgal.service)
- [deploy/nginx/ticketgal-http.conf.template](/c:/Scripts/TicketGal/deploy/nginx/ticketgal-http.conf.template)
- [deploy/nginx/ticketgal-https.conf.template](/c:/Scripts/TicketGal/deploy/nginx/ticketgal-https.conf.template)
- [scripts/install_nginx_modsecurity.sh](/c:/Scripts/TicketGal/scripts/install_nginx_modsecurity.sh)
