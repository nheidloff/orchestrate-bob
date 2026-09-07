#!/bin/bash

# Script to download all documentation files from llms.txt
# Preserves directory structure in the 'download' folder

set -e  # Exit on error

# Configuration
BASE_URL="https://developer.watson-orchestrate.ibm.com"
LLMS_TXT_URL="${BASE_URL}/llms.txt"
DOWNLOAD_DIR="documentation"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting documentation download...${NC}"

# Remove existing download directory and create fresh one
rm -rf "$DOWNLOAD_DIR"
mkdir -p "$DOWNLOAD_DIR"

# Download llms.txt
echo -e "${BLUE}Downloading llms.txt...${NC}"
curl -s "$LLMS_TXT_URL" -o "${DOWNLOAD_DIR}/llms.txt"

# Extract URLs from llms.txt (lines containing https://developer.watson-orchestrate.ibm.com/)
echo -e "${BLUE}Parsing URLs from llms.txt...${NC}"
urls=$(grep -oE 'https://developer\.watson-orchestrate\.ibm\.com/[^)]+' "${DOWNLOAD_DIR}/llms.txt" | sort -u)

# Count total files
total_files=$(echo "$urls" | wc -l | tr -d ' ')
current=0

echo -e "${BLUE}Found ${total_files} unique files to download${NC}"
echo ""

# Download each file
while IFS= read -r url; do
    if [ -z "$url" ]; then
        continue
    fi
    
    current=$((current + 1))
    
    # Extract the path after the base URL
    relative_path="${url#$BASE_URL/}"
    
    # Create the full local path
    local_path="${DOWNLOAD_DIR}/${relative_path}"
    
    # Create directory structure
    local_dir=$(dirname "$local_path")
    mkdir -p "$local_dir"
    
    # Download the file
    echo -e "${BLUE}[${current}/${total_files}]${NC} Downloading: ${relative_path}"
    
    if curl -s -f "$url" -o "$local_path"; then
        echo -e "${GREEN}✓ Success${NC}"
    else
        echo -e "${RED}✗ Failed to download: ${url}${NC}"
    fi
    
done <<< "$urls"

echo ""
echo -e "${BLUE}Cleaning up unwanted files...${NC}"

# Remove specific files that should not be kept
files_to_remove=(
    "index.md"
    "llms.txt"
    "tutorials/testing_voice/apis/api.json"
    "apis/server_openapi.json"
    "api-reference/openapi.json"
    "license/la_en.md"
    "license/li_en.md"
    "non_ibm_license.md"
    "license/notices.md"
    "notices/notices.md"
    "notices/spbd.md"
)

for file in "${files_to_remove[@]}"; do
    file_path="${DOWNLOAD_DIR}/${file}"
    if [ -f "$file_path" ]; then
        rm "$file_path"
        echo -e "${BLUE}Removed: ${file}${NC}"
    fi
done

echo ""
echo -e "${GREEN}Download complete!${NC}"
echo -e "${BLUE}Files saved to: ${DOWNLOAD_DIR}/${NC}"
echo -e "${BLUE}Total files downloaded: ${current}${NC}"

# Made with Bob
