/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#include "logger.h"

#include <chrono>
#include <iomanip>
#include <mutex>
#include <sstream>

namespace
{
  std::mutex mtx{};
  constinit std::string buff{};
  constexpr size_t MAX_BUFF_SIZE = 1024 * 64;

  constinit Utils::Logger::LogOutputFunc outputFunc = nullptr;
  constinit int minLevel = Utils::Logger::LEVEL_INFO;

  void trimBuffer()
  {
    if (buff.length() > MAX_BUFF_SIZE) {
      buff = buff.substr(buff.length() - MAX_BUFF_SIZE);
    }
  }

  std::string nowStr()
  {
    using Clock = std::chrono::system_clock;
    const auto now = Clock::now();
    const auto time = Clock::to_time_t(now);
    const auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;

    std::tm tm{};
  #if defined(_WIN32)
    localtime_s(&tm, &time);
  #else
    localtime_r(&time, &tm);
  #endif

    std::ostringstream ss;
    ss << std::put_time(&tm, "%H:%M:%S") << '.' << std::setfill('0') << std::setw(3) << ms.count();
    return ss.str();
  }

  const char* levelTag(int level)
  {
    switch(level) {
      default:
      case Utils::Logger::LEVEL_INFO:  return "INF";
      case Utils::Logger::LEVEL_WARN:  return "WRN";
      case Utils::Logger::LEVEL_ERROR: return "ERR";
    }
  }
}

void Utils::Logger::setOutput(LogOutputFunc outFunc) {
  std::lock_guard lock{mtx};
  outputFunc = outFunc;
}

void Utils::Logger::setMinLevel(int level) {
  std::lock_guard lock{mtx};
  minLevel = level;
}

int Utils::Logger::getMinLevel() {
  std::lock_guard lock{mtx};
  return minLevel;
}

void Utils::Logger::log(const std::string&msg, int level)
{
  std::lock_guard lock{mtx};
  if(level < minLevel) {
    return;
  }

  buff += '[' + nowStr() + "] [" + levelTag(level) + "] " + msg + "\n";
  trimBuffer();

  if (outputFunc) {
    outputFunc(buff);
    buff = "";
  }
}

void Utils::Logger::logRaw(const std::string&msg, int level) {
  std::lock_guard lock{mtx};
  if(level < minLevel) {
    return;
  }

  buff += msg;
  trimBuffer();

  if (outputFunc) {
    outputFunc(buff);
    buff = "";
  }
}

void Utils::Logger::clear() {
  std::lock_guard lock{mtx};
  buff = "";
}

std::string Utils::Logger::getLog() {
  std::lock_guard lock{mtx};
  return buff;
}
