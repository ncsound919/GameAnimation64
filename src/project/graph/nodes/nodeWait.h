/**
* @copyright 2026 - Max Bebök
* @license MIT
*/
#pragma once

#include "baseNode.h"
#include "../../../utils/hash.h"

namespace Project::Graph::Node
{
  class Wait : public Base
  {
    private:
      float time{};

    public:
      constexpr static const char* NAME = ICON_MDI_CLOCK_OUTLINE " Wait";

      Wait()
      {
        uuid = Utils::Hash::randomU64();
        setTitle(NAME);
        setStyle(std::make_shared<ImFlow::NodeStyle>(IM_COL32(90,191,93,255), ImColor(0,0,0,255), 3.5f));

        addIN<TypeLogic>("", ImFlow::ConnectionFilter::SameType(), PIN_STYLE_LOGIC);
        addOUT<TypeLogic>("", PIN_STYLE_LOGIC);
      }

      void draw() override {
        ImGui::SetNextItemWidth(50.f);
        ImGui::InputFloat("sec.", &time);

        //showIN("", 0, ImFlow::ConnectionFilter::SameType(), PIN_STYLE_LOGIC);
      }

      void serialize(nlohmann::json &j) override {
        j["time"] = time;
      }

      void deserialize(nlohmann::json &j) override {
        time = j.value("time", 0.0f);
      }

      void build(Utils::BinaryFile &f, uint32_t &memOffset) override {
        f.write<uint16_t>(time * 1000); // milliseconds
      }
  };
}