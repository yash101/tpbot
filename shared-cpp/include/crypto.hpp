#ifndef SHARED_CPP_INCLUDE_CRYPTO_HPP
#define SHARED_CPP_INCLUDE_CRYPTO_HPP

#include <stdint.h>

namespace crypto
{
  // kinda bad to use int for len but our max message sizes are small:
  // ~2304B due to MSDU limit over WiFi AX
  // 9000-14B for jumbo frames
  extern void sha256_hash(const uint8_t* data, int len, uint8_t out[32]);
  extern bool sha256_verify(const uint8_t* data, int len, const uint8_t expected[32]);
}

#endif // SHARED_CPP_INCLUDE_CRYPTO_HPP
