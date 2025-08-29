/**
 * SHA-256 implementation with optional mbedTLS acceleration.
 * 
 * Note: this is meant to use mbedTLS. The SHA256 implementation was LLM-generated
 * so might be a bit buggy. Switch to a well-known implementation if mbedTLS is dropped.
 */

#include <cstdint>
#include <cstring>

#ifdef HAVE_MBEDTLS
#include <mbedtls/sha256.h>
#endif

extern void sha256_hash(const uint8_t *data, int len, uint8_t out[32]);
extern bool sha256_verify(const uint8_t *data, int len, const uint8_t expected[32]);

#ifdef HAVE_MBEDTLS
void sha256_hash(const uint8_t *data, int len, uint8_t out[32])
{
#if defined(MBEDTLS_SHA256_ALT) || !defined(MBEDTLS_SHA256_C)
    // If the one-shot convenience API isn't available, fall back to starts/update/finish
    mbedtls_sha256_context ctx;
    mbedtls_sha256_init(&ctx);
    mbedtls_sha256_starts_ret(&ctx, 0); // 0 = SHA-256, not SHA-224
    mbedtls_sha256_update_ret(&ctx, data, static_cast<size_t>(len));
    mbedtls_sha256_finish_ret(&ctx, out);
    mbedtls_sha256_free(&ctx);
#else
    // Use the one-shot API which is simpler and avoids per-call init/free overhead
    // mbedtls_sha256_ret returns 0 on success
    mbedtls_sha256_ret(reinterpret_cast<const unsigned char*>(data), static_cast<size_t>(len), out, 0);
#endif
}
#else
// builtin fallback (stable reference-like implementation)
#include <vector>
#include <cstdint>
#include <cstring>

namespace
{
  inline uint32_t rotr(uint32_t x, unsigned n) { return (x >> n) | (x << (32 - n)); }
  inline uint32_t ch(uint32_t x, uint32_t y, uint32_t z) { return (x & y) ^ (~x & z); }
  inline uint32_t maj(uint32_t x, uint32_t y, uint32_t z) { return (x & y) ^ (x & z) ^ (y & z); }
  inline uint32_t bsig0(uint32_t x) { return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22); }
  inline uint32_t bsig1(uint32_t x) { return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25); }
  inline uint32_t ssig0(uint32_t x) { return rotr(x, 7) ^ rotr(x, 18) ^ (x >> 3); }
  inline uint32_t ssig1(uint32_t x) { return rotr(x, 17) ^ rotr(x, 19) ^ (x >> 10); }

  const uint32_t K[64] = {
      0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
      0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u, 0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
      0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
      0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
      0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u, 0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
      0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
      0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
      0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u, 0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u};

  // constant-time memory compare
  bool ct_equal(const uint8_t *a, const uint8_t *b, size_t n)
  {
    uint8_t diff = 0;
    for (size_t i = 0; i < n; ++i)
      diff |= a[i] ^ b[i];
    return diff == 0;
  }

} // namespace

void sha256_hash(const uint8_t *data, int len, uint8_t out[32])
{
  // Initial hash values
  uint32_t h[8] = {
      0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
      0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u};

  // Pre-processing: padding
  uint64_t bitlen = static_cast<uint64_t>(len) * 8ULL;

  // Compute padded length: original + 1 (0x80) + padding + 8 (length) = multiple of 64
  size_t pad_len = 1 + 8; // at least
  size_t rem = (len + 1 + 8) % 64;
  if (rem != 0)
    pad_len += (64 - rem);

  size_t total = static_cast<size_t>(len) + pad_len;
  std::vector<uint8_t> buf;
  buf.reserve(total);
  buf.insert(buf.end(), data, data + len);
  buf.push_back(0x80);
  if (pad_len > 1)
    buf.insert(buf.end(), pad_len - 1 - 8, 0x00);

  // append length in bits as big-endian 64-bit
  for (int i = 7; i >= 0; --i)
    buf.push_back(static_cast<uint8_t>((bitlen >> (8 * i)) & 0xFFu));

  // Process each 512-bit chunk
  size_t chunks = buf.size() / 64;
  for (size_t c = 0; c < chunks; ++c)
  {
    const uint8_t *chunk = buf.data() + c * 64;
    uint32_t w[64];
    for (int i = 0; i < 16; ++i)
    {
      w[i] = (static_cast<uint32_t>(chunk[i * 4]) << 24) |
             (static_cast<uint32_t>(chunk[i * 4 + 1]) << 16) |
             (static_cast<uint32_t>(chunk[i * 4 + 2]) << 8) |
             (static_cast<uint32_t>(chunk[i * 4 + 3]));
    }
    for (int i = 16; i < 64; ++i)
      w[i] = ssig1(w[i - 2]) + w[i - 7] + ssig0(w[i - 15]) + w[i - 16];

    uint32_t a = h[0];
    uint32_t b = h[1];
    uint32_t c2 = h[2];
    uint32_t d = h[3];
    uint32_t e = h[4];
    uint32_t f = h[5];
    uint32_t g = h[6];
    uint32_t hh = h[7];

    for (int t = 0; t < 64; ++t)
    {
      uint32_t T1 = hh + bsig1(e) + ch(e, f, g) + K[t] + w[t];
      uint32_t T2 = bsig0(a) + maj(a, b, c2);
      hh = g;
      g = f;
      f = e;
      e = d + T1;
      d = c2;
      c2 = b;
      b = a;
      a = T1 + T2;
    }

    h[0] += a;
    h[1] += b;
    h[2] += c2;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }

  // Produce the final hash value (big-endian)
  for (int i = 0; i < 8; ++i)
  {
    out[i * 4 + 0] = static_cast<uint8_t>((h[i] >> 24) & 0xFFu);
    out[i * 4 + 1] = static_cast<uint8_t>((h[i] >> 16) & 0xFFu);
    out[i * 4 + 2] = static_cast<uint8_t>((h[i] >> 8) & 0xFFu);
    out[i * 4 + 3] = static_cast<uint8_t>((h[i] >> 0) & 0xFFu);
  }
}

bool sha256_verify(const uint8_t *data, int len, const uint8_t expected[32])
{
  uint8_t out[32];
  sha256_hash(data, len, out);
  return ct_equal(out, expected, 32);
}
#endif
