#ifndef SHAREDCPP_INCLUDE_MSG_HPP
#define SHAREDCPP_INCLUDE_MSG_HPP

#include <cstdint>

#include "crypto.hpp"

namespace shr
{
  struct __attribute__((packed)) MessageHeader
  {
  public:
    static constexpr uint8_t CURRENT_VERSION = 1;
    static constexpr uint8_t MSG_TYPE_UNDEFINED = 0;
    static constexpr uint8_t MSG_TYPE_LOG = 1;
    static constexpr uint8_t MSG_TYPE_HEARTBEAT = 2;
    static constexpr uint8_t MSG_TYPE_COMMAND = 3;
    static constexpr uint8_t MSG_TYPE_STATUS = 4;
    static constexpr uint8_t MSG_TYPE_ESTOP = 6;

    uint8_t version = CURRENT_VERSION; // Protocol version
    uint8_t message_type = MSG_TYPE_UNDEFINED;
    uint16_t message_length;
  };

  template <typename T>
  struct __attribute__((packed)) WireableMessage
  {
  public:
    constexpr int message_len = sizeof(WireableMessage<T>) - sizeof(sha256);
    MessageHeader header;
    T payload;
    char sha256[32]; // SHA-256 of the payload (binary, not hex)

    inline void hash()
    {
      uint8_t* payload = reinterpret_cast<uint8_t*>(this);
      crypto::sha256_hash(payload, message_len, sha256);
    }

    inline bool verify() const
    {
      uint8_t* payload = reinterpret_cast<uint8_t*>(this);
      return crypto::sha256_verify(payload, message_len, sha256);
    }

    inline void prepare(uint8_t msg_type, uint16_t len)
    {
      header.version = MessageHeader::CURRENT_VERSION;
      header.message_type = msg_type;
      header.message_length = len;
      hash();
    }

    inline bool isValid() const
    {
      return header.version == MessageHeader::CURRENT_VERSION &&
             header.message_type != MessageHeader::MSG_TYPE_UNDEFINED &&
             header.message_length == sizeof(T) &&
             verify();
    }
  };
}

#endif // SHAREDCPP_INCLUDE_MSG_HPP
