# ticketgal-admin

One command to look after TicketGal on its server, modelled on Mnemerynne's `mnemerynne-admin`.

```bash
sudo ticketgal-admin check-updates   # what's new on GitHub and what an update would change (changes nothing)
sudo ticketgal-admin update          # back up, update, restart, health check; asks first (--yes skips the question)
sudo ticketgal-admin restart         # restart TicketGal, reload nginx, health check
sudo ticketgal-admin status          # version, local changes, service + nginx state, health, databases, last backups
sudo ticketgal-admin logs [N]        # last N lines of TicketGal's journal (default 50)
sudo ticketgal-admin backup          # back up the four databases now
```

## What `update` does

1. **Fetch** `origin/main`. If nothing is new, it says so and stops.
2. **Refuse** to continue if:
   - the checkout has local edits to tracked files (exec-bit-only differences are ignored), or
   - the checkout has commits that GitHub doesn't.
   
   An update only ever **fast-forwards**. It never overwrites anything.
3. **Show** the new commits and what they touch: Python packages, the admin command, the service file, nginx templates. Then it asks *Update now?*
4. **Back up** the four SQLite databases with SQLite's online backup, into `/var/backups/ticketgal/<time>-before-<commit>/`. The newest 10 sets are kept.
5. **Update** the code (`git merge --ff-only`). If `requirements.txt` changed, it also runs `pip install`. If this command changed, it re-installs `/usr/local/bin/ticketgal-admin`.
6. **Restart** `ticketgal` and wait up to 90 s for `/health` to answer `ok` or `degraded`. "degraded" only means Atera is unreachable. Then it reloads nginx, but only if `nginx -t` passes.
7. **If anything fails,** it puts the old code and packages back, restarts, and tells you where the pre-update backup is.
   - The databases are not rolled back automatically, because TicketGal's start-up migrations only *add* columns and tables.
   - Restore by hand from the backup folder if you ever need to.

Every action adds one line to `/var/backups/ticketgal/history.log`.

## What it deliberately doesn't do

- **Install `ticketgal.service`.** `install.sh` writes its own version of that file. An update only tells you when the repo's copy changed.
- **Apply nginx/ModSecurity template changes.** Use `scripts/install_nginx_modsecurity.sh` for those.
- **Print `.env` values.** It asks the app only for its database paths, host and port.
- **Touch** `app/knowledgebase/`, `.env` or the databases' contents (they are all untracked).

## How it runs

- `/usr/local/bin/ticketgal-admin` is a tiny wrapper. It runs `deploy/admin/ticketgal-admin.sh` from the app folder, so every update brings the newest logic with it.
- **git and pip run as the `ticketgal` user.** That keeps `/home/ticketgal/TicketGal` owned by `ticketgal`. systemctl runs as root.
- **One run at a time:** a lock on `/run/ticketgal-admin.lock`.
- **Overrides** (mostly for testing): `TICKETGAL_APP`, `TICKETGAL_USER`, `TICKETGAL_SERVICE`, `TICKETGAL_BACKUP_DIR`, `TICKETGAL_PYTHON`, `TICKETGAL_BRANCH`, `TICKETGAL_HEALTH_TIMEOUT`, `TICKETGAL_KEEP_BACKUPS`.

## Install (once)

`install.sh` installs it on new servers. On an existing server:

```bash
sudo -u ticketgal git -C /home/ticketgal/TicketGal pull --ff-only origin main
sudo install -m 755 /home/ticketgal/TicketGal/deploy/admin/ticketgal-admin /usr/local/bin/
sudo ticketgal-admin status
```

## Troubleshooting

- **"has local changes"**
  - A file someone edited on the server: commit it in dev or undo it with `sudo -u ticketgal git -C /home/ticketgal/TicketGal checkout -- <file>`.
  - A **deleted** tracked file (for example `.env.coloring.example`): restore it the same way.
- **"can't fast-forward"**: the server has commits GitHub doesn't. Push them from the server, or reset by hand after checking what they are.
- **Health check times out**: run `sudo ticketgal-admin logs 100`. The update was already undone.
- **`git fetch` asks for a password**: the `ticketgal` user needs read access to the GitHub repo (a deploy key, or the same access it uses today for `git pull`).
