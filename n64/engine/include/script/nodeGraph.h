/**
* @copyright 2026 - Max Bebök
* @license MIT
*/
#pragma once
#include <libdragon.h>

#include "assets/assetManager.h"

namespace P64
{
  class Object;
}

namespace P64::NodeGraph
{
  enum class NodeType : uint8_t
  {
    START = 0,
    WAIT = 1,
    OBJ_DEL = 2,
    OBJ_EVENT = 3,
    COMPARE = 4,
    VALUE = 5,
    REPEAT = 6,
  };

  struct GraphDef;
  struct NodeDef;

  class Instance
  {
    private:
      GraphDef* graphDef{};

      NodeDef* currNode{};
      uint16_t reg{};
      uint8_t memory[64]{}; // @TODO: dynamic

    public:
      Object *object{};

      Instance() = default;

      explicit Instance(uint16_t assetIdx) {
        graphDef = (GraphDef*)AssetManager::getByIndex(assetIdx);
        currNode = (NodeDef*)((char*)graphDef + 4);
      }

      void update(float deltaTime);
  };
}
