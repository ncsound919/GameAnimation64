/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#pragma once
#include <string>
#include <unordered_map>
#include <vector>

#include "../renderer/texture.h"

namespace Project
{
  class Project;

  enum class ComprTypes : int
  {
    DEFAULT = 0,
    LEVEL_0,
    LEVEL_1,
    LEVEL_2,
    LEVEL_3,
  };

  class AssetManager
  {
    public:
      enum class FileType : int
      {
        UNKNOWN = 0,
        IMAGE,
        AUDIO,
        MODEL_3D,
        CODE,
        PREFAB
      };

      struct AssetConf
      {
        int format{0};
        int baseScale{0};
        bool gltfBVH{0};
        ComprTypes compression{ComprTypes::DEFAULT};
        bool exclude{false};

        std::string serialize() const;
      };

      struct Entry
      {
        uint64_t uuid{0};
        std::string name{};
        std::string path{};
        FileType type{};
        Renderer::Texture *texture{nullptr};
        AssetConf conf{};
      };

    private:
      Project *project;
      std::vector<Entry> entries{};
      std::vector<Entry> entriesScript{};

      std::string defaultScript{};

    public:
      std::unordered_map<uint64_t, int> entriesMap{};
      std::unordered_map<uint64_t, int> entriesMapScript{};

      AssetManager(Project *pr);

      void reload();

      [[nodiscard]] const std::vector<Entry>& getEntries() const {
        return entries;
      }
      [[nodiscard]] const std::vector<Entry>& getScriptEntries() const {
        return entriesScript;
      }

      Entry* getEntryByUUID(uint64_t uuid) {
        for (auto &entry : entries) {
          if (entry.uuid == uuid) {
            return &entry;
          }
        }
        return nullptr;
      }

      void save();

      void createScript(const std::string &name);
  };
}
