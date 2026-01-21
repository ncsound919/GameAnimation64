/**
* @copyright 2026 - Max Bebök
* @license MIT
*/
#include "script/nodeGraph.h"

#include "scene/object.h"
#include "scene/scene.h"

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
    uint16_t nodeCount;
    uint16_t memSize;
    NodeDef start;
  };

  void printNode(NodeDef* node, int level)
  {
    if(level > 5)return;
    debugf("%*s", level * 2, "");
    debugf("%p Type:%s, outputs: %d ", node, NODE_TYPE_NAMES[(uint8_t)node->type], node->outCount);
    for (uint16_t i = 0; i < node->outCount; i++) {
      debugf("%d ", node->outOffsets[i]);
    }

    uint16_t *nodeData = (uint16_t*)&node->outOffsets[node->outCount];
    debugf(", data: %04X\n", *nodeData);

    for (uint16_t i = 0; i < node->outCount; i++) {
      auto nextNode = (NodeDef*)((uint8_t*)node + node->outOffsets[i]);
      //printNode(nextNode, level + 1);
    }
  };

}

void P64::NodeGraph::Instance::update(float deltaTime) {
  if(!currNode)return;

  uint16_t *data = currNode->getDataPtr();
  uint8_t *dataU8 = (uint8_t*)data;
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

    default:
      debugf("Unhandled node type: %d\n", (uint8_t)currNode->type);
      break;
  }

  currNode = currNode->getNext(outputIndex);
}
