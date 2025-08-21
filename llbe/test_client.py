#!/usr/bin/env python3
"""
Simple DTLS client for testing the Telepresence LLBE server
This is a basic test client to verify server connectivity
"""

import socket
import ssl
import sys
import time
import argparse

def create_dtls_client(host, port, cert_file=None):
    """Create a DTLS client connection"""
    try:
        # Create UDP socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        
        # Create SSL context for DTLS
        context = ssl.SSLContext(ssl.PROTOCOL_DTLSv1_2)
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE  # For testing with self-signed certs
        
        if cert_file:
            context.load_verify_locations(cert_file)
            context.verify_mode = ssl.CERT_REQUIRED
        
        # Wrap socket with DTLS
        dtls_sock = context.wrap_socket(sock, server_hostname=host)
        
        print(f"Connecting to {host}:{port}...")
        dtls_sock.connect((host, port))
        
        print("DTLS handshake completed!")
        return dtls_sock
        
    except Exception as e:
        print(f"Error creating DTLS connection: {e}")
        return None

def test_communication(dtls_sock):
    """Test basic communication with the server"""
    try:
        # Send test message
        test_message = b"Hello from DTLS client!"
        print(f"Sending: {test_message.decode()}")
        dtls_sock.send(test_message)
        
        # Receive response
        response = dtls_sock.recv(1024)
        print(f"Received: {response.decode()}")
        
        # Send a few more messages
        for i in range(3):
            message = f"Test message {i+1}".encode()
            print(f"Sending: {message.decode()}")
            dtls_sock.send(message)
            
            response = dtls_sock.recv(1024)
            print(f"Received: {response.decode()}")
            
            time.sleep(1)
            
    except Exception as e:
        print(f"Error during communication: {e}")

def main():
    parser = argparse.ArgumentParser(description="DTLS test client for Telepresence LLBE")
    parser.add_argument("--host", default="localhost", help="Server host (default: localhost)")
    parser.add_argument("--port", type=int, default=8443, help="Server port (default: 8443)")
    parser.add_argument("--cert", help="Server certificate file for verification")
    parser.add_argument("--messages", type=int, default=5, help="Number of test messages to send")
    
    args = parser.parse_args()
    
    print("=== Telepresence LLBE DTLS Test Client ===")
    print(f"Target: {args.host}:{args.port}")
    
    # Create DTLS connection
    dtls_sock = create_dtls_client(args.host, args.port, args.cert)
    if not dtls_sock:
        print("Failed to create DTLS connection")
        sys.exit(1)
    
    try:
        # Test communication
        test_communication(dtls_sock)
        
        print("\nTest completed successfully!")
        
    finally:
        # Clean up
        dtls_sock.close()
        print("Connection closed")

if __name__ == "__main__":
    main()
