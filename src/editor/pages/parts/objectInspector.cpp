/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#include "objectInspector.h"
#include "imgui.h"
#include "misc/cpp/imgui_stdlib.h"
#include "../../imgui/helper.h"
#include "../../../context.h"
#include "../../../project/component/components.h"
#include "../../undoRedo.h"

Editor::ObjectInspector::ObjectInspector() {
}

void Editor::ObjectInspector::draw() {
  if (ctx.selObjectUUID == 0) {
    ImGui::Text("No Object selected");
    return;
  }

  bool isPrefabInst = false;

  auto scene = ctx.project->getScenes().getLoadedScene();
  if (!scene)return;

  auto obj = scene->getObjectByUUID(ctx.selObjectUUID);
  if (!obj) {
    ctx.selObjectUUID = 0;
    return;
  }

  Project::Object* srcObj = obj.get();
  std::shared_ptr<Project::Prefab> prefab{};
  if(obj->uuidPrefab.value)
  {
    prefab = ctx.project->getAssets().getPrefabByUUID(obj->uuidPrefab.value);
    if(prefab)srcObj = &prefab->obj;
    isPrefabInst = true;
  }


  //if (ImGui::CollapsingHeader("General", ImGuiTreeNodeFlags_DefaultOpen))
  {
    if (ImTable::start("General", obj.get())) {
      ImTable::add("Name", obj->name);

      int idProxy = obj->id;
      ImTable::add("ID", idProxy);
      obj->id = static_cast<uint16_t>(idProxy);

      //ImTable::add("UUID");
      //ImGui::Text("0x%16lX", obj->uuid);

      if(isPrefabInst) {
        ImTable::add("Prefab");

        auto name = std::string{ICON_MDI_PENCIL " "};
        name += obj->isPrefabEdit ? ("Back to Instance") : ("Edit '" + srcObj->name + "'");

        if(ImGui::Button(name.c_str())) {
          obj->isPrefabEdit = !obj->isPrefabEdit;

          if(!obj->isPrefabEdit) {
            prefab->save();
          }
        }
      }

      ImTable::end();
    }
  }

  if (ImGui::CollapsingHeader("Transform", ImGuiTreeNodeFlags_DefaultOpen)) {
    if (ImTable::start("Transform", obj.get())) {
      ImTable::addObjProp("Pos", srcObj->pos);
      ImTable::addObjProp("Scale", srcObj->scale);
      ImTable::addObjProp("Rot", srcObj->rot);
      ImTable::end();
    }
  }

  uint64_t compDelUUID = 0;
  Project::Component::Entry *compCopy = nullptr;

  auto drawComp = [&](Project::Object* obj, Project::Component::Entry &comp, bool isInstance)
  {
    ImTable::PrefabEditScope prefabScope(isInstance);
    ImGui::PushID(&comp);

    auto &def = Project::Component::TABLE[comp.id];
    auto name = std::string{def.icon} + "  " + comp.name;
    if (ImGui::CollapsingHeader(name.c_str(), ImGuiTreeNodeFlags_DefaultOpen))
    {
      if(!ImTable::isPrefabLocked(obj))
      {
        if (ImGui::IsItemClicked(ImGuiMouseButton_Right)) {
          ImGui::OpenPopup("CompCtx");
        }

        if(ImGui::BeginPopupContextItem("CompCtx"))
        {
          if (ImGui::MenuItem(ICON_MDI_CONTENT_COPY " Duplicate")) {
            compCopy = &comp;
          }
          if (ImGui::MenuItem(ICON_MDI_TRASH_CAN_OUTLINE " Delete")) {
            compDelUUID = comp.uuid;
          }
          ImGui::EndPopup();
        }
      }

      def.funcDraw(*obj, comp);
    }
    ImGui::PopID();
  };

  for (auto &comp : srcObj->components) {
    drawComp(obj.get(), comp, false);
  }

  if(isPrefabInst && !obj->isPrefabEdit) {
    for (auto &comp : obj->components) {
      drawComp(obj.get(), comp, true);
    }
    srcObj = obj.get();
  }

  if (compCopy) {
    const int compCopyId = compCopy->id;
    const std::string compCopyName = compCopy->name;
    Editor::UndoRedo::SnapshotScope snapshot(Editor::UndoRedo::getHistory(), "Duplicate Component");
    srcObj->addComponent(compCopyId);
    srcObj->components.back().name = compCopyName + " Copy";
  }
  if (compDelUUID) {
    Editor::UndoRedo::SnapshotScope snapshot(Editor::UndoRedo::getHistory(), "Delete Component");
    srcObj->removeComponent(compDelUUID);
  }

  const char* addLabel = ICON_MDI_PLUS_BOX_OUTLINE " Add Component";
  ImGui::SetCursorPosY(ImGui::GetCursorPosY() + 4);
  ImGui::SetCursorPosX((ImGui::GetWindowWidth() - ImGui::CalcTextSize(addLabel).x) * 0.5f - 4);
  if (ImGui::Button(addLabel)) {
    ImGui::OpenPopup("CompSelect");
  }

  if (ImGui::BeginPopupContextItem("CompSelect"))
  {
    for (auto &comp : Project::Component::TABLE_SORTED_BY_NAME) {
      auto name = std::string{comp.icon} + " " + comp.name;
      if(ImGui::MenuItem(name.c_str())) {
        Editor::UndoRedo::SnapshotScope snapshot(Editor::UndoRedo::getHistory(), "Add Component");
        srcObj->addComponent(comp.id);
      }
    }
    ImGui::EndPopup();
  }
}
