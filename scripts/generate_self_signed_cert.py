from __future__ import annotations

import argparse
import ipaddress
import socket
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Iterable, List

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


def _normalize_hosts(raw_hosts: Iterable[str]) -> List[str]:
    hosts = []
    seen = set()
    for item in raw_hosts:
        value = item.strip()
        if not value:
            continue
        if value in {"0.0.0.0", "::", "[::]"}:
            continue
        if value not in seen:
            seen.add(value)
            hosts.append(value)
    return hosts


def _build_san(hosts: Iterable[str]) -> x509.SubjectAlternativeName:
    entries = []
    for host in hosts:
        try:
            entries.append(x509.IPAddress(ipaddress.ip_address(host)))
        except ValueError:
            entries.append(x509.DNSName(host))
    return x509.SubjectAlternativeName(entries)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a local self-signed TLS certificate.")
    parser.add_argument("--cert-file", required=True, help="Path to write certificate PEM file")
    parser.add_argument("--key-file", required=True, help="Path to write private key PEM file")
    parser.add_argument(
        "--hosts",
        default="localhost,127.0.0.1",
        help="Comma-separated DNS names/IPs to include in SubjectAltName",
    )
    parser.add_argument("--days", type=int, default=365, help="Certificate validity in days")
    args = parser.parse_args()

    cert_path = Path(args.cert_file)
    key_path = Path(args.key_file)
    cert_path.parent.mkdir(parents=True, exist_ok=True)
    key_path.parent.mkdir(parents=True, exist_ok=True)

    local_hostname = socket.gethostname()
    fqdn = socket.getfqdn()
    hosts = _normalize_hosts(
        [*args.hosts.split(","), "localhost", "127.0.0.1", "::1", local_hostname, fqdn]
    )

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    subject = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "TicketGal Local"),
            x509.NameAttribute(NameOID.COMMON_NAME, hosts[0] if hosts else "localhost"),
        ]
    )

    now = datetime.now(UTC)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(days=max(1, args.days)))
        .add_extension(_build_san(hosts), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(private_key=key, algorithm=hashes.SHA256())
    )

    key_path.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))

    print(f"Wrote certificate: {cert_path}")
    print(f"Wrote private key: {key_path}")
    print(f"SAN hosts: {', '.join(hosts)}")


if __name__ == "__main__":
    main()
