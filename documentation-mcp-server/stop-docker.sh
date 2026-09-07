#!/bin/bash

# Configuration
CONTAINER_NAME="watsonx-orchestrate-documentation-mcp-server"
PORT=3033

echo "🛑 Stopping Docker container: ${CONTAINER_NAME}..."

# Check if container is running
if [ "$(docker ps -q -f name=${CONTAINER_NAME})" ]; then
    echo "   Stopping running container..."
    docker stop ${CONTAINER_NAME}
    
    if [ $? -eq 0 ]; then
        echo "✅ Container stopped successfully"
    else
        echo "❌ Failed to stop container"
        exit 1
    fi
else
    echo "ℹ️  Container is not running"
fi

# Check if container exists (stopped)
if [ "$(docker ps -aq -f name=${CONTAINER_NAME})" ]; then
    echo "🗑️  Removing container..."
    docker rm ${CONTAINER_NAME}
    
    if [ $? -eq 0 ]; then
        echo "✅ Container removed successfully"
    else
        echo "❌ Failed to remove container"
        exit 1
    fi
else
    echo "ℹ️  Container does not exist"
fi

# Check if port is still in use
if lsof -Pi :${PORT} -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port ${PORT} is still in use"
    PID=$(lsof -Pi :${PORT} -sTCP:LISTEN -t)
    if [ ! -z "$PID" ]; then
        echo "   Process ${PID} is using port ${PORT}"
        echo "   Run: kill -9 ${PID}"
    fi
else
    echo "✅ Port ${PORT} is free"
fi

echo ""
echo "✨ Done!"

# Made with Bob