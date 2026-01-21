/**
* @copyright 2026 - Max Bebök
* @license MIT
*/
#pragma once

#include "ImNodeFlow.h"
#include "json.hpp"
#include "IconsMaterialDesignIcons.h"

namespace Project::Graph::Node
{
  extern std::shared_ptr<ImFlow::PinStyle> PIN_STYLE_LOGIC;
  extern std::shared_ptr<ImFlow::PinStyle> PIN_STYLE_VALUE;

  struct TypeLogic { };
  struct TypeValue { };

  class Base : public ImFlow::BaseNode
  {
    public:
      uint64_t uuid{};
      uint32_t type{};

      virtual void serialize(nlohmann::json &j) = 0;
      virtual void deserialize(nlohmann::json &j) = 0;
      virtual void build(Utils::BinaryFile &f, uint32_t &memOffset) = 0;
  };
}