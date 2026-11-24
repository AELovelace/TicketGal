#!/usr/bin/env bash
# ticketgal-admin.sh: the logic behind `sudo ticketgal-admin <command>` (see deploy/admin/README.md).
#
#   check-updates     what's new on GitHub, and what an update would change
#   update [--yes]    back up the databases, fast-forward the code, install packages,
#                     restart TicketGal + reload nginx, health check; undo the code on failure
#   restart           restart TicketGal, reload nginx, health check
#   status            version, service state, health, last backups
#   logs [N]          last N journal lines for TicketGal (default 50)
#   backup            back up the four SQLite databases now
#
# Rules it keeps:
#   * Only fast-forwards. It refuses when the checkout has local edits or history GitHub doesn't have.
#   * git and pip run as the `ticketgal` user, so the app folder stays owned by ticketgal.
#   * It never prints .env values: it only asks the app for paths, host and port.
#   * Everything is inside main(), called on the last line: git may rewrite this file during an
#     update, and bash must have read all of it before that happens.

main() {
    set -Eeuo pipefail   # -E: the ERR trap also fires inside helper functions

    # ------------------------------------------------------------ settings (overridable for tests)
    APP=${TICKETGAL_APP:-/home/ticketgal/TicketGal}                 # the git checkout
    APP_USER=${TICKETGAL_USER:-ticketgal}                           # owner of the checkout and the service user
    SERVICE=${TICKETGAL_SERVICE:-ticketgal}                         # systemd unit name (without .service)
    WRAPPER=${TICKETGAL_WRAPPER:-/usr/local/bin/ticketgal-admin}    # where the small wrapper is installed
    BACKUP_DIR=${TICKETGAL_BACKUP_DIR:-/var/backups/ticketgal}      # update + manual DB backups live here
    PY=${TICKETGAL_PYTHON:-$APP/.venv/bin/python}                   # the app's virtualenv Python
    BRANCH=${TICKETGAL_BRANCH:-main}                                # the branch prod follows
    HEALTH_TIMEOUT=${TICKETGAL_HEALTH_TIMEOUT:-90}                  # seconds to wait for /health after a restart
    KEEP_BACKUPS=${TICKETGAL_KEEP_BACKUPS:-10}                      # how many backup sets to keep
    TEST_MODE=${TICKETGAL_ADMIN_TEST:-}                             # set by the test harness only
    REMOTE=origin

    local cmd=${1:-help}
    shift || true

    case $cmd in
        help|-h|--help) usage; return 0 ;;
        update|check-updates|restart|status|logs|backup) ;;
        *) usage >&2; die "unknown command: $cmd" ;;
    esac

    # Everything except help needs root: systemctl, the backup folder and running as ticketgal.
    [ "$(id -u)" = 0 ] || [ -n "$TEST_MODE" ] || die "run it with sudo: sudo ticketgal-admin $cmd"
    [ -d "$APP/.git" ] || die "$APP is not a git checkout (set TICKETGAL_APP if TicketGal lives elsewhere)"

    # One ticketgal-admin at a time, so two updates can't race each other.
    if [ -z "$TEST_MODE" ]; then
        exec 9>/run/ticketgal-admin.lock                              # lock file, fd 9 stays open until we exit
        flock -n 9 || die "another ticketgal-admin is already running"
    fi

    case $cmd in
        check-updates) cmd_update check-updates "$@" ;;
        update)        cmd_update update "$@" ;;
        restart)       cmd_restart ;;
        status)        cmd_status ;;
        logs)          cmd_logs "$@" ;;
        backup)        load_app_settings; take_backup manual >/dev/null; echo "Backup saved in $LAST_BACKUP" ;;
    esac
}

# ==================================================================== commands

cmd_update() {  # MODE [--yes]: check-updates only reports; update does the work
    local mode=$1; shift
    local assume_yes=0 arg
    for arg in "$@"; do
        case $arg in
            --yes|-y) assume_yes=1 ;;                              # skip the "Update now?" question
            *) die "unknown option: $arg" ;;
        esac
    done

    cd "$APP"
    step "Checking GitHub ($(git_ remote get-url "$REMOTE"), branch $BRANCH)"
    git_ fetch --quiet "$REMOTE" "$BRANCH"                          # download, change nothing yet
    current=$(git_ rev-parse HEAD)                                  # what's running now
    target=$(git_ rev-parse "$REMOTE/$BRANCH")                      # what GitHub has

    if [ "$current" = "$target" ]; then
        echo "TicketGal is up to date ($(git_ log -1 --format='%h, %cd: %s' --date=short HEAD))."
        return 0
    fi
    git_ merge-base --is-ancestor "$current" "$target" \
        || die "this checkout has commits GitHub's $BRANCH doesn't, so it can't fast-forward. Sort it out by hand in $APP."

    # Local edits block an update; an update never overwrites them. Exec-bit-only changes are ignored
    # (core.fileMode=false in git_), and untracked files (app/knowledgebase/, .env, DBs) are fine.
    local dirty
    dirty=$(git_ status --porcelain --untracked-files=no)
    if [ -n "$dirty" ]; then
        printf '%s\n' "$dirty" >&2
        die "$APP has local changes (above). Commit, move or undo them first (for a deleted file: sudo -u $APP_USER git -C $APP checkout -- <file>)."
    fi

    # ------------------------------------------------------------ what's new
    local changed deps unit wrapper_changed nginx_changed
    changed=$(git_ diff --name-only "$current" "$target")           # every file the update touches
    deps=$(grep -E '^requirements\.txt$' <<<"$changed" || true)
    unit=$(grep -E '^ticketgal\.service$' <<<"$changed" || true)
    wrapper_changed=$(grep -E '^deploy/admin/ticketgal-admin$' <<<"$changed" || true)
    nginx_changed=$(grep -E '^deploy/(nginx|modsecurity)/' <<<"$changed" || true)

    echo
    echo "$(git_ rev-list --count "$current..$target") update(s) available: $(git_ log -1 --format=%h HEAD) -> $(git_ log -1 --format=%h "$target")"
    git_ log --format='  %h %cd  %s' --date=short "$current..$target"
    echo
    echo "  * The four databases are backed up first (to $BACKUP_DIR)"
    [ -n "$deps" ] && echo "  * Python packages change (pip install -r requirements.txt)"
    [ -n "$wrapper_changed" ] && echo "  * The ticketgal-admin command itself changes (re-installed to $WRAPPER)"
    [ -n "$unit" ] && echo "  * ticketgal.service changed in the repo. NOT installed automatically (install.sh writes its own); compare by hand"
    [ -n "$nginx_changed" ] && echo "  * nginx/ModSecurity templates changed. NOT applied automatically; see scripts/install_nginx_modsecurity.sh"
    echo "  * $SERVICE restarts (it applies any database changes at start-up), then nginx reloads"

    if [ "$mode" = check-updates ]; then
        echo
        echo "To install: sudo ticketgal-admin update"
        return 0
    fi

    if [ "$assume_yes" != 1 ]; then
        local answer=""
        read -r -p "Update now? [y/N] " answer || true
        case $answer in y|Y|yes|YES) ;; *) echo "Nothing changed."; return 0 ;; esac
    fi

    # ------------------------------------------------------------ backup
    load_app_settings                                               # DB paths, host and port, from the app itself
    take_backup "before-$(git_ log -1 --format=%h HEAD)"            # sets LAST_BACKUP
    local backup=$LAST_BACKUP

    phase=start
    saved_wrapper=""
    trap 'on_error' ERR                                             # any failure from here on → undo

    # ------------------------------------------------------------ update
    phase="updating the code"
    step "Updating the code to $(git_ log -1 --format=%h "$target")"
    git_ merge --ff-only --quiet "$target"

    if [ -n "$deps" ]; then
        phase="installing Python packages"
        step "Installing Python packages"
        install_packages
    fi

    if [ -n "$wrapper_changed" ] && [ -z "$TEST_MODE" ]; then
        phase="installing the new ticketgal-admin"
        saved_wrapper=$(mktemp)                                     # keep the old wrapper for an undo
        [ -e "$WRAPPER" ] && cp -p "$WRAPPER" "$saved_wrapper"
        install -m 755 "$APP/deploy/admin/ticketgal-admin" "$WRAPPER"
        echo "  Updated $WRAPPER"
    fi

    # ------------------------------------------------------------ restart
    phase="restarting"
    restart_all || fail "TicketGal didn't come back healthy"
    trap - ERR

    record "update ok $(short "$current") -> $(short "$target") backup=$backup"
    step "Updated to $(git_ log -1 --format='%h (%cd) %s' --date=short HEAD)"
    echo "  Database backup: $backup"
}

cmd_restart() {  # restart TicketGal + reload nginx, then health check
    load_app_settings
    restart_all || die "TicketGal didn't come back healthy. Look at: sudo ticketgal-admin logs"
    record "restart ok $(short "$(git_ rev-parse HEAD)")"
}

cmd_status() {  # a quick read-only overview
    load_app_settings
    cd "$APP"
    step "TicketGal status"
    echo "  Code:     $(git_ log -1 --format='%h (%cd) %s' --date=short HEAD) on $(git_ rev-parse --abbrev-ref HEAD)"
    local dirty
    dirty=$(git_ status --porcelain --untracked-files=no)
    if [ -n "$dirty" ]; then
        echo "  Local changes (they block updates):"
        sed 's/^/    /' <<<"$dirty"                                 # one indented line per changed file
    fi
    echo "  Service:  $SERVICE is $(systemctl is-active "$SERVICE" 2>/dev/null || true) (since $(systemctl show "$SERVICE" -p ActiveEnterTimestamp --value 2>/dev/null || echo '?'))"
    if systemctl list-unit-files nginx.service >/dev/null 2>&1; then
        echo "  nginx:    $(systemctl is-active nginx 2>/dev/null || true)"
    fi
    local reply
    if reply=$(curl --noproxy '*' -ksS --max-time 5 "$HEALTH_URL" 2>&1); then
        echo "  Health:   $reply ($HEALTH_URL)"
    else
        echo "  Health:   not answering ($HEALTH_URL)"
    fi
    echo "  Databases:"
    local db
    for db in "${DB_FILES[@]}"; do
        if [ -e "$db" ]; then echo "    $(du -h "$db" | cut -f1)  $db"; else echo "    (missing)  $db"; fi
    done
    echo "  Last backups in $BACKUP_DIR:"
    ls -1t "$BACKUP_DIR" 2>/dev/null | grep -v '\.log$' | head -n 3 | sed 's/^/    /' || true
    [ -e "$BACKUP_DIR/history.log" ] && echo "  Last action: $(tail -n 1 "$BACKUP_DIR/history.log")"
    return 0
}

cmd_logs() {  # [N]: tail the service journal
    local lines=${1:-50}
    [[ "$lines" =~ ^[0-9]{1,5}$ ]] || die "logs takes a number of lines, e.g. sudo ticketgal-admin logs 100"
    journalctl -u "$SERVICE" -n "$lines" --no-pager
}

# ==================================================================== helpers

usage() {
    sed -n '2,11p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'   # the command list from the header above
}

step() { printf '\n== %s\n' "$*"; }
die() { printf 'ticketgal-admin: %s\n' "$*" >&2; exit 1; }
short() { printf '%s' "${1:0:7}"; }                                 # a commit hash, shortened

as_app() {  # CMD...: run a command as the ticketgal user (directly in test mode)
    if [ -n "$TEST_MODE" ]; then "$@"; else runuser -u "$APP_USER" -- "$@"; fi
}

git_() {  # git in the app folder, as ticketgal, ignoring exec-bit-only differences (prod drift TG-02)
    as_app git -C "$APP" -c core.fileMode=false "$@"
}

load_app_settings() {  # ask the app itself for its DB paths, host and port (never other .env values)
    local out
    out=$(cd "$APP" && as_app "$PY" -c '
from pathlib import Path
from app.config import settings as s
for p in (s.db_path, s.ticket_cache_db_path, s.transactions_db_path, s.knowledgebase_db_path):
    print("DB=" + Path(p).as_posix())
print("HOST=" + s.host)
print("PORT=" + str(s.port))
') || die "couldn't read TicketGal's settings with $PY"
    DB_FILES=()
    local line host="" port=""
    while IFS= read -r line; do
        line=${line%$'\r'}                                          # drop a Windows CR (only seen in local tests)
        case $line in
            DB=*) DB_FILES+=("${line#DB=}") ;;
            HOST=*) host=${line#HOST=} ;;
            PORT=*) port=${line#PORT=} ;;
        esac
    done <<<"$out"
    # start-prod.sh only reads HOST/PORT from .env; config defaults (127.0.0.1:8000) match it.
    case $host in ''|0.0.0.0) host=127.0.0.1 ;; ::|'[::]') host='[::1]' ;; esac
    local scheme=http
    if [ -r "$APP/.env" ] && grep -qiE '^HTTPS_ENABLED=["'\'']?(1|true|yes)' "$APP/.env"; then
        scheme=https                                                # direct TLS mode (not used behind nginx)
    fi
    HEALTH_URL="$scheme://$host:${port:-8000}/health"
}

take_backup() {  # LABEL: copy the four SQLite DBs with sqlite's online backup; sets LAST_BACKUP
    local label=$1 stamp dest db
    stamp=$(date +%Y%m%d-%H%M%S)
    dest="$BACKUP_DIR/$stamp-$label"
    if [ -z "$TEST_MODE" ]; then
        install -d -o root -g "$APP_USER" -m 770 "$BACKUP_DIR"     # root-owned, ticketgal may write into it
    else
        mkdir -p "$BACKUP_DIR"
    fi
    as_app mkdir -p "$dest"
    step "Backing up the databases to $dest"
    for db in "${DB_FILES[@]}"; do
        [ -e "$db" ] || { echo "  (skipped, doesn't exist yet) $db"; continue; }
        # sqlite3's backup API gives a consistent copy even while the app is writing.
        as_app "$PY" -c 'import sqlite3, sys; d = sqlite3.connect(sys.argv[2]); sqlite3.connect(sys.argv[1]).backup(d); d.close()' \
            "$db" "$dest/$(basename "$db")"
        echo "  $(basename "$db")"
    done
    [ -z "$TEST_MODE" ] && chmod -R go-rwx "$dest" && chmod g+rx "$dest"   # DB copies hold user data: owner only
    LAST_BACKUP=$dest
    # Keep the newest KEEP_BACKUPS sets.
    local old
    for old in $(ls -1dt "$BACKUP_DIR"/*/ 2>/dev/null | tail -n +"$((KEEP_BACKUPS + 1))"); do
        rm -rf "$old"
    done
    record "backup $dest"
}

install_packages() {  # pip install the pinned requirements into the app's venv, as ticketgal
    as_app "$PY" -m pip install --quiet --disable-pip-version-check -r "$APP/requirements.txt"
}

restart_all() {  # restart the app, wait for /health, then reload nginx if it's there
    step "Restarting $SERVICE"
    systemctl restart "$SERVICE"
    wait_healthy || return 1
    if systemctl is-active --quiet nginx 2>/dev/null; then
        step "Reloading nginx"
        if nginx -t -q 2>/dev/null; then
            systemctl reload nginx
        else
            echo "  nginx -t failed, so nginx was NOT reloaded (TicketGal itself is fine). Check: sudo nginx -t" >&2
        fi
    fi
    return 0
}

wait_healthy() {  # poll /health until it answers ok/degraded or HEALTH_TIMEOUT runs out
    local deadline=$((SECONDS + HEALTH_TIMEOUT)) started=$SECONDS reply last="no answer yet"
    step "Waiting up to ${HEALTH_TIMEOUT}s for $HEALTH_URL"
    while (( SECONDS < deadline )); do
        # Local service: skip proxies, accept the self-signed dev cert, bound every request.
        if reply=$(curl --noproxy '*' -ksS --connect-timeout 2 --max-time 5 "$HEALTH_URL" 2>&1); then
            # "degraded" only means Atera is unreachable: TicketGal itself is up.
            if grep -qE '"status"[[:space:]]*:[[:space:]]*"(ok|degraded)"' <<<"$reply"; then
                echo "  Healthy after $((SECONDS - started))s: $reply"
                return 0
            fi
            last="answered without status ok: ${reply:0:200}"
        else
            last=${reply:0:300}
        fi
        sleep 2
    done
    printf '  Health check timed out after %ss: %s\n' "$HEALTH_TIMEOUT" "$last" >&2
    return 1
}

record() {  # MESSAGE: one line of history next to the backups
    mkdir -p "$BACKUP_DIR" 2>/dev/null || true
    printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >> "$BACKUP_DIR/history.log" 2>/dev/null || true
}

on_error() { fail "a step exited with an error (see above)"; }

fail() {  # MESSAGE: an update went wrong: undo the code and bring the old version back
    trap - ERR
    printf '\nticketgal-admin: update failed while %s: %s\n' "$phase" "$*" >&2
    step "Undoing the update (back to $(short "$current"))"
    set +e
    git_ reset --hard --quiet "$current"                            # old code back
    install_packages                                                # old packages back
    if [ -n "$saved_wrapper" ] && [ -s "$saved_wrapper" ]; then
        install -m 755 "$saved_wrapper" "$WRAPPER"                  # old wrapper back
    fi
    if restart_all; then
        echo "  Back on $(short "$current"); TicketGal is running."
        record "update FAILED while $phase; undone to $(short "$current")"
    else
        echo "  TicketGal still isn't healthy after the undo. Look at: sudo ticketgal-admin logs 100" >&2
        record "update FAILED while $phase; undo did NOT bring it back"
    fi
    # Databases are left as they are: TicketGal's start-up migrations only add columns and tables,
    # which the old code ignores. The pre-update copy is in the backup folder if it's ever needed.
    echo "  Pre-update database backup: $LAST_BACKUP"
    journalctl -u "$SERVICE" -n 15 --no-pager 2>/dev/null || true
    exit 1
}

main "$@"; exit $?
