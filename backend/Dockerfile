# CONCH Platform - Rust Backend Dockerfile
FROM rust:1.88 AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Update Rust toolchain
RUN rustup update

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Build dependencies first (for caching)
RUN mkdir src && echo "fn main() {}" > src/main.rs && echo "" > src/lib.rs
RUN cargo build --release
RUN rm -rf src

# Copy source and rebuild (touch forces Cargo to recompile)
COPY src ./src
RUN touch src/main.rs src/lib.rs && cargo build --release

# Production image
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 conch

# Copy binary
COPY --from=builder /app/target/release/conch-server /usr/local/bin/conch-server

# Switch to non-root user
USER conch

# Expose port
EXPOSE 3000

# Run the server
CMD ["conch-server"]
