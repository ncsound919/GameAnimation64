/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#include "assetManager.h"
#include "../context.h"
#include <filesystem>
#include <format>

#include "SHA256.h"
#include "../utils/codeParser.h"
#include "../utils/fs.h"
#include "../utils/hash.h"
#include "../utils/json.h"
#include "../utils/jsonBuilder.h"
#include "../utils/logger.h"
#include "../utils/string.h"
#include "tiny3d/tools/gltf_importer/src/parser.h"

namespace
{
  std::filesystem::path getCodePath(Project::Project *project) {
    auto res = std::filesystem::path{project->getPath()} / "src" / "user";
    if (!std::filesystem::exists(res)) {
      std::filesystem::create_directory(res);
    }
    return res;
  }
}

std::string Project::AssetManager::AssetConf::serialize() const {
  Utils::JSON::Builder builder{};
  builder.set("format", format);
  builder.set("baseScale", baseScale);
  builder.set("compression", static_cast<int>(compression));
  builder.set("gltfBVH", gltfBVH);
  builder.set("exclude", exclude);
  return builder.toString();
}

Project::AssetManager::AssetManager(Project* pr)
  : project{pr}
{
  defaultScript = Utils::FS::loadTextFile("data/scripts/default.cpp");
}

void Project::AssetManager::reload() {
  entries.clear();

  auto assetPath = std::filesystem::path{project->getPath()} / "assets";
  if (!std::filesystem::exists(assetPath)) {
    std::filesystem::create_directory(assetPath);
  }

  // scan all files
  for (const auto &entry : std::filesystem::directory_iterator{assetPath}) {
    if (entry.is_regular_file()) {
      auto path = entry.path();
      auto ext = path.extension().string();

      FileType type = FileType::UNKNOWN;
      if (ext == ".png") {
        type = FileType::IMAGE;
      } else if (ext == ".wav" || ext == ".mp3") {
        type = FileType::AUDIO;
      } else if (ext == ".glb" || ext == ".gltf") {
        type = FileType::MODEL_3D;
      }

      uint64_t uuid = Utils::Hash::sha256_64bit("ASSET:" + path.string());
      Entry entry{
        .uuid = uuid,
        .name = path.filename().string(),
        .path = path.string(),
        .type = type,
      };

      if (type == FileType::IMAGE && ctx.window) {
        entry.texture = new Renderer::Texture{ctx.gpu, path.string()};
      }
      if (type == FileType::MODEL_3D) {
        try {
          entry.t3dmData = parseGLTF(path.string().c_str(), 64.0f);
        } catch (...) {
          Utils::Logger::log("Failed to load 3D model asset: " + path.string());
        }
      }

      // check if meta-data exists
      auto pathMeta = path;
      pathMeta += ".conf";
      if (type != FileType::UNKNOWN && std::filesystem::exists(pathMeta))
      {
        auto doc = Utils::JSON::loadFile(pathMeta);
        if (doc.is_object()) {
          auto &conf = entry.conf;
          conf.format = Utils::JSON::readInt(doc, "format");
          conf.baseScale = Utils::JSON::readInt(doc, "baseScale");
          conf.compression = (ComprTypes)Utils::JSON::readInt(doc, "compression");
          conf.gltfBVH = Utils::JSON::readBool(doc, "gltfBVH");
          conf.exclude = Utils::JSON::readBool(doc, "exclude");
        }
      }

      entries.push_back(entry);
    }
  }

  auto codePath = getCodePath(project);
  for (const auto &entry : std::filesystem::directory_iterator{codePath}) {
    if (entry.is_regular_file()) {
      auto path = entry.path();
      auto ext = path.extension().string();

      FileType type = FileType::UNKNOWN;
      if (ext == ".cpp") {
        type = FileType::CODE;
      } else {
        continue;
      }

      auto code = Utils::FS::loadTextFile(path);

      auto uuidPos = code.find("Script::");
      if (uuidPos == std::string::npos)continue;
      uuidPos += 8;
      if (uuidPos + 16 > code.size())continue;
      auto uuidStr = code.substr(uuidPos, 16);
      uint64_t uuid = 0;
      try {
        uuid = std::stoull(uuidStr, nullptr, 16);
      } catch (...) {
        continue;
      }

      Entry entry{
        .uuid = uuid,
        .name = path.filename().string(),
        .path = path.string(),
        .type = type,
        .params = Utils::CPP::parseDataStruct(code, "Data")
      };

      entries.push_back(entry);
      entriesMap[entry.uuid] = static_cast<int>(entries.size() - 1);

      if (type == FileType::CODE) {
        entriesScript.push_back(entry);
        entriesMapScript[entry.uuid] = static_cast<int>(entriesScript.size() - 1);
      }
    }
  }
}

void Project::AssetManager::save()
{
  for(auto &entry : entries)
  {
    if(entry.type == FileType::UNKNOWN || entry.type == FileType::CODE) {
      continue;
    }

    auto pathMeta = entry.path + ".conf";
    auto json = entry.conf.serialize();
    Utils::FS::saveTextFile(pathMeta, entry.conf.serialize());
  }
}

void Project::AssetManager::createScript(const std::string &name) {
  auto codePath = getCodePath(project);
  auto filePath = codePath / (name + ".cpp");

  uint64_t uuid = Utils::Hash::sha256_64bit("CODE:" + filePath.string() + std::to_string(rand()));
  auto uuidStr = std::format("{:016X}", uuid);
  uuidStr[0] = 'C'; // avoid leading numbers since it's used as a namespace name

  if (std::filesystem::exists(filePath))return;

  auto code = defaultScript;
  code = Utils::replaceAll(code, "__UUID__", uuidStr);

  Utils::FS::saveTextFile(filePath, code);
  reload();
}
