#!/bin/bash

# Configuration
IMAGE_NAME="watsonx-doc-mcp-server"
CONTAINER_NAME="watsonx-doc-mcp"
PORT=3033

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo "   Please start Docker Desktop and try again."
    exit 1
fi

echo "🔨 Building Docker image: ${IMAGE_NAME}..."
docker build -t ${IMAGE_NAME} .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Docker image built successfully"

# Check if container is running
if [ "$(docker ps -q -f name=${CONTAINER_NAME})" ]; then
    echo "🛑 Stopping running container: ${CONTAINER_NAME}..."
    docker stop ${CONTAINER_NAME}
    sleep 2
fi

# Check if container exists (stopped)
if [ "$(docker ps -aq -f name=${CONTAINER_NAME})" ]; then
    echo "🗑️  Removing existing container: ${CONTAINER_NAME}..."
    docker rm ${CONTAINER_NAME}
    sleep 1
fi

# Check if port is in use and kill the process
if lsof -Pi :${PORT} -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port ${PORT} is in use. Attempting to free it..."
    PID=$(lsof -Pi :${PORT} -sTCP:LISTEN -t)
    if [ ! -z "$PID" ]; then
        echo "   Killing process ${PID}..."
        kill -9 $PID 2>/dev/null || true
        sleep 2
    fi
fi

echo "🚀 Starting new container: ${CONTAINER_NAME}..."
docker run -d \
    --name ${CONTAINER_NAME} \
    -p ${PORT}:${PORT} \
    ${IMAGE_NAME}

if [ $? -ne 0 ]; then
    echo "❌ Failed to start container!"
    exit 1
fi

echo "✅ Container started successfully"
echo "📊 Container status:"
docker ps -f name=${CONTAINER_NAME}

echo ""
echo "🔗 Server should be available at: http://localhost:${PORT}"
echo ""
echo "📝 Useful commands:"
echo "  View logs:    docker logs -f ${CONTAINER_NAME}"
echo "  Stop:         docker stop ${CONTAINER_NAME}"
echo "  Remove:       docker rm ${CONTAINER_NAME}"
echo "  Shell access: docker exec -it ${CONTAINER_NAME} /bin/bash"

# Made with Bob
