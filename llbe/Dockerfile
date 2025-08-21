# Dockerfile for Telepresence LLBE
FROM ubuntu:22.04

# Avoid interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    pkg-config \
    libssl-dev \
    libgtest-dev \
    nlohmann-json3-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Build and install libdatachannel from source
RUN git clone https://github.com/paullouisageneau/libdatachannel.git /tmp/libdatachannel \
    && cd /tmp/libdatachannel \
    && cmake -B build -DUSE_GNUTLS=0 -DUSE_NICE=0 -DCMAKE_BUILD_TYPE=Release \
    && cd build \
    && make -j$(nproc) \
    && make install \
    && ldconfig \
    && rm -rf /tmp/libdatachannel

# Set working directory
WORKDIR /app

# Copy source code
COPY . .

# Build the project
RUN mkdir build && cd build \
    && cmake .. -DCMAKE_BUILD_TYPE=Release \
    && make -j$(nproc)

# Create test certificates
RUN openssl req -x509 -newkey rsa:4096 -keyout build/key.pem -out build/cert.pem -days 365 -nodes \
    -subj "/C=US/ST=CA/L=San Francisco/O=Telepresence/CN=localhost"

# Expose the default port
EXPOSE 8443/udp

# Set the working directory to build
WORKDIR /app/build

# Run the application
CMD ["./telepresence_llbe"]
