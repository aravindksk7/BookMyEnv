#!/bin/bash

# BookMyEnv - SSL Certificate Generator for Linux/Mac
# This script generates self-signed SSL certificates for development/testing
# For production, use Let's Encrypt or a commercial CA

set -e

DOMAIN="${1:-localhost}"
DAYS="${2:-365}"
OUTPUT_DIR="./nginx/ssl"

echo "========================================"
echo "  BookMyEnv SSL Certificate Generator  "
echo "========================================"
echo ""

# Check if OpenSSL is available
if ! command -v openssl &> /dev/null; then
    echo "[ERROR] OpenSSL not found!"
    echo ""
    echo "Please install OpenSSL:"
    echo "  - Ubuntu/Debian: sudo apt-get install openssl"
    echo "  - macOS: brew install openssl"
    echo "  - CentOS/RHEL: sudo yum install openssl"
    exit 1
fi

echo "[OK] OpenSSL found: $(openssl version)"

# Create output directory
mkdir -p "$OUTPUT_DIR"
echo "[OK] Created directory: $OUTPUT_DIR"

KEY_FILE="$OUTPUT_DIR/server.key"
CRT_FILE="$OUTPUT_DIR/server.crt"
CONFIG_FILE="$OUTPUT_DIR/openssl.cnf"

# Create OpenSSL config
cat > "$CONFIG_FILE" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req
req_extensions = v3_req

[dn]
C = US
ST = State
L = City
O = BookMyEnv
OU = Development
CN = $DOMAIN

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = *.$DOMAIN
DNS.3 = localhost
DNS.4 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

echo "[OK] Created OpenSSL config"

# Generate private key
echo "[...] Generating private key..."
openssl genrsa -out "$KEY_FILE" 2048 2>/dev/null
echo "[OK] Private key generated: $KEY_FILE"

# Generate certificate
echo "[...] Generating self-signed certificate..."
openssl req -new -x509 \
    -key "$KEY_FILE" \
    -out "$CRT_FILE" \
    -days "$DAYS" \
    -config "$CONFIG_FILE" \
    2>/dev/null
echo "[OK] Certificate generated: $CRT_FILE"

# Display certificate info
echo ""
echo "========================================"
echo "  Certificate Information              "
echo "========================================"
openssl x509 -in "$CRT_FILE" -noout -subject -dates

echo ""
echo "========================================"
echo "  SSL Certificates Generated!          "
echo "========================================"
echo ""
echo "Files created:"
echo "  - Private Key: $KEY_FILE"
echo "  - Certificate: $CRT_FILE"
echo ""
echo "Next steps:"
echo "  1. Start with HTTPS:"
echo "     docker-compose -f docker-compose.https.yml up -d"
echo ""
echo "  2. Access the app:"
echo "     https://localhost"
echo ""
echo "  3. Accept the self-signed certificate warning in your browser"
echo ""
echo "[NOTE] For production, replace with certificates from Let's Encrypt or a CA"
echo ""

# Clean up config file
rm -f "$CONFIG_FILE"

# Set permissions
chmod 600 "$KEY_FILE"
chmod 644 "$CRT_FILE"
