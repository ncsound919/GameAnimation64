/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#include "scene/object.h"
#include "scene/components/constraint.h"

#include "scene/scene.h"
#include "scene/sceneManager.h"

namespace
{
  struct InitData
  {
    uint16_t refObjId;
    uint8_t type;
    uint8_t flags;
  };
}

namespace P64::Comp
{
  void Constraint::initDelete(Object &obj, Constraint* data, uint16_t* initData_)
  {
    auto initData = (InitData*)initData_;
    if (initData == nullptr) {
      data->~Constraint();
      return;
    }

    new(data) Constraint();
    data->refObjId = initData->refObjId;
    data->type = initData->type;
    data->flags = initData->flags;

    if(data->type == TYPE_REL_OFFSET)
    {
      auto &sc = obj.getScene();
      auto refObj = sc.getObjectById(data->refObjId);
      //debugf("Obj: %d Constraint initDelete: refObjId %d %p\n", obj.id, data->refObjId, refObj);
      if(refObj) {
        data->localRefPos = refObj->intoLocalSpace(obj.pos);
        /*debugf("localRefPos: %f %f %f\n",
          (double)data->localRefPos.x,
          (double)data->localRefPos.y,
          (double)data->localRefPos.z
        );*/
      }
    }
  }

  void Constraint::update(Object &obj, Constraint* data, float deltaTime)
  {
    if(data->type == TYPE_COPY_CAM)return;

    auto &sc = obj.getScene();
    auto refObj = sc.getObjectById(data->refObjId);
    if(!refObj)return;

    /*debugf("Constraint update: obj %d, refObj %d | pos: (%f, %f, %f)\n",
      obj.id, refObj->id,
      (double)refObj->pos.x, (double)refObj->pos.y, (double)refObj->pos.z
    );*/

    if(data->type == TYPE_COPY_OBJ)
    {
      if(data->flags & FLAG_USE_POS)obj.pos = refObj->pos;
      if(data->flags & FLAG_USE_SCALE)obj.scale = refObj->scale;
      if(data->flags & FLAG_USE_ROT)obj.rot = refObj->rot;
    }

    if(data->type == TYPE_REL_OFFSET)
    {
      auto refPosWorld = refObj->outOfLocalSpace(data->localRefPos);
      obj.pos = refPosWorld;
      //if(data->flags & FLAG_USE_POS)obj.pos = refPosWorld;
    }
  }

  void Constraint::draw(Object& obj, Constraint* data, float deltaTime)
  {
    if(data->type != TYPE_COPY_CAM)return;

    auto &sc = obj.getScene();
    auto &cam = sc.getActiveCamera();

    if(data->flags & FLAG_USE_POS)obj.pos = cam.getPos();
  }
}
