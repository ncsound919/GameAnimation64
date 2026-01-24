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
  typedef void (*GraphFunc)(void* arg);

  enum class NodeType : uint8_t
  {
    START = 0,
    WAIT = 1,
    OBJ_DEL = 2,
    OBJ_EVENT = 3,
    COMPARE = 4,
    VALUE = 5,
    REPEAT = 6,
    FUNC = 7,
  };

  struct GraphDef;
  struct NodeDef;

  class Instance
  {
    private:
      GraphDef* graphDef{};
      coroutine_t *corot{};

    public:
      Object *object{};

      Instance() = default;
      ~Instance();

      void load(uint16_t assetIdx);
      void update(float deltaTime);
  };

  typedef int(*UserFunc)(uint32_t);

  void registerFunction(uint32_t strCRC32, UserFunc fn);
  UserFunc getFunction(uint64_t uuid);
}
