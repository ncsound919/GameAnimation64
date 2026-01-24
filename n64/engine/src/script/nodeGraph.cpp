/**
* @copyright 2026 - Max Bebök
* @license MIT
*/
#include "script/nodeGraph.h"

#include <unordered_set>

#include "scene/object.h"
#include "scene/scene.h"
#include "script/scriptTable.h"

namespace
{
  constexpr const char* NODE_TYPE_NAMES[] {
    "START",
    "WAIT",
    "OBJ_DEL",
    "OBJ_EVENT",
    "COMPARE",
    "VALUE",
    "REPEAT",
  };

  std::unordered_map<uint32_t, P64::NodeGraph::UserFunc> userFunctionMap{};

  void dummyFunction(uint32_t arg0)
  {
    debugf("Graph called undefined function, argument: 0x%08lX\n", arg0);
  }
}

namespace P64::NodeGraph
{
  struct NodeDef
  {
    NodeType type{};
    uint8_t outCount{};
    int16_t outOffsets[];

    NodeDef *getNext(uint32_t idx) {
      if(idx >= outCount)return nullptr;
      return (NodeDef*)((uint8_t*)this + outOffsets[idx]);
    }

    uint16_t *getDataPtr() {
      return (uint16_t*)&outOffsets[outCount];
    }
  };

  struct GraphDef
  {
    GraphFunc func;
    uint32_t _padding;
    uint16_t stackSize;
  };

  inline void iterateNodes(NodeDef* node, int level, std::function<bool(NodeDef*, int)> fn)
  {
    for (uint16_t i = 0; i < node->outCount; i++) {
      auto nextNode = (NodeDef*)((uint8_t*)node + node->outOffsets[i]);
      if(!fn(nextNode, level))continue;
      iterateNodes(nextNode, level + 1, fn);
    }
  };

  void* load(const char* path)
  {
    auto data = asset_load(path, nullptr);
    uint64_t uuid = ((uint64_t*)data)[0];
    // debugf("Loaded NodeGraph: %s (UUID: %016llX)\n", path, uuid);
    ((GraphFunc*)data)[0] = P64::Script::getGraphFuncByUUID(uuid);
    return data;
  }
}

void P64::NodeGraph::Instance::load(uint16_t assetIdx)
{
  graphDef = (GraphDef*)AssetManager::getByIndex(assetIdx);
  debugf("Stack-size: %d %d\n", assetIdx, graphDef->stackSize);
  corot = corot_create(graphDef->func, this, graphDef->stackSize*2);
}

P64::NodeGraph::Instance::~Instance()
{
  if(corot) {
    corot_destroy(corot);
    corot = nullptr;
  }
}

void P64::NodeGraph::Instance::update(float deltaTime) {
  //debugf("Instance::update: %p\n", corot);
  if(!corot)return;

  auto t = get_ticks();
  disable_interrupts();
  corot_resume(corot);
  enable_interrupts();
  t = get_ticks() - t;

  if(corot_finished(corot))
  {
    corot_destroy(corot);
    corot = nullptr;
  }

  //graphDef->func();
  /*
  if(!currNode)return;

  const uint16_t *data = currNode->getDataPtr();
  const uint8_t *dataU8 = (uint8_t*)data;
  const u_uint32_t *dataU32 = (u_uint32_t*)data;

  uint32_t outputIndex = 0;

  //printNode(currNode, 0);

  switch(currNode->type)
  {
    case NodeType::START:
      break;

    case NodeType::WAIT:
      reg += (uint16_t)(deltaTime * 1000.0f);
      if(reg < data[0])return;
      reg = 0;
      break;

    case NodeType::OBJ_DEL:
      if(object)object->remove();
      break;

    case NodeType::OBJ_EVENT:
      object->getScene().sendEvent(
        data[0] == 0 ? object->id : data[0],
        object->id,
        data[1],
        (data[2] << 16) | data[3]
      );
      break;
    case NodeType::REPEAT:
    {
      auto &count = memory[dataU8[0]];
      if(count != dataU8[1]) {
        ++count;
        outputIndex = 0;
      } else {
        outputIndex = 1;
        count = 0;
      }
    }break;

    case NodeType::FUNC:
      if(!result) {
        result = &((UserFunc)dataU32[0])(dataU32[1]);
      }
      if(!result->tryGetResult(reg))return;
      result = nullptr;
    break;

    default:
      debugf("Unhandled node type: %d\n", (uint8_t)currNode->type);
      break;
  }

  currNode = currNode->getNext(outputIndex);
  */
}

void P64::NodeGraph::registerFunction(uint32_t strCRC32, UserFunc fn)
{
  userFunctionMap[strCRC32] = fn;
}

P64::NodeGraph::UserFunc P64::NodeGraph::getFunction(uint64_t uuid)
{
  auto it = userFunctionMap.find((uint32_t)uuid);
  if(it != userFunctionMap.end()) {
    return it->second;
  }
  return nullptr;
}
