/**
* @copyright 2026 - Max Bebök
* @license MIT
*/
#pragma once

#include "baseNode.h"
#include "../../../editor/imgui/helper.h"
#include "../../../utils/hash.h"

namespace Project::Graph::Node
{
  class ObjDel : public Base
  {
    private:
      uint16_t objectId{};

    public:
      constexpr static const char* NAME = ICON_MDI_TRASH_CAN_OUTLINE " Delete Object";

      ObjDel()
      {
        uuid = Utils::Hash::randomU64();
        setTitle(NAME);
        setStyle(std::make_shared<ImFlow::NodeStyle>(IM_COL32(191,90,93,255), ImColor(0,0,0,255), 3.5f));

        addIN<TypeLogic>("", ImFlow::ConnectionFilter::SameType(), PIN_STYLE_LOGIC);
        addOUT<TypeLogic>("", PIN_STYLE_LOGIC);
      }

      void draw() override {
        std::vector<ImTable::ComboEntry> entries;
        entries.push_back({0, "< Self >"});

        ImGui::SetNextItemWidth(90.f);
        ImGui::VectorComboBox("##Obj", entries, objectId);
        //ImGui::InputScalar("##ObjectID", ImGuiDataType_U16, &objectId);
      }

      void serialize(nlohmann::json &j) override {
        j["objectId"] = objectId;
      }

      void deserialize(nlohmann::json &j) override {
        objectId = j.value("objectId", 0);
      }

      void build(Utils::BinaryFile &f, uint32_t &memOffset) override {
        f.write<uint16_t>(objectId);
      }
  };
}