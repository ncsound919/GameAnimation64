/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#include "proc.h"

#include <fstream>
#include <memory>
#include <filesystem>
#include <cstdio>

#ifdef _WIN32
  #include <windows.h>
#elif __APPLE__
  #include <mach-o/dyld.h>
  #include <climits>
#else
  #include <unistd.h>
  #include <sys/wait.h>
#endif

#include "logger.h"

namespace fs = std::filesystem;

namespace
{
  constexpr uint32_t BUFF_SIZE = 128;

  FILE* openPipeRead(const std::string &cmd)
  {
  #if defined(_WIN32)
    return _popen(cmd.c_str(), "r");
  #else
    return popen(cmd.c_str(), "r");
  #endif
  }

  int closePipe(FILE* pipe)
  {
  #if defined(_WIN32)
    return _pclose(pipe);
  #else
    return pclose(pipe);
  #endif
  }

  bool closeStatusSuccess(int status)
  {
  #if defined(_WIN32)
    return status == 0;
  #else
    if (status == -1) {
      return false;
    }
    if (WIFEXITED(status)) {
      return WEXITSTATUS(status) == 0;
    }
    return false;
  #endif
  }
}

std::string Utils::Proc::runSync(const std::string &cmd)
{
  std::shared_ptr<FILE> pipe(openPipeRead(cmd), closePipe);
  if(!pipe)return "";

  char buffer[BUFF_SIZE];
  std::string result{};

  while(fgets(buffer, BUFF_SIZE, pipe.get()) != nullptr) {
    result += buffer;
  }
  return result;
}

bool Utils::Proc::runSyncLogged(const std::string&cmd) {
  auto cmdWithErr = cmd + " 2>&1";
  FILE* pipe = openPipeRead(cmdWithErr);
  if(!pipe)return false;

  char buffer[BUFF_SIZE];
  while(fgets(buffer, BUFF_SIZE, pipe) != nullptr) {
    Logger::logRaw(buffer);
  }
  const int status = closePipe(pipe);
  return closeStatusSuccess(status);
}

std::string Utils::Proc::getSelfPath()
{
#ifdef _WIN32
  // Windows specific
  wchar_t szPath[MAX_PATH];
  GetModuleFileNameW( NULL, szPath, MAX_PATH );
#elif __APPLE__
  char szPath[PATH_MAX];
  uint32_t bufsize = PATH_MAX;
  if (!_NSGetExecutablePath(szPath, &bufsize))
    return fs::path{szPath}.parent_path() / ""; // to finish the folder path with (back)slash
  return {};  // some error
#else
  // Linux specific
  char szPath[PATH_MAX];
  ssize_t count = readlink( "/proc/self/exe", szPath, PATH_MAX );
  if( count < 0 || count >= PATH_MAX )
    return {}; // some error
  szPath[count] = '\0';
#endif

  return fs::path{szPath}.string(); // to finish the folder path with (back)slash
}

std::string Utils::Proc::getSelfDir()
{
  return (fs::path{getSelfPath()}.parent_path() / "").string();
}
